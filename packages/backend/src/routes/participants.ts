import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import * as participantService from '../services/participantService.js';
import * as auditService from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  company: z.string().min(1).max(100),
});

const updateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  company: z.string().min(1).max(100).optional(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const activeOnly = req.query.active === 'true';
  const participants = await participantService.list(activeOnly);
  res.json({ data: participants });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const participant = await participantService.getById(req.params.id);
  if (!participant) {
    res.status(404).json({ status: 404, message: 'Participant not found' });
    return;
  }
  res.json({ data: participant });
}));

router.post('/', requireRole('admin', 'instructor'), validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const participant = await participantService.create(req.body);
  auditService.log('participant.created', 'participant', participant.id, req.user!.userId, {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
  });
  res.status(201).json({ data: participant });
}));

router.put('/:id', requireRole('admin', 'instructor'), validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const participant = await participantService.update(req.params.id, req.body);
  auditService.log('participant.updated', 'participant', req.params.id, req.user!.userId, {
    fields: Object.keys(req.body),
  });
  res.json({ data: participant });
}));

router.delete('/:id', requireRole('admin', 'instructor'), asyncHandler(async (req: Request, res: Response) => {
  await participantService.archive(req.params.id);
  auditService.log('participant.archived', 'participant', req.params.id, req.user!.userId);
  res.json({ data: { success: true } });
}));

export default router;
