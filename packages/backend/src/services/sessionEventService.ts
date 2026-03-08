import { prisma } from '../lib/prisma.js';

export async function log(data: {
  sessionId: string;
  eventType: string;
  participantId?: string;
  deviceId?: string;
  receiverId?: string;
  userId?: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.sessionEvent.create({
    data: {
      sessionId: data.sessionId,
      eventType: data.eventType,
      participantId: data.participantId || null,
      deviceId: data.deviceId || null,
      receiverId: data.receiverId || null,
      userId: data.userId || null,
      payloadJson: data.payload ? JSON.stringify(data.payload) : null,
    },
  });
}

export async function listBySession(sessionId: string, limit = 100) {
  const events = await prisma.sessionEvent.findMany({
    where: { sessionId },
    orderBy: { occurredAt: 'desc' },
    take: limit,
    include: {
      user: { select: { displayName: true } },
      participant: { select: { firstName: true, lastName: true } },
      device: { select: { macAddress: true, shortId: true } },
    },
  });

  return events.map((e) => ({
    id: e.id,
    sessionId: e.sessionId,
    eventType: e.eventType,
    participantName: e.participant ? `${e.participant.firstName} ${e.participant.lastName}` : null,
    deviceMac: e.device?.macAddress || null,
    receiverName: null,
    userName: e.user?.displayName || null,
    payloadJson: e.payloadJson ? JSON.parse(e.payloadJson as string) as Record<string, unknown> : null,
    occurredAt: e.occurredAt.toISOString(),
  }));
}
