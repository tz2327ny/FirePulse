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

// ── In-memory caches ─────────────────────────────────────────────────

/** Cache of known devices by MAC address */
const deviceCache = new Map<string, { id: string; shortId: string; deviceName: string | null; isIgnored: boolean; isArchived: boolean }>();

/** In-memory current telemetry state — the single source of truth between DB flushes */
interface InMemoryCT {
  deviceId: string;
  deviceMac: string;
  heartRate: number | null;
  smoothedRssi: number | null;
  bestReceiverHwId: string;
  receiverCount: number;
  packetRate: number;
  lastSeenAt: Date;
  freshnessState: string;
  dirty: boolean; // needs DB write
}
const currentTelemetryCache = new Map<string, InMemoryCT>();

/** Track which receivers have been seen per device in a sliding window */
const recentReceivers = new Map<string, Map<string, number>>(); // deviceMac -> (receiverHwId -> lastSeen timestamp)

/** Track packet counts for packetRate computation */
const packetCounts = new Map<string, number>(); // deviceMac -> packets in current window

/** Cached device assignments: deviceId -> participant + session info */
interface CachedAssignment {
  participantId: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  participantStatus: string | null;
  sessionParticipantId: string | null;
}
const assignmentCache = new Map<string, CachedAssignment>(); // deviceId -> assignment
let assignmentCacheTimer: NodeJS.Timeout | null = null;

/** Refresh the assignment cache from DB (runs every 5s) */
async function refreshAssignmentCache() {
  try {
    // Get all active assignments
    const assignments = await prisma.deviceAssignment.findMany({
      where: { unassignedAt: null },
      include: { participant: true },
    });

    // Find active session for participant status lookup
    const activeSession = await prisma.session.findFirst({
      where: { state: { in: ['standby', 'active', 'paused'] } },
      orderBy: { createdAt: 'desc' },
    });

    let sessionParticipants: Map<string, { id: string; status: string }> = new Map();
    if (activeSession) {
      const sps = await prisma.sessionParticipant.findMany({
        where: { sessionId: activeSession.id },
        select: { id: true, participantId: true, status: true },
      });
      sessionParticipants = new Map(sps.map((sp) => [sp.participantId, { id: sp.id, status: sp.status }]));
    }

    // Rebuild cache
    assignmentCache.clear();
    for (const a of assignments) {
      const sp = sessionParticipants.get(a.participantId);
      assignmentCache.set(a.deviceId, {
        participantId: a.participantId,
        firstName: a.participant.firstName,
        lastName: a.participant.lastName,
        company: a.participant.company,
        participantStatus: sp?.status || null,
        sessionParticipantId: sp?.id || null,
      });
    }
  } catch (err) {
    logger.error({ err }, 'Failed to refresh assignment cache');
  }
}

export function startAssignmentCache() {
  refreshAssignmentCache(); // initial load
  assignmentCacheTimer = setInterval(refreshAssignmentCache, 5000);
}

export function stopAssignmentCache() {
  if (assignmentCacheTimer) clearInterval(assignmentCacheTimer);
}

// ── Raw telemetry write buffer (already batched) ─────────────────────

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
  flushWriteBuffer();
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

// ── WebSocket emission throttle (every 250ms) ────────────────────────
// Instead of emitting 40-60 events/sec (one per UDP packet), batch into
// 4 updates/sec to avoid overwhelming Socket.IO and React rendering.

const wsEmitDirty = new Set<string>(); // deviceMacs needing WS emission
let wsEmitTimer: NodeJS.Timeout | null = null;

export function startWsEmitThrottle() {
  wsEmitTimer = setInterval(flushWsEmissions, 250);
}

export function stopWsEmitThrottle() {
  if (wsEmitTimer) clearInterval(wsEmitTimer);
  flushWsEmissions();
}

function flushWsEmissions() {
  if (wsEmitDirty.size === 0) return;
  const dtos: CurrentTelemetryDTO[] = [];
  for (const mac of wsEmitDirty) {
    const dto = buildDTOFromMemory(mac);
    if (dto) dtos.push(dto);
  }
  wsEmitDirty.clear();
  if (dtos.length > 0) {
    eventBus.emit('telemetry:batch', dtos);
  }
}

// ── Packet rate computation (every 2s) ───────────────────────────────

let packetRateTimer: NodeJS.Timeout | null = null;

export function startPacketRateCalc() {
  packetRateTimer = setInterval(computePacketRates, 2000);
}

