import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * Fire-and-forget audit log entry. Callers should NOT await this.
 * Errors are caught and logged, never propagated.
 */
export function log(
  action: string,
  entityType: string | null,
  entityId: string | null,
  userId: string | null,
  details?: Record<string, unknown>
): void {
  prisma.auditLog
    .create({
      data: {
        action,
        entityType,
        entityId,
        userId,
        details: details ? JSON.stringify(details) : null,
      },
    })
    .catch((err) => {
      logger.error({ err, action, entityType, entityId }, 'Failed to write audit log');
    });
}

export interface AuditListFilter {
  entityType?: string;
  userId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export async function list(filter: AuditListFilter = {}) {
  const { entityType, userId, from, to, page = 1, pageSize = 50 } = filter;

  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (userId) where.userId = userId;
  if (from || to) {
    where.occurredAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { displayName: true } } },
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: data.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      userId: entry.userId,
      userName: entry.user?.displayName ?? null,
      details: entry.details ? JSON.parse(entry.details as string) as Record<string, unknown> : null,
      occurredAt: entry.occurredAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}
