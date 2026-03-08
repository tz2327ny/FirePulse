import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as deviceService from '../services/deviceService.js';
import * as auditService from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

const assignSchema = z.object({
  participantId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const includeArchived = req.query.archived === 'true';
  const devices = await deviceService.list(includeArchived);
  res.json({
    data: devices.map((d) => ({
      id: d.id,
      macAddress: d.macAddress,
      shortId: d.shortId,
      deviceName: d.deviceName,
      deviceType: d.deviceType,
      isIgnored: d.isIgnored,
      isArchived: d.isArchived,
      currentParticipantId: d.currentAssignment?.participantId || null,
      currentParticipantName: d.currentAssignment
        ? `${d.currentAssignment.participant.firstName} ${d.currentAssignment.participant.lastName}`
        : null,
      createdAt: d.createdAt,
    })),
  });
});

router.get('/discovery', async (_req: Request, res: Response) => {
  // Return all devices with current telemetry for discovery view
  const { prisma } = await import('../lib/prisma.js');
  const devices = await prisma.device.findMany({
    where: { isArchived: false },
    include: { currentTelemetry: true },
  });

  const assignments = await prisma.deviceAssignment.findMany({
    where: {
      deviceId: { in: devices.map((d) => d.id) },
      unassignedAt: null,
    },
    include: { participant: true },
  });
  const assignmentMap = new Map(assignments.map((a) => [a.deviceId, a]));

  const receivers = await prisma.receiver.findMany();
  const receiverMap = new Map(receivers.map((r) => [r.receiverHwId, r]));

  res.json({
    data: devices.map((d) => {
      const ct = d.currentTelemetry;
      const assignment = assignmentMap.get(d.id);
      const bestReceiver = ct?.bestReceiverHwId ? receiverMap.get(ct.bestReceiverHwId) : null;

      return {
        id: d.id,
        macAddress: d.macAddress,
        shortId: d.shortId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        isIgnored: d.isIgnored,
        heartRate: ct?.heartRate || null,
        lastSeenAt: ct?.lastSeenAt || null,
        bestReceiverName: bestReceiver?.name || null,
        assignedParticipantId: assignment?.participantId || null,
        assignedParticipantName: assignment
          ? `${assignment.participant.firstName} ${assignment.participant.lastName}`
          : null,
      };
    }),
  });
});

router.get('/:id', async (req: Request, res: Response) => {
  const device = await deviceService.getById(req.params.id);
  if (!device) {
    res.status(404).json({ status: 404, message: 'Device not found' });
    return;
  }
  res.json({ data: device });
});

router.post('/:id/assign', requireRole('admin', 'instructor'), validate(assignSchema), async (req: Request, res: Response) => {
  const assignment = await deviceService.assign(
    req.params.id,
    req.body.participantId,
    req.body.sessionId,
    req.user!.userId
  );
  auditService.log('device.assigned', 'device', req.params.id, req.user!.userId, {
    participantId: req.body.participantId,
  });
  res.json({ data: assignment });
});

router.post('/:id/unassign', requireRole('admin', 'instructor'), async (req: Request, res: Response) => {
  await deviceService.unassign(req.params.id);
  auditService.log('device.unassigned', 'device', req.params.id, req.user!.userId);
  res.json({ data: { success: true } });
});

router.post('/:id/ignore', requireRole('admin', 'instructor'), async (req: Request, res: Response) => {
  const ignored = req.body.ignored !== false;
  await deviceService.setIgnored(req.params.id, ignored);
  auditService.log('device.ignored', 'device', req.params.id, req.user!.userId, { ignored });
  res.json({ data: { success: true } });
});

router.delete('/:id', requireRole('admin', 'instructor'), async (req: Request, res: Response) => {
  await deviceService.archive(req.params.id);
  res.json({ data: { success: true } });
});

export default router;