export function stopPacketRateCalc() {
  if (packetRateTimer) clearInterval(packetRateTimer);
}

function computePacketRates() {
  for (const [mac, count] of packetCounts) {
    const rate = count / 2; // packets per second (2s window)
    const ct = currentTelemetryCache.get(mac);
    if (ct) {
      ct.packetRate = rate;
      ct.dirty = true;
    }
  }
  packetCounts.clear();
}

// ── Current telemetry DB flush (every 2s) ────────────────────────────

let ctFlushTimer: NodeJS.Timeout | null = null;

export function startCurrentTelemetryFlush() {
  ctFlushTimer = setInterval(flushCurrentTelemetry, 2000);
}

export function stopCurrentTelemetryFlush() {
  if (ctFlushTimer) clearInterval(ctFlushTimer);
  flushCurrentTelemetry();
}

async function flushCurrentTelemetry() {
  const dirtyEntries = [...currentTelemetryCache.values()].filter((ct) => ct.dirty);
  if (dirtyEntries.length === 0) return;

  // Mark all as clean before async write (new packets during write will re-dirty)
  for (const entry of dirtyEntries) {
    entry.dirty = false;
  }

  try {
    // Use a transaction for all upserts to minimize SQLite lock contention
    await prisma.$transaction(
      dirtyEntries.map((ct) =>
        prisma.currentTelemetry.upsert({
          where: { deviceMac: ct.deviceMac },
          create: {
            deviceId: ct.deviceId,
            deviceMac: ct.deviceMac,
            heartRate: ct.heartRate,
            smoothedRssi: ct.smoothedRssi,
            bestReceiverHwId: ct.bestReceiverHwId,
            receiverCount: ct.receiverCount,
            packetRate: ct.packetRate,
            lastSeenAt: ct.lastSeenAt,
            freshnessState: ct.freshnessState,
          },
          update: {
            heartRate: ct.heartRate,
            smoothedRssi: ct.smoothedRssi,
            bestReceiverHwId: ct.bestReceiverHwId,
            receiverCount: ct.receiverCount,
            packetRate: ct.packetRate,
            lastSeenAt: ct.lastSeenAt,
            freshnessState: ct.freshnessState,
          },
        })
      )
    );
  } catch (err) {
    logger.error({ err, count: dirtyEntries.length }, 'Failed to flush current telemetry');
    // Re-mark as dirty so next flush retries
    for (const entry of dirtyEntries) {
      entry.dirty = true;
    }
  }
}

// ── Main telemetry processing (mostly in-memory now) ─────────────────

export async function processTelemetry(
  receiverHwId: string,
  deviceMac: string,
  deviceName: string | null,
  heartRate: number | null,
  rssi: number,
  rawPayload: string | null,
  packetTimestamp: Date
) {
  // 1. Buffer raw insert (already batched)
  bufferRawTelemetry({
    receiverHwId,
    deviceMac,
    deviceName,
    heartRate,
    rssi,
    rawPayload,
    packetTimestamp,
  });

  // 2. Auto-register device if unknown (cached)
  let device = deviceCache.get(deviceMac);
  if (!device) {
    let dbDevice = await prisma.device.findUnique({ where: { macAddress: deviceMac } });
    if (!dbDevice) {
      dbDevice = await prisma.device.create({
        data: {
          macAddress: deviceMac,
          shortId: macToShortId(deviceMac),
          deviceName: deviceName || null,
          deviceType: 'unknown',
        },
      });
      logger.info({ deviceMac, shortId: dbDevice.shortId }, 'Auto-registered new device');
    }
    device = {
      id: dbDevice.id,
      shortId: dbDevice.shortId,
      deviceName: dbDevice.deviceName,
      isIgnored: dbDevice.isIgnored,
      isArchived: dbDevice.isArchived,
    };
    deviceCache.set(deviceMac, device);
  }

  // 3. Track receivers in sliding window (in-memory)
  const now = Date.now();
  if (!recentReceivers.has(deviceMac)) {
    recentReceivers.set(deviceMac, new Map());
  }
  const receivers = recentReceivers.get(deviceMac)!;
  receivers.set(receiverHwId, now);

  // Clean old entries (> merge window)
  for (const [rid, ts] of receivers) {
    if (now - ts > config.mergeWindowMs) {
      receivers.delete(rid);
    }
  }

  const receiverCount = receivers.size;
  const freshness = computeFreshnessState(new Date());

  // 4. Update in-memory current telemetry (NO DB HIT)
  const existing = currentTelemetryCache.get(deviceMac);
  const isBetterRssi = !existing || rssi > (existing.smoothedRssi || -100);
  const isSameReceiver = existing?.bestReceiverHwId === receiverHwId;
  const shouldUpdate = isBetterRssi || isSameReceiver;

  currentTelemetryCache.set(deviceMac, {
    deviceId: device.id,
    deviceMac,
    heartRate: shouldUpdate ? heartRate : (existing?.heartRate ?? heartRate),
    smoothedRssi: shouldUpdate ? rssi : (existing?.smoothedRssi ?? rssi),
    bestReceiverHwId: isBetterRssi ? receiverHwId : (existing?.bestReceiverHwId ?? receiverHwId),
    receiverCount,
    packetRate: 0, // will be computed if needed
    lastSeenAt: new Date(),
    freshnessState: freshness,
    dirty: true,
  });

  // 5. Track packet count for rate computation
  packetCounts.set(deviceMac, (packetCounts.get(deviceMac) || 0) + 1);

  // 6. Mark for throttled WebSocket emission (batched every 250ms)
  wsEmitDirty.add(deviceMac);
}

