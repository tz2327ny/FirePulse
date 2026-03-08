import { useState, useEffect } from 'react';
import { formatElapsed } from '../utils/formatTime.js';

/**
 * Live ticking timer that shows active session time (excluding breaks).
 * Returns a formatted HH:MM:SS string updated every second.
 */
export function useElapsedTimer(
  startedAt: string | null | undefined,
  isPaused: boolean,
  totalBreakMs: number
): string {
  const [display, setDisplay] = useState('--:--:--');

  useEffect(() => {
    if (!startedAt) {
      setDisplay('--:--:--');
      return;
    }

    const startMs = new Date(startedAt).getTime();

    const update = () => {
      const totalMs = Date.now() - startMs;
      const activeMs = totalMs - totalBreakMs;
      setDisplay(formatElapsed(activeMs));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, isPaused, totalBreakMs]);

  return display;
}
