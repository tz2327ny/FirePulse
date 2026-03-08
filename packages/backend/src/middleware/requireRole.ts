import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory that restricts access to users with specific roles.
 * Must be used after authMiddleware (which populates req.user).
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ status: 403, message: 'Forbidden: insufficient role' });
      return;
    }
    next();
  };
}
