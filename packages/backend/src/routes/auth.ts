import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import * as authService from '../services/authService.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const result = await authService.login(username, password);
  if (!result) {
    res.status(401).json({ status: 401, message: 'Invalid credentials' });
    return;
  }
  res.json({ data: result });
});

router.post('/refresh', authMiddleware, (req: Request, res: Response) => {
  const token = authService.refreshToken(req.user!);
  res.json({ data: { token } });
});

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, username: true, displayName: true, role: true },
  });
  if (!user) {
    res.status(404).json({ status: 404, message: 'User not found' });
    return;
  }
  res.json({ data: user });
});

export default router;
