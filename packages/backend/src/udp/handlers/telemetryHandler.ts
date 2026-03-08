import type { TelemetryPacket } from '../packetParser.js';
import * as telemetryService from '../../services/telemetryService.js';
import * as receiverService from '../../services/receiverService.js';
import { logger } from '../../lib/logger.js';

// ── Caches to avoid per-packet DB queries ────────────────────────────

/** Set of known receiver IDs (already registered) */
const knownReceivers = new Set<string>();

/** Debounced receiver lastSeen updates: receiverHwId -> last flush time */
const receiverLastSeenDebounce = new Map<string, number>();
const RECEIVER_LAST_SEEN_INTERVAL_MS = 10_000; // Only update DB every 10s per receiver

export async function handleTelemetryPacket(packet: TelemetryPacket) {
  try {
    // Auto-register receiver (cached — only hits DB once per receiver)
    if (!knownReceivers.has(packet.receiver_id)) {
      await receiverService.autoRegister(packet.receiver_id, packet.receiver_name);
      knownReceivers.add(packet.receiver_id);
    }

    // Debounce receiver lastSeen updates (every 10s instead of every packet)
    const now = Date.now();
    const lastFlushed = receiverLastSeenDebounce.get(packet.receiver_id) || 0;
    if (now - lastFlushed > RECEIVER_LAST_SEEN_INTERVAL_MS) {
      receiverLastSeenDebounce.set(packet.receiver_id, now);
      // Fire and forget — don't await
      receiverService.updateLastSeen(packet.receiver_id).catch(() => {});
    }

    // Process telemetry (now mostly in-memory)
    await telemetryService.processTelemetry(
      packet.receiver_id,
      packet.device_mac.toUpperCase(),
      packet.device_name || null,
      packet.heart_rate,
      packet.rssi,
      packet.raw_advertisement_data || null,
      new Date(packet.timestamp)
    );

    // NOTE: Alert checking is skipped in the hot path for performance.
    // Alerts should be evaluated in a periodic job or on the current_telemetry
    // flush cycle, not on every single packet.

  } catch (err) {
    logger.error({ err, packet: packet.device_mac }, 'Error processing telemetry packet');
  }
}
