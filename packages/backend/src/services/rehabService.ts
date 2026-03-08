import { prisma } from '../lib/prisma.js';
import { eventBus } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';
import * as sessionEventService from './sessionEventService.js';
import type { RehabVisitDTO, RehabCheckpointDTO } from '@heartbeat/shared';
import { RehabCheckpointType } from '@heartbeat/shared';

// ---- Helpers ----

function mapCheckpoint(cp: any): RehabCheckpointDTO {
  return {
    id: cp.id,
    rehabVisitId: cp.rehabVisitId,
    checkpointType: cp.checkpointType,
    timestamp: cp.timestamp.toISOString(),
    liveHrSnapshot: cp.liveHrSnapshot,
    manualHr: cp.manualHr,
    bpSystolic: cp.bpSystolic,
    bpDiastolic: cp.bpDiastolic,
    respirations: cp.respirations,
    spo2: cp.spo2,
    temperature: cp.temperature,
    temperatureMethod: cp.temperatureMethod,
    note: cp.note,
    disposition: cp.disposition,
    enteredByName: cp.enteredBy?.displayName || null,
    createdAt: cp.createdAt.toISOString(),
  };
}

function mapVisit(visit: any): RehabVisitDTO {
  return {
    id: visit.id,
    sessionId: visit.sessionId,
    participantId: visit.participantId,
    participantName: visit.participant
      ? `${visit.participant.firstName} ${visit.participant.lastName}`
      : 'Unknown',
    participantCompany: visit.participant?.company || '',
    startedAt: visit.startedAt.toISOString(),
    endedAt: visit.endedAt?.toISOString() || null,
    finalDisposition: visit.finalDisposition,
    createdByName: visit.createdBy?.displayName || null,
    checkpoints: (visit.checkpoints || []).map(mapCheckpoint),
    checkpointCount: visit.checkpoints?.length || 0,
    updatedAt: visit.updatedAt.toISOString(),
  };
}

const visitIncludes = {
  participant: { select: { firstName: true, lastName: true, company: true } },
  createdBy: { select: { displayName: true } },
  checkpoints: {
    include: { enteredBy: { select: { displayName: true } } },
    orderBy: { timestamp: 'asc' as const },
  },
};

// ---- Public API ----

export async function listBySession(
  sessionId: string,
  activeOnly = false
): Promise<RehabVisitDTO[]> {
  const visits = await prisma.rehabVisit.findMany({
    where: {
      sessionId,
      ...(activeOnly ? { endedAt: null } : {}),
    },
    include: visitIncludes,
    orderBy: { startedAt: 'desc' },
  });
  return visits.map(mapVisit);
}

export async function getById(visitId: string): Promise<RehabVisitDTO | null> {
  const visit = await prisma.rehabVisit.findUnique({
    where: { id: visitId },
    include: visitIncludes,
  });
  return visit ? mapVisit(visit) : null;
}

export async function createVisit(
  sessionId: string,
  participantId: string,
  userId?: string
): Promise<RehabVisitDTO> {
  // Prevent duplicate open visits
  const existing = await prisma.rehabVisit.findFirst({
    where: { sessionId, participantId, endedAt: null },
  });
  if (existing) {
    throw new Error('Participant already has an active rehab visit');
  }

  // Get live HR snapshot from current telemetry
  const liveHr = await getLiveHrForParticipant(participantId);

  // Create visit + initial checkpoint in a transaction
  const visit = await prisma.$transaction(async (tx) => {
    const v = await tx.rehabVisit.create({
      data: {
        sessionId,
        participantId,
        createdByUserId: userId || null,
      },
    });

    await tx.rehabCheckpoint.create({
      data: {
        rehabVisitId: v.id,
        checkpointType: RehabCheckpointType.INITIAL,
        liveHrSnapshot: liveHr,
        enteredByUserId: userId || null,
      },
    });

    return v;
  });

  // Log session event
  await sessionEventService.log({
    sessionId,
    eventType: 'rehab_visit_created',
    participantId,
    userId,
    payload: { rehabVisitId: visit.id },
  });

  // Fetch the full DTO and publish
  const dto = await getById(visit.id);
  if (dto) {
    eventBus.emit('rehab:visit_created', dto);
  }

  logger.info({ visitId: visit.id, participantId }, 'Rehab visit created');
  return dto!;
}

