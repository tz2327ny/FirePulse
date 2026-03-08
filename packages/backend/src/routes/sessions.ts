import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as sessionService from '../services/sessionService.js';
import * as sessionEventService from '../services/sessionEventService.js';
import * as auditService from '../services/auditService.js';
import { SessionState, ParticipantStatus } from '@heartbeat/shared';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  classId: z.string().uuid().optional(),
});

const stateSchema = z.object({
  state: z.nativeEnum(SessionState),
});

const statusSchema = z.object({
  status: z.nativeEnum(ParticipantStatus),
  note: z.string().optional(),
});

router.get('/', async (_req: Request, res: Response) => {
  const sessions = await sessionService.list();
  const data = await Promise.all(
    sessions.map(async (s) => ({
      ...s,
      className: s.class?.name || null,
      participantCount: s._count.sessionParticipants,
      activeAlertCount: s._count.alerts,
      timing: await sessionService.computeSessionTiming(s),
      class: undefined,
      _count: undefined,
    }))
  );
  res.json({ data });
});

router.get('/current', async (_req: Request, res: Response) => {
  const session = await sessionService.getCurrent();
  if (!session) {
    res.json({ data: null });
    return;
  }
  res.json({
    data: {
      ...session,
      className: session.class?.name || null,
      participantCount: session._count.sessionParticipants,
      activeAlertCount: session._count.alerts,
      timing: await sessionService.computeSessionTiming(session),
      class: undefined,
      _count: undefined,
    },
  });
});

router.get('/:id', async (req: Request, res: Response) => {
  const session = await sessionService.getById(req.params.id);
  if (!session) {
    res.status(404).json({ status: 404, message: 'Session not found' });
    return;
  }
  res.json({
    data: {
      ...session,
      timing: await sessionService.computeSessionTiming(session),
    },
  });
});

router.post('/', requireRole('admin', 'instructor'), validate(createSchema), async (req: Request, res: Response) => {
  const session = await sessionService.create(req.body);
  auditService.log('session.created', 'session', session?.id ?? null, req.user!.userId, { name: req.body.name });
  res.status(201).json({ data: session });
});

router.post('/:id/state', requireRole('admin', 'instructor'), validate(stateSchema), async (req: Request, res: Response) => {
  try {
    const session = await sessionService.changeState(req.params.id, req.body.state, req.user!.userId);
    auditService.log('session.state_changed', 'session', req.params.id, req.user!.userId, {
      newState: req.body.state,
    });
    res.json({ data: session });
  } catch (err: any) {
    res.status(400).json({ status: 400, message: err.message });
  }
});

router.get('/:id/events', async (req: Request, res: Response) => {
  const events = await sessionEventService.listBySession(req.params.id);
  res.json({ data: events });
});

// Session participants
router.post('/:id/participants', requireRole('admin', 'instructor'), async (req: Request, res: Response) => {
  const { participantId } = req.body;
  const sp = await sessionService.addParticipant(req.params.id, participantId);
  res.status(201).json({ data: sp });
});

router.patch('/participants/:spId/status', requireRole('admin', 'instructor'), validate(statusSchema), async (req: Request, res: Response) => {
  try {
    const sp = await sessionService.updateParticipantStatus(
      req.params.spId,
      req.body.status,
      req.user!.userId,
      req.body.note
    );
    res.json({ data: sp });
  } catch (err: any) {
    res.status(400).json({ status: 400, message: err.message });
  }
});

// CSV export
router.get('/:id/export.csv', async (req: Request, res: Response) => {
  const session = await sessionService.getById(req.params.id);
  if (!session) {
    res.status(404).json({ status: 404, message: 'Session not found' });
    return;
  }

  const { prisma } = await import('../lib/prisma.js');

  // Get rollups for this session
  const rollups = await prisma.sessionTelemetryRollup.findMany({
    where: { sessionId: req.params.id as string },
    include: { participant: true, device: true },
    orderBy: { capturedAt: 'asc' },
  }) as any[];

  // Get alerts
  const alerts = await prisma.alert.findMany({
    where: { sessionId: req.params.id as string },
    include: { participant: true },
    orderBy: { openedAt: 'asc' },
  }) as any[];

  // Compute timing
  const timing = await sessionService.computeSessionTiming(session);

  const fmtDur = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  // Build CSV
  const lines: string[] = [];
  lines.push('Session Report');
  lines.push(`Session Name,${session.name}`);
  lines.push(`State,${session.state}`);
  lines.push(`Started,${session.startedAt || 'N/A'}`);
  lines.push(`Ended,${session.endedAt || 'N/A'}`);

  if (timing) {
    lines.push(`Total Duration,${fmtDur(timing.totalDurationMs)}`);
    lines.push(`Active Training Time,${fmtDur(timing.activeDurationMs)}`);
    lines.push(`Break Count,${timing.breakCount}`);
    lines.push(`Total Break Time,${fmtDur(timing.totalBreakMs)}`);
    if (timing.breaks.length > 0) {
      lines.push('');
      lines.push('Break Log');
      lines.push('Break #,Started,Ended,Duration');
      timing.breaks.forEach((b, i) => {
        lines.push(`${i + 1},${b.startedAt},${b.endedAt || 'ongoing'},${fmtDur(b.durationMs)}`);
      });
    }
  }
  lines.push('');

  // Participants
  lines.push('Participants');
  lines.push('First Name,Last Name,Company,Status');
  for (const sp of session.sessionParticipants) {
    lines.push(`${sp.participant.firstName},${sp.participant.lastName},${sp.participant.company},${sp.status}`);
  }
  lines.push('');

  // Telemetry rollups
  if (rollups.length > 0) {
    lines.push('Telemetry Data');
    lines.push('Timestamp,Participant,Device,Heart Rate,Signal Score,Freshness');
    for (const r of rollups) {
      lines.push(
        `${r.capturedAt.toISOString()},${r.participant.firstName} ${r.participant.lastName},${r.device.shortId},${r.heartRate ?? ''},${r.signalScore ?? ''},${r.freshnessState ?? ''}`
      );
    }
    lines.push('');
  }

  // Alerts
  if (alerts.length > 0) {
    lines.push('Alerts');
    lines.push('Opened At,Participant,Source,Level,Status,Acknowledged At');
    for (const a of alerts) {
      lines.push(
        `${a.openedAt.toISOString()},${a.participant ? `${a.participant.firstName} ${a.participant.lastName}` : 'N/A'},${a.alertSource},${a.alertLevel},${a.status},${a.acknowledgedAt?.toISOString() || ''}`
      );
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="session-${session.name}.csv"`);
  res.send(lines.join('\n'));
});

export default router;
