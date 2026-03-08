import { FreshnessState } from '../types/enums.js';
import {
  FRESHNESS_LIVE_MS,
  FRESHNESS_DELAYED_MS,
  FRESHNESS_STALE_MS,
} from '../constants/freshness.js';

export function computeFreshnessState(
  lastSeenAt: Date,
  now: Date = new Date()
): FreshnessState {
  const ageMs = now.getTime() - lastSeenAt.getTime();
  if (ageMs <= FRESHNESS_LIVE_MS) return FreshnessState.LIVE;
  if (ageMs <= FRESHNESS_DELAYED_MS) return FreshnessState.DELAYED;
  if (ageMs <= FRESHNESS_STALE_MS) return FreshnessState.STALE;
  return FreshnessState.OFFLINE;
}

export function isFreshnessAlertable(state: FreshnessState): boolean {
  return state === FreshnessState.STALE || state === FreshnessState.OFFLINE;
}
