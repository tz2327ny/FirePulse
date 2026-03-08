import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as rehabService from '../services/rehabService.js';
import {
  RehabCheckpointType,
  CheckpointDisposition,
  VisitDisposition,
} from '@heartbeat/shared';

const router = Router();
router.use(authMiddleware);

// ---- Schemas ----

const createVisitSchema = z.object({
  sessionId: z.string().uuid(),
  participantId: z.string().uuid(),
});

const createCheckpointSchema = z.object({
  checkpointType: z.nativeEnum(RehabCheckpointType).default(RehabCheckpointType.REHAB_ROUTINE),
  manualHr: z.number().int().min(20).max(300).optional(),
  bpSystolic: z.number().int().min(50).max(300).optional(),
  bpDiastolic: z.number().int().min(20).max(200).optional(),
  respirations: z.number().int().min(0).max(100).optional(),
  spo2: z.number().int().min(0).max(100).optional(),
  temperature: z.number().min(80).max(115).optional(),
  temperatureMethod: z.string().max(20).optional(),
  note: z.string().max(2000).optional(),
  disposition: z.nativeEnum(CheckpointDisposition).optional(),
});

const closeVisitSchema = z.object({
  finalDisposition: z.nativeEnum(VisitDisposition),
});

// ---- Routes ----

// List visits for a session (admin + medical only)
router.get('/', requireRole('admin', 'medical'), async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;
  const activeOnly = req.query.activeOnly === 'true';

  if (!sessionId) {
    res.status(400).json({ message: 'sessionId query parameter is required' });
    return;
  }

  const visits = await rehabService.listBySession(sessionId, activeOnly);
  res.json({ data: visits });
});

// Get active participant IDs for a session (all roles — used by dashboard badges)
router.get('/active-participants', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;
  if (!sessionId) {
    res.status(400).json({ message: 'sessionId query parameter is required' });
    return;
  }
  const ids = await rehabService.getActiveParticipantIds(sessionId);
  res.json({ data: ids });
});

// Get a single visit (admin + medical only)
router.get('/:id', requireRole('admin', 'medical'), async (req: Request, res: Response) => {
  const visit = await rehabService.getById(req.params.id);
  if (!visit) {
    res.status(404).json({ message: 'Rehab visit not found' });
    return;
  }
  res.json({ data: visit });
});

// Create a new rehab visit
router.post('/', validate(createVisitSchema), async (req: Request, res: Response) => {
  try {
    const visit = await rehabService.createVisit(
      req.body.sessionId,
      req.body.participantId,
      req.user!.userId
    );
    res.status(201).json({ data: visit });
  } catch (err: any) {
    if (err.message?.includes('already has an active')) {
      res.status(409).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// Add a checkpoint to a visit (admin + medical only)
router.post('/:id/checkpoints', requireRole('admin', 'medical'), validate(createCheckpointSchema), async (req: Request, res: Response) => {
  try {
    const visit = await rehabService.addCheckpoint(
      req.params.id,
      req.body,
      req.user!.userId
    );
    res.json({ data: visit });
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      res.status(404).json({ message: err.message });
      return;
    }
    if (err.message?.includes('closed visit')) {
      res.status(400).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// Cancel/delete a visit (admin + medical only)
router.delete('/:id', requireRole('admin', 'medical'), async (req: Request, res: Response) => {
  try {
    const result = await rehabService.cancelVisit(req.params.id, req.user!.userId);
    res.json({ data: result });
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      res.status(404).json({ message: err.message });
      return;
    }
    if (err.message?.includes('Cannot cancel')) {
      res.status(400).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// Close a visit (admin + medical only)
router.post('/:id/close', requireRole('admin', 'medical'), validate(closeVisitSchema), async (req: Request, res: Response) => {
  try {
    const visit = await rehabService.closeVisit(
      req.params.id,
      req.body.finalDisposition,
      req.user!.userId
    );
    res.json({ data: visit });
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      res.status(404).json({ message: err.message });
      return;
    }
    if (err.message?.includes('already closed')) {
      res.status(400).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// Re-evaluate a closed visit (admin + medical only)
router.post('/:id/re-evaluate', requireRole('admin', 'medical'), async (req: Request, res: Response) => {
  try {
    const visit = await rehabService.reEvaluateVisit(
      req.params.id,
      req.user!.userId
    );
    res.status(201).json({ data: visit });
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      res.status(404).json({ message: err.message });
      return;
    }
    if (
      err.message?.includes('already has an active') ||
      err.message?.includes('Cannot re-evaluate') ||
      err.message?.includes('Only visits')
    ) {
      res.status(400).json({ message: err.message });
      return;
    }
    throw err;
  }
});

export default router;
