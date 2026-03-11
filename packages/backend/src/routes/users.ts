import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pkg from '@prisma/client';
const { Prisma } = pkg;
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import * as userService from '../services/userService.js';
import * as auditService from '../services/auditService.js';
import { UserRole } from '@heartbeat/shared';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

const createSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(6).max(100),
  displayName: z.string().min(1).max(100),
  role: z.nativeEnum(UserRole),
});

const updateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  password: z.string().min(6).max(100).optional(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const activeOnly = req.query.active === 'true';
  const users = await userService.list(activeOnly);
  res.json({ data: users });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getById(req.params.id);
  if (!user) {
    res.status(404).json({ status: 404, message: 'User not found' });
    return;
  }
  res.json({ data: user });
}));

router.post('/', validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = await userService.create(req.body);
    auditService.log('user.created', 'user', user.id, req.user!.userId, {
      username: user.username,
      role: user.role,
    });
    res.status(201).json({ data: user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ status: 409, message: 'Username already exists' });
      return;
    }
    throw err;
  }
}));

router.put('/:id', validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.update(req.params.id, req.body);
  auditService.log('user.updated', 'user', user.id, req.user!.userId, {
    fields: Object.keys(req.body).filter((k) => k !== 'password'),
    passwordChanged: !!req.body.password,
  });
  res.json({ data: user });
}));

router.post('/:id/reactivate', asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.reactivate(req.params.id);
  auditService.log('user.reactivated', 'user', user.id, req.user!.userId, {
    username: user.username,
  });
  res.json({ data: user });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === req.user!.userId) {
    res.status(400).json({ status: 400, message: 'Cannot deactivate your own account' });
    return;
  }
  const user = await userService.deactivate(req.params.id);
  auditService.log('user.deactivated', 'user', user.id, req.user!.userId, {
    username: user.username,
  });
  res.json({ data: { success: true } });
}));

export default router;
