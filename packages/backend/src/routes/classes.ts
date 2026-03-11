import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import * as classService from '../services/classService.js';
import * as auditService from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  courseType: z.string().max(100).optional(),
  description: z.string().optional(),
  participantIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  courseType: z.string().max(100).optional(),
  description: z.string().optional(),
});

const addParticipantsSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1),
});

const assignDeviceSchema = z.object({
  deviceId: z.string().uuid(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const includeArchived = req.query.archived === 'true';
  const classes = await classService.list(includeArchived);
  res.json({
    data: classes.map((c) => ({
      ...c,
      participantCount: c._count.classParticipants,
      _count: undefined,
    })),
  });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const cls = await classService.getById(req.params.id);
  if (!cls) {
    res.status(404).json({ status: 404, message: 'Class not found' });
    return;
  }
  res.json({ data: cls });
}));

router.post('/', requireRole('admin', 'instructor'), validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const cls = await classService.create(req.body);
  auditService.log('class.created', 'class', cls.id, req.user!.userId, { name: req.body.name });
  res.status(201).json({ data: cls });
}));

router.put('/:id', requireRole('admin', 'instructor'), validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const cls = await classService.update(req.params.id, req.body);
  auditService.log('class.updated', 'class', req.params.id, req.user!.userId, {
    fields: Object.keys(req.body),
  });
  res.json({ data: cls });
}));

router.delete('/:id', requireRole('admin', 'instructor'), asyncHandler(async (req: Request, res: Response) => {
  await classService.archive(req.params.id);
  auditService.log('class.archived', 'class', req.params.id, req.user!.userId);
  res.json({ data: { success: true } });
}));

router.post('/:id/participants', requireRole('admin', 'instructor'), validate(addParticipantsSchema), asyncHandler(async (req: Request, res: Response) => {
  await classService.addParticipants(req.params.id, req.body.participantIds);
  res.json({ data: { success: true } });
}));

router.delete('/:classId/participants/:participantId', requireRole('admin', 'instructor'), asyncHandler(async (req: Request, res: Response) => {
  await classService.removeParticipant(req.params.classId, req.params.participantId);
  res.json({ data: { success: true } });
}));

// Device assignment per class-participant
router.post('/:classId/participants/:participantId/device', requireRole('admin', 'instructor'), validate(assignDeviceSchema), asyncHandler(async (req: Request, res: Response) => {
  const result = await classService.assignDevice(req.params.classId, req.params.participantId, req.body.deviceId);
  res.json({ data: result });
}));

router.delete('/:classId/participants/:participantId/device', requireRole('admin', 'instructor'), asyncHandler(async (req: Request, res: Response) => {
  const result = await classService.unassignDevice(req.params.classId, req.params.participantId);
  res.json({ data: result });
}));

// Resolved roster for dashboard (with company override applied)
router.get('/:id/roster', asyncHandler(async (req: Request, res: Response) => {
  const roster = await classService.getRosterWithDevices(req.params.id);
  res.json({ data: roster });
}));

// Update company override for a class participant
const updateCompanySchema = z.object({
  company: z.string().max(100).nullable(),
});

router.patch('/:classId/participants/:participantId/company', requireRole('admin', 'instructor'), validate(updateCompanySchema), asyncHandler(async (req: Request, res: Response) => {
  const result = await classService.updateParticipantCompany(req.params.classId, req.params.participantId, req.body.company);
  res.json({ data: result });
}));

export default router;
