import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';
import { computeFreshnessState, computeSignalBars } from '@heartbeat/shared';

let rollupTimer: NodeJS.Timeout | null = null;

export function startRollupGenerator() {
  rollupTimer = setInterval(generateRollups, config.rollupIntervalMs);
  logger.info({ intervalMs: config.rollupIntervalMs }, 'Rollup generator started');
}

export function stopRollupGenerator() {
  if (rollupTimer) clearInterval(rollupTimer);
}

async function generateRollups() {
  try {
    // Only generate rollups for active sessions
    const activeSession = await prisma.session.findFirst({
      where: { state: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeSession) return;

    // Get all current telemetry with device assignments
    const currentTelemetry = await prisma.currentTelemetry.findMany({
      include: { device: true },
    });

    const now = new Date();
    const rollups = [];

    for (const ct of currentTelemetry) {
      if (ct.device.isIgnored || ct.device.isArchived) continue;

      // Find current assignment
      const assignment = await prisma.deviceAssignment.findFirst({
        where: { deviceId: ct.deviceId, unassignedAt: null },
      });
      if (!assignment) continue;

      // Check participant is in this session
      const sp = await prisma.sessionParticipant.findFirst({
        where: { sessionId: activeSession.id, participantId: assignment.participantId },
      });
      if (!sp) continue;

      const freshness = computeFreshnessState(ct.lastSeenAt, now);
      const signalScore = computeSignalBars(ct.smoothedRssi || -100);

      rollups.push({
        sessionId: activeSession.id,
        participantId: assignment.participantId,
        deviceId: ct.deviceId,
        capturedAt: now,
        heartRate: ct.heartRate,
        signalScore,
        freshnessState: freshness,
      });
    }

    if (rollups.length > 0) {
      await prisma.sessionTelemetryRollup.createMany({ data: rollups });
    }
  } catch (err) {
    logger.error({ err }, 'Error generating rollups');
  }
}