export async function addCheckpoint(
  visitId: string,
  data: {
    checkpointType: string;
    manualHr?: number;
    bpSystolic?: number;
    bpDiastolic?: number;
    respirations?: number;
    spo2?: number;
    temperature?: number;
    temperatureMethod?: string;
    note?: string;
    disposition?: string;
  },
  userId?: string
): Promise<RehabVisitDTO> {
  const visit = await prisma.rehabVisit.findUnique({ where: { id: visitId } });
  if (!visit) throw new Error('Rehab visit not found');
  if (visit.endedAt) throw new Error('Cannot add checkpoint to a closed visit');

  // Get live HR
  const liveHr = await getLiveHrForParticipant(visit.participantId);

  await prisma.rehabCheckpoint.create({
    data: {
      rehabVisitId: visitId,
      checkpointType: data.checkpointType,
      liveHrSnapshot: liveHr,
      manualHr: data.manualHr ?? null,
      bpSystolic: data.bpSystolic ?? null,
      bpDiastolic: data.bpDiastolic ?? null,
      respirations: data.respirations ?? null,
      spo2: data.spo2 ?? null,
      temperature: data.temperature ?? null,
      temperatureMethod: data.temperatureMethod ?? null,
      note: data.note ?? null,
      disposition: data.disposition ?? null,
      enteredByUserId: userId || null,
    },
  });

  const dto = await getById(visitId);
  if (dto) {
    eventBus.emit('rehab:visit_updated', dto);
  }

  logger.info({ visitId, checkpointType: data.checkpointType }, 'Rehab checkpoint added');
  return dto!;
}

export async function closeVisit(
  visitId: string,
  finalDisposition: string,
  userId?: string
): Promise<RehabVisitDTO> {
  const visit = await prisma.rehabVisit.findUnique({ where: { id: visitId } });
  if (!visit) throw new Error('Rehab visit not found');
  if (visit.endedAt) throw new Error('Visit is already closed');

  // Get live HR for end checkpoint
  const liveHr = await getLiveHrForParticipant(visit.participantId);

  await prisma.$transaction(async (tx) => {
    // Create end checkpoint
    await tx.rehabCheckpoint.create({
      data: {
        rehabVisitId: visitId,
        checkpointType: RehabCheckpointType.END,
        liveHrSnapshot: liveHr,
        disposition: finalDisposition,
        enteredByUserId: userId || null,
      },
    });

    // Close the visit
    await tx.rehabVisit.update({
      where: { id: visitId },
      data: {
        endedAt: new Date(),
        finalDisposition: finalDisposition,
      },
    });
  });

  // Log session event
  await sessionEventService.log({
    sessionId: visit.sessionId,
    eventType: 'rehab_visit_closed',
    participantId: visit.participantId,
    userId,
    payload: { rehabVisitId: visitId, finalDisposition },
  });

  const dto = await getById(visitId);
  if (dto) {
    eventBus.emit('rehab:visit_updated', dto);
  }

  logger.info({ visitId, finalDisposition }, 'Rehab visit closed');
  return dto!;
}

