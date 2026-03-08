import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as receiverService from '../services/receiverService.js';

const router = Router();
router.use(authMiddleware);

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  locationLabel: z.string().max(100).optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const includeArchived = req.query.archived === 'true';
  const receivers = await receiverService.list(includeArchived);
  res.json({ data: receivers });
});

router.get('/:id', async (req: Request, res: Response) => {
  const receiver = await receiverService.getById(req.params.id);
  if (!receiver) {
    res.status(404).json({ status: 404, message: 'Receiver not found' });
    return;
  }
  res.json({ data: receiver });
});

router.put('/:id', requireRole('admin', 'instructor'), validate(updateSchema), async (req: Request, res: Response) => {
  const receiver = await receiverService.update(req.params.id, req.body);
  res.json({ data: receiver });
});

export default router;
