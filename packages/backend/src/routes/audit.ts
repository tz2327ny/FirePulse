import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as auditService from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/', async (req: Request, res: Response) => {
  const filter: auditService.AuditListFilter = {};

  if (req.query.entityType) filter.entityType = req.query.entityType as string;
  if (req.query.userId) filter.userId = req.query.userId as string;
  if (req.query.from) filter.from = new Date(req.query.from as string);
  if (req.query.to) filter.to = new Date(req.query.to as string);
  if (req.query.page) filter.page = parseInt(req.query.page as string, 10);
  if (req.query.pageSize) filter.pageSize = parseInt(req.query.pageSize as string, 10);

  const result = await auditService.list(filter);
  res.json(result);
});

export default router;