export async function cancelVisit(
  visitId: string,
  userId?: string
): Promise<{ participantId: string; sessionId: string }> {
  const visit = await prisma.rehabVisit.findUnique({ where: { id: visitId } });
  if (!visit) throw new Error('Rehab visit not found');
  if (visit.endedAt) throw new Error('Cannot cancel a closed visit');

  // Delete checkpoints first, then the visit
  await prisma.$transaction(async (tx) => {
    await tx.rehabCheckpoint.deleteMany({ where: { rehabVisitId: visitId } });
    await tx.rehabVisit.delete({ where: { id: visitId } });
  });

  // Log session event
  await sessionEventService.log({
    sessionId: visit.sessionId,
    eventType: 'rehab_visit_cancelled',
    participantId: visit.participantId,
    userId,
    payload: { rehabVisitId: visitId },
  });

  // Publish cancellation so dashboard removes the "In Rehab" badge
  eventBus.emit('rehab:visit_cancelled', {
    id: visitId,
    sessionId: visit.sessionId,
    participantId: visit.participantId,
  });

  logger.info({ visitId, participantId: visit.participantId }, 'Rehab visit cancelled');
  return { participantId: visit.participantId, sessionId: visit.sessionId };
}

export async function getActiveVisitForParticipant(
  sessionId: string,
  participantId: string
): Promise<RehabVisitDTO | null> {
  const visit = await prisma.rehabVisit.findFirst({
    where: { sessionId, participantId, endedAt: null },
    include: visitIncludes,
  });
  return visit ? mapVisit(visit) : null;
}

export async function getActiveParticipantIds(sessionId: string): Promise<string[]> {
  const visits = await prisma.rehabVisit.findMany({
    where: { sessionId, endedAt: null },
    select: { participantId: true },
  });
  return visits.map((v) => v.participantId);
}

export async function reEvaluateVisit(
  originalVisitId: string,
  userId?: string
): Promise<RehabVisitDTO> {
  const original = await prisma.rehabVisit.findUnique({ where: { id: originalVisitId } });
  if (!original) throw new Error('Rehab visit not found');
  if (!original.endedAt) throw new Error('Cannot re-evaluate an active visit');
  if (original.finalDisposition !== 'remain_in_rehab') {
    throw new Error('Only visits with "remain in rehab" disposition can be re-evaluated');
  }

  // Prevent duplicate open visits
  const existingActive = await prisma.rehabVisit.findFirst({
    where: { sessionId: original.sessionId, participantId: original.participantId, endedAt: null },
  });
  if (existingActive) {
    throw new Error('Participant already has an active rehab visit');
  }

  // Get live HR snapshot
  const liveHr = await getLiveHrForParticipant(original.participantId);

  // Create new visit with REHAB_EVAL initial checkpoint
  const visit = await prisma.$transaction(async (tx) => {
    const v = await tx.rehabVisit.create({
      data: {
        sessionId: original.sessionId,
        participantId: original.participantId,
        createdByUserId: userId || null,
      },
    });

    await tx.rehabCheckpoint.create({
      data: {
        rehabVisitId: v.id,
        checkpointType: RehabCheckpointType.REHAB_EVAL,
        liveHrSnapshot: liveHr,
        enteredByUserId: userId || null,
      },
    });

    return v;
  });

  // Log session event
  await sessionEventService.log({
    sessionId: original.sessionId,
    eventType: 'rehab_visit_created',
    participantId: original.participantId,
    userId,
    payload: { rehabVisitId: visit.id, reEvaluatedFrom: originalVisitId },
  });

  // Fetch full DTO and publish
  const dto = await getById(visit.id);
  if (dto) {
    eventBus.emit('rehab:visit_created', dto);
  }

  logger.info({ visitId: visit.id, originalVisitId, participantId: original.participantId }, 'Rehab visit re-evaluated');
  return dto!;
}

// ---- Internal helpers ----

async function getLiveHrForParticipant(participantId: string): Promise<number | null> {
  // Find the current device assignment for this participant
  const assignment = await prisma.deviceAssignment.findFirst({
    where: { participantId, unassignedAt: null },
    select: { deviceId: true },
  });
  if (!assignment) return null;

  // Get current telemetry for that device
  const ct = await prisma.currentTelemetry.findUnique({
    where: { deviceId: assignment.deviceId },
    select: { heartRate: true },
  });
  return ct?.heartRate ?? null;
}
