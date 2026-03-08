import { prisma } from '../lib/prisma.js';
import { SessionState, SessionEventType } from '@heartbeat/shared';
import type { SessionTimingDTO, SessionBreakDTO } from '@heartbeat/shared';
import { logger } from '../lib/logger.js';
import * as sessionEventService from './sessionEventService.js';

const VALID_TRANSITIONS: Record<string, string[]> = {
  [SessionState.STANDBY]: [SessionState.ACTIVE, SessionState.ENDED],
  [SessionState.ACTIVE]: [SessionState.PAUSED, SessionState.ENDED],
  [SessionState.PAUSED]: [SessionState.ACTIVE, SessionState.ENDED],
  [SessionState.ENDED]: [],
};

export async function list() {
  return prisma.session.findMany({
    include: {
      class: { select: { name: true } },
      _count: { select: { sessionParticipants: true, alerts: { where: { status: 'active' } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCurrent() {
  return prisma.session.findFirst({
    where: { state: { not: SessionState.ENDED } },
    include: {
      class: { select: { name: true } },
      _count: { select: { sessionParticipants: true, alerts: { where: { status: 'active' } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  return prisma.session.findUnique({
    where: { id },
    include: {
      class: { select: { name: true } },
      sessionParticipants: {
        include: { participant: true },
        orderBy: { participant: { lastName: 'asc' } },
      },
      _count: { select: { alerts: { where: { status: 'active' } } } },
    },
  });
}

export async function create(data: { name: string; classId?: string }) {
  const session = await prisma.session.create({
    data: {
      name: data.name,
      classId: data.classId || null,
      state: SessionState.STANDBY,
    },
  });

  // If created from a class, copy participants
  if (data.classId) {
    const classParticipants = await prisma.classParticipant.findMany({
      where: { classId: data.classId },
    });
    if (classParticipants.length > 0) {
      await prisma.sessionParticipant.createMany({
        data: classParticipants.map((cp) => ({
          sessionId: session.id,
          participantId: cp.participantId,
          status: 'present',
        })),
      });
    }
  }

  return getById(session.id);
}

export async function changeState(sessionId: string, newState: SessionState, userId?: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');

  const allowed = VALID_TRANSITIONS[session.state] || [];
  if (!allowed.includes(newState)) {
    throw new Error(`Cannot transition from ${session.state} to ${newState}`);
  }

  const updateData: Record<string, unknown> = { state: newState };
  if (newState === SessionState.ACTIVE && !session.startedAt) {
    updateData.startedAt = new Date();
    updateData.pausedAt = null;
  }
  if (newState === SessionState.ACTIVE && session.state === SessionState.PAUSED) {
    updateData.pausedAt = null;
  }
  if (newState === SessionState.PAUSED) {
    updateData.pausedAt = new Date();
  }
  if (newState === SessionState.ENDED) {
    updateData.endedAt = new Date();
  }

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: updateData,
  });

  // Log session event
  await prisma.sessionEvent.create({
    data: {
      sessionId,
      eventType: 'session_state_changed',
      userId: userId || null,
      payloadJson: JSON.stringify({ oldState: session.state, newState }),
    },
  });

  logger.info({ sessionId, oldState: session.state, newState }, 'Session state changed');
  return updated;
}

export async function updateParticipantStatus(
  sessionParticipantId: string,
  newStatus: string,
  userId?: string,
  note?: string
) {
  const sp = await prisma.sessionParticipant.findUnique({ where: { id: sessionParticipantId } });
  if (!sp) throw new Error('Session participant not found');

  const oldStatus = sp.status;

  const updated = await prisma.sessionParticipant.update({
    where: { id: sessionParticipantId },
    data: { status: newStatus },
  });

  await prisma.participantStatusEvent.create({
    data: {
      sessionParticipantId,
      oldStatus,
      newStatus,
      changedByUserId: userId || null,
      note: note || null,
    },
  });

  // Log to session events for activity timeline
  await sessionEventService.log({
    sessionId: sp.sessionId,
    eventType: SessionEventType.PARTICIPANT_STATUS_CHANGED,
    participantId: sp.participantId,
    userId,
    payload: { oldStatus, newStatus },
  });

  return updated;
}

export async function addParticipant(sessionId: string, participantId: string) {
  return prisma.sessionParticipant.create({
    data: { sessionId, participantId, status: 'present' },
  });
}

export async function removeParticipant(sessionParticipantId: string) {
  return prisma.sessionParticipant.delete({ where: { id: sessionParticipantId } });
}

// ---- Timing computation ----

export async function computeSessionTiming(
  session: { id: string; state: string; startedAt: Date | null; endedAt: Date | null }
): Promise<SessionTimingDTO | null> {
  if (!session.startedAt) return null;

  const events = await prisma.sessionEvent.findMany({
    where: { sessionId: session.id, eventType: 'session_state_changed' },
    orderBy: { occurredAt: 'asc' },
  });

  const now = new Date();
  const endTime = session.endedAt || now;
  const totalDurationMs = endTime.getTime() - session.startedAt.getTime();

  const breaks: SessionBreakDTO[] = [];
  let totalBreakMs = 0;
  let currentPauseStart: Date | null = null;

  for (const event of events) {
    const payload = event.payloadJson ? JSON.parse(event.payloadJson as string) as { oldState?: string; newState?: string } : null;
    if (!payload) continue;

    if (payload.newState === 'paused') {
      currentPauseStart = event.occurredAt;
    } else if (payload.oldState === 'paused' && payload.newState === 'active') {
      if (currentPauseStart) {
        const breakDuration = event.occurredAt.getTime() - currentPauseStart.getTime();
        breaks.push({
          startedAt: currentPauseStart.toISOString(),
          endedAt: event.occurredAt.toISOString(),
          durationMs: breakDuration,
        });
        totalBreakMs += breakDuration;
        currentPauseStart = null;
      }
    } else if (payload.oldState === 'paused' && payload.newState === 'ended') {
      if (currentPauseStart) {
        const breakDuration = event.occurredAt.getTime() - currentPauseStart.getTime();
        breaks.push({
          startedAt: currentPauseStart.toISOString(),
          endedAt: event.occurredAt.toISOString(),
          durationMs: breakDuration,
        });
        totalBreakMs += breakDuration;
        currentPauseStart = null;
      }
    }
  }

  // Handle ongoing pause (session is currently paused)
  if (currentPauseStart && session.state === 'paused') {
    const breakDuration = now.getTime() - currentPauseStart.getTime();
    breaks.push({
      startedAt: currentPauseStart.toISOString(),
      endedAt: null,
      durationMs: breakDuration,
    });
    totalBreakMs += breakDuration;
  }

  return {
    totalDurationMs,
    activeDurationMs: totalDurationMs - totalBreakMs,
    breakCount: breaks.length,
    totalBreakMs,
    breaks,
  };
}
