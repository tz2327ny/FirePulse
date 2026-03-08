import { prisma } from '../lib/prisma.js';
import { eventBus } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';
import * as receiverService from '../services/receiverService.js';
import { STALE_SWEEP_INTERVAL_MS, RECEIVER_HEARTBEAT_TIMEOUT_MS } from '@heartbeat/shared';

let sweepTimer: NodeJS.Timeout | null = null;

export function startStaleSweeper() {
  sweepTimer = setInterval(sweep, STALE_SWEEP_INTERVAL_MS);
  logger.info({ intervalMs: STALE_SWEEP_INTERVAL_MS }, 'Stale sweeper started');
}

export function stopStaleSweeper() {
  if (sweepTimer) clearInterval(sweepTimer);
}

async function sweep() {
  try {
    // Mark receivers as offline if no heartbeat within timeout
    const cutoff = new Date(Date.now() - RECEIVER_HEARTBEAT_TIMEOUT_MS);
    const staleReceivers = await prisma.receiver.findMany({
      where: {
        isOnline: true,
        lastHeartbeatAt: { lt: cutoff },
      },
    });

    for (const receiver of staleReceivers) {
      await receiverService.markOffline(receiver.id);
      eventBus.emit('receiver:status', {
        ...receiver,
        isOnline: false,
      });
    }
  } catch (err) {
    logger.error({ err }, 'Error in stale sweeper');
  }
}