// ── Build DTO from in-memory cache (no DB queries) ───────────────────

function buildDTOFromMemory(deviceMac: string): CurrentTelemetryDTO | null {
  const ct = currentTelemetryCache.get(deviceMac);
  const device = deviceCache.get(deviceMac);
  if (!ct || !device) return null;

  const freshness = computeFreshnessState(ct.lastSeenAt);
  const signalBars = computeSignalBars(ct.smoothedRssi || -100);

  // Look up cached assignment for this device
  const assignment = assignmentCache.get(device.id);

  return {
    deviceMac: ct.deviceMac,
    shortId: device.shortId,
    deviceName: device.deviceName,
    heartRate: ct.heartRate,
    smoothedRssi: ct.smoothedRssi,
    bestReceiverHwId: ct.bestReceiverHwId,
    bestReceiverName: null, // skip receiver name lookup for performance
    receiverCount: ct.receiverCount,
    packetRate: ct.packetRate,
    lastSeenAt: ct.lastSeenAt.toISOString(),
    freshnessState: freshness,
    signalBars,
    participantId: assignment?.participantId || null,
    participantFirstName: assignment?.firstName || null,
    participantLastName: assignment?.lastName || null,
    participantCompany: assignment?.company || null,
    participantStatus: assignment?.participantStatus || null,
    sessionParticipantId: assignment?.sessionParticipantId || null,
  };
}

// ── Full DTO builder (for API responses, hits DB for assignments) ────

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
  const signalBars = computeSignalBars(ct.smoothedRssi || -100);

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

export async function getAllCurrentTelemetry(sessionId?: string): Promise<CurrentTelemetryDTO[]> {
  // If filtering by session, get participant IDs for that session
  let sessionParticipantIds: Set<string> | null = null;
  if (sessionId) {
    const sps = await prisma.sessionParticipant.findMany({
      where: { sessionId },
      select: { participantId: true },
    });
    sessionParticipantIds = new Set(sps.map((sp) => sp.participantId));
  }

  // If we have in-memory data, serve from there (much faster)
  if (currentTelemetryCache.size > 0) {
    const results: CurrentTelemetryDTO[] = [];
    for (const [mac] of currentTelemetryCache) {
      const device = deviceCache.get(mac);
      if (device?.isIgnored || device?.isArchived) continue;
      const dto = buildDTOFromMemory(mac);
      if (dto) {
        // Filter by session participants if sessionId provided
        if (sessionParticipantIds && dto.participantId && !sessionParticipantIds.has(dto.participantId)) continue;
        if (sessionParticipantIds && !dto.participantId) continue;
        results.push(dto);
      }
    }
    return results;
  }

  // Fallback to DB
  const allCt = await prisma.currentTelemetry.findMany({
    include: { device: true },
  });

  const results: CurrentTelemetryDTO[] = [];
  for (const ct of allCt) {
    if (ct.device.isIgnored || ct.device.isArchived) continue;
    const dto = await buildCurrentTelemetryDTO(ct.deviceMac);
    if (dto) {
      if (sessionParticipantIds && dto.participantId && !sessionParticipantIds.has(dto.participantId)) continue;
      if (sessionParticipantIds && !dto.participantId) continue;
      results.push(dto);
    }
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
