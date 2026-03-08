import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import type { AuthPayload } from '../middleware/auth.js';

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  const payload: AuthPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as string & { __brand?: never },
  } as jwt.SignOptions);

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  };
}

export function refreshToken(currentPayload: AuthPayload): string {
  return jwt.sign(
    {
      userId: currentPayload.userId,
      username: currentPayload.username,
      role: currentPayload.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as string & { __brand?: never } } as jwt.SignOptions
  );
}
