import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import * as settingsService from '../services/settingsService.js';
import * as auditService from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

const updateSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
    })
  ),
});

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getAll();
  res.json({ data: settings });
}));

router.put('/', validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const results = await settingsService.updateMany(req.body.settings);
  auditService.log('settings.updated', 'settings', null, req.user!.userId, {
    keys: req.body.settings.map((s: { key: string }) => s.key),
  });
  res.json({ data: results });
}));

export default router;
