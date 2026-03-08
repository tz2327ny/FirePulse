import { useEffect, useState } from 'react';
import { computeFreshnessState, type FreshnessState } from '@heartbeat/shared';

export function useFreshness(lastSeenAt: string | null | undefined): FreshnessState {
  const [state, setState] = useState<FreshnessState>(() =>
    lastSeenAt ? computeFreshnessState(new Date(lastSeenAt)) : ('offline' as FreshnessState)
  );

  useEffect(() => {
    if (!lastSeenAt) {
      setState('offline' as FreshnessState);
      return;
    }

    const update = () => setState(computeFreshnessState(new Date(lastSeenAt)));
    update();

    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lastSeenAt]);

  return state;
}

export function useFreshnessMap(
  items: Array<{ deviceMac: string; lastSeenAt: string }>
): Map<string, FreshnessState> {
  const [states, setStates] = useState<Map<string, FreshnessState>>(new Map());

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const map = new Map<string, FreshnessState>();
      for (const item of items) {
        map.set(item.deviceMac, computeFreshnessState(new Date(item.lastSeenAt), now));
      }
      setStates(map);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [items]);

  return states;
}
