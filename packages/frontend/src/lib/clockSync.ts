/**
 * Clock synchronization module.
 *
 * The Pi appliance has no hardware RTC and may not have NTP access
 * (standalone hotspot mode). This means the Pi's clock can drift
 * arbitrarily from the browser's clock.
 *
 * Freshness is computed client-side by comparing lastSeenAt (Pi clock)
 * against Date.now() (browser clock). Clock skew causes incorrect
 * freshness (e.g., 3 min skew → everything shows "Offline").
 *
 * This module tracks the offset between server and client clocks so
 * freshness can be computed relative to the server's time base.
 */

/** Offset in ms: serverTime - clientTime. Positive means server is ahead. */
let clockOffsetMs = 0;

/**
 * Update the clock offset from a server-provided timestamp.
 * Called on every REST response and WebSocket batch.
 */
export function updateClockOffset(serverTimeIso: string): void {
  const serverTime = new Date(serverTimeIso).getTime();
  const clientTime = Date.now();
  clockOffsetMs = serverTime - clientTime;
}

/**
 * Get the current time adjusted to the server's clock.
 * Use this instead of `new Date()` when comparing against server timestamps.
 */
export function getServerAdjustedNow(): Date {
  return new Date(Date.now() + clockOffsetMs);
}
