import { prisma } from '../lib/prisma.js';
import { eventBus } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';
import {
  computeFreshnessState,
  computeSignalBars,
  macToShortId,
} from '@heartbeat/shared';
import type { CurrentTelemetryDTO } from '@heartbeat/shared';

// Write buffer for raw telemetry
interface RawTelemetryInput {
  receiverHwId: string;
  deviceMac: string;
  deviceName: string | null;
  heartRate: number | null;
  rssi: number;
  rawPayload: string | null;
  packetTimestamp: Date;
}

let writeBuffer: RawTelemetryInput[] = [];
let flushTimer: NodeJS.Timeout | null = null;

export function startWriteBuffer() {
  flushTimer = setInterval(flushWriteBuffer, config.writeBufferFlushMs);
}

export function stopWriteBuffer() {
  if (flushTimer) clearInterval(flushTimer);
  flushWriteBuffer(); // flush remaining
}

async function flushWriteBuffer() {
  if (writeBuffer.length === 0) return;
  const batch = writeBuffer.splice(0);
  try {
    await prisma.rawTelemetry.createMany({ data: batch });
  } catch (err) {
    logger.error({ err, count: batch.length }, 'Failed to flush raw telemetry batch');
  }
}

export function bufferRawTelemetry(input: RawTelemetryInput) {
  writeBuffer.push(input);
}

export async function processTelemetry(
  receiverHwId: string,
  deviceMac: string,
  deviceName: string | null,
  heartRate: number | null,
  rssi: number,
  rawPayload: string | null,
  packetTimestamp: Date
) {
  // 1. Buffer raw insert
  bufferRawTelemetry({
    receiverHwId,
    deviceMac,
    deviceName,
    heartRate,
    rssi,
    rawPayload,
    packetTimestamp,
  });

  // 2. Auto-register device if unknown
  let device = await prisma.device.findUnique({ where: { macAddress: deviceMac } });
  if (!device) {
    device = await prisma.device.create({
      data: {
        macAddress: deviceMac,
        shortId: macToShortId(deviceMac),
        deviceName: deviceName || null,
        deviceType: 'unknown',
      },
    });
    logger.info({ deviceMac, shortId: device.shortId }, 'Auto-registered new device');
  }

  // 3. Merge: query raw packets in merge window
  const mergeWindowStart = new Date(Date.now() - config.mergeWindowMs);
  const recentPackets = await prisma.rawTelemetry.findMany({
    where: {
      deviceMac,
      receivedAt: { gte: mergeWindowStart },
    },
    orderBy: { rssi: 'desc' }, // best RSSI first
  });

  // Best packet (highest RSSI)
  const bestPacket = recentPackets[0];
  const receiverCount = new Set(recentPackets.map((p) => p.receiverHwId)).size;
  const windowDurationSec = config.mergeWindowMs / 1000;
  const packetRate = recentPackets.length / windowDurationSec;

  const mergedHr = bestPacket?.heartRate ?? heartRate;
  const mergedRssi = bestPacket?.rssi ?? rssi;
  const bestReceiver = bestPacket?.receiverHwId ?? receiverHwId;
  const freshness = computeFreshnessState(new Date());

  // 4. Upsert current telemetry
  await prisma.currentTelemetry.upsert({
    where: { deviceMac },
    create: {
      deviceId: device.id,
      deviceMac,
      heartRate: mergedHr,
      smoothedRssi: mergedRssi,
      bestReceiverHwId: bestReceiver,
      receiverCount,
      packetRate,
      lastSeenAt: new Date(),
      freshnessState: freshness,
    },
    update: {
      heartRate: mergedHr,
      smoothedRssi: mergedRssi,
      bestReceiverHwId: bestReceiver,
      receiverCount,
      packetRate,
      lastSeenAt: new Date(),
      freshnessState: freshness,
    },
  });

  // 5. Publish update via Redis
  const dto = await buildCurrentTelemetryDTO(deviceMac);
  if (dto) {
    eventBus.emit('telemetry:updates', dto);
  }
}

export async function buildCurrentTelemetryDTO(
  deviceMac: string
): Promise<CurrentTelemetryDTO | null> {
  const ct = await prisma.currentTelemetry.findUnique({
    where: { deviceMac },
    include: { device: true },
  });
  if (!ct) return null;

  // Find current assignment
  const assignment = await prisma.deviceAssignment.findFirst({
    where: { deviceId: ct.deviceId, unassignedAt: null },
    include: { participant: true },
  });

  // Find participant status in active session
  let participantStatus: string | null = null;
  let sessionParticipantId: string | null = null;
  if (assignment) {
    const activeSession = await prisma.session.findFirst({
      where: { state: { in: ['standby', 'active', 'paused'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (activeSession) {
      const sp = await prisma.sessionParticipant.findFirst({
        where: { sessionId: activeSession.id, participantId: assignment.participantId },
      });
      participantStatus = sp?.status || null;
      sessionParticipantId = sp?.id || null;
    }
  }

  // Look up receiver name
  let bestReceiverName: string | null = null;
  if (ct.bestReceiverHwId) {
    const receiver = await prisma.receiver.findUnique({
      where: { receiverHwId: ct.bestReceiverHwId },
      select: { name: true },
    });
    bestReceiverName = receiver?.name || null;
  }

  const freshness = computeFreshnessState(ct.lastSeenAt);
  const signalBars = computeSignalBars(ct.smoothedRssi || -100, ct.packetRate, ct.receiverCount);

  return {
    deviceMac: ct.deviceMac,
    shortId: ct.device.shortId,
    deviceName: ct.device.deviceName,
    heartRate: ct.heartRate,
    smoothedRssi: ct.smoothedRssi,
    bestReceiverHwId: ct.bestReceiverHwId,
    bestReceiverName,
    receiverCount: ct.receiverCount,
    packetRate: ct.packetRate,
    lastSeenAt: ct.lastSeenAt.toISOString(),
    freshnessState: freshness,
    signalBars,
    participantId: assignment?.participantId || null,
    participantFirstName: assignment?.participant?.firstName || null,
    participantLastName: assignment?.participant?.lastName || null,
    participantCompany: assignment?.participant?.company || null,
    participantStatus,
    sessionParticipantId,
  };
}

export async function getAllCurrentTelemetry(): Promise<CurrentTelemetryDTO[]> {
  const allCt = await prisma.currentTelemetry.findMany({
    include: { device: true },
  });

  const results: CurrentTelemetryDTO[] = [];
  for (const ct of allCt) {
    if (ct.device.isIgnored || ct.device.isArchived) continue;
    const dto = await buildCurrentTelemetryDTO(ct.deviceMac);
    if (dto) results.push(dto);
  }
  return results;
}

export async function getRawTelemetry(params: {
  deviceMac?: string;
  page?: number;
  pageSize?: number;
}) {
  const { deviceMac, page = 1, pageSize = 50 } = params;
  const where = deviceMac ? { deviceMac } : {};

  const [data, total] = await Promise.all([
    prisma.rawTelemetry.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rawTelemetry.count({ where }),
  ]);

  return { data, total, page, pageSize };
}
