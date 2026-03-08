import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { Socket } from 'socket.io';
import type { AuthPayload } from '../middleware/auth.js';

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    socket.data.userId = payload.userId;
    socket.data.username = payload.username;
    socket.data.role = payload.role;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}
