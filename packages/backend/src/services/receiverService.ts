import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export async function list(includeArchived = false) {
  return prisma.receiver.findMany({
    where: includeArchived ? undefined : { isArchived: false },
    orderBy: { name: 'asc' },
  });
}

export async function getById(id: string) {
  return prisma.receiver.findUnique({ where: { id } });
}

export async function update(id: string, data: { name?: string; locationLabel?: string }) {
  return prisma.receiver.update({ where: { id }, data });
}

export async function autoRegister(receiverHwId: string, name?: string) {
  const existing = await prisma.receiver.findUnique({ where: { receiverHwId } });
  if (existing) return existing;

  logger.info({ receiverHwId, name }, 'Auto-registering new receiver');
  return prisma.receiver.create({
    data: {
      receiverHwId,
      name: name || receiverHwId,
    },
  });
}

export async function updateHeartbeat(
  receiverHwId: string,
  data: {
    ipAddress?: string;
    firmwareVersion?: string;
    wifiRssi?: number;
    uptimeSeconds?: number;
  }
) {
  const receiver = await prisma.receiver.findUnique({ where: { receiverHwId } });
  if (!receiver) return null;

  const wasOffline = !receiver.isOnline;

  const updated = await prisma.receiver.update({
    where: { receiverHwId },
    data: {
      ...data,
      isOnline: true,
      lastHeartbeatAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  if (wasOffline) {
    await prisma.receiverStatusEvent.create({
      data: {
        receiverId: receiver.id,
        oldStatus: 'offline',
        newStatus: 'online',
      },
    });
    logger.info({ receiverHwId }, 'Receiver came online');
  }

  return updated;
}

export async function markOffline(receiverId: string) {
  const receiver = await prisma.receiver.findUnique({ where: { id: receiverId } });
  if (!receiver || !receiver.isOnline) return;

  await prisma.receiver.update({
    where: { id: receiverId },
    data: { isOnline: false },
  });

  await prisma.receiverStatusEvent.create({
    data: {
      receiverId,
      oldStatus: 'online',
      newStatus: 'offline',
    },
  });

  logger.info({ receiverHwId: receiver.receiverHwId }, 'Receiver went offline');
}

export async function updateLastSeen(receiverHwId: string) {
  await prisma.receiver.update({
    where: { receiverHwId },
    data: { lastSeenAt: new Date() },
  });
}
