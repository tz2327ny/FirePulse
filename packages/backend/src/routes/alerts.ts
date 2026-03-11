import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import * as alertService from '../services/alertService.js';
import * as auditService from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;
  const status = req.query.status as string | undefined;
  const alerts = await alertService.list(sessionId, status);
  res.json({
    data: alerts.map((a) => ({
      ...a,
      participantName: a.participant
        ? `${a.participant.firstName} ${a.participant.lastName}`
        : null,
      acknowledgedByName: a.acknowledgedBy?.displayName || null,
      participant: undefined,
      acknowledgedBy: undefined,
    })),
  });
}));

router.post('/:id/ack', asyncHandler(async (req: Request, res: Response) => {
  const alert = await alertService.acknowledge(req.params.id, req.user!.userId);
  auditService.log('alert.acknowledged', 'alert', req.params.id, req.user!.userId);
  res.json({ data: alert });
}));

export default router;
