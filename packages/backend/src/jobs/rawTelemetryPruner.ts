import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';
import { RAW_PRUNE_INTERVAL_MS } from '@heartbeat/shared';

let pruneTimer: NodeJS.Timeout | null = null;

export function startRawTelemetryPruner() {
  pruneTimer = setInterval(prune, RAW_PRUNE_INTERVAL_MS);
  logger.info({ intervalMs: RAW_PRUNE_INTERVAL_MS, retentionHours: config.rawTelemetryRetentionHours }, 'Raw telemetry pruner started');
}

export function stopRawTelemetryPruner() {
  if (pruneTimer) clearInterval(pruneTimer);
}

async function prune() {
  try {
    const cutoff = new Date(Date.now() - config.rawTelemetryRetentionHours * 3600 * 1000);
    const result = await prisma.rawTelemetry.deleteMany({
      where: { receivedAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      logger.info({ deleted: result.count, olderThan: cutoff.toISOString() }, 'Pruned raw telemetry');
    }
  } catch (err) {
    logger.error({ err }, 'Error pruning raw telemetry');
  }
}
