import { useCallback, useRef } from 'react';

/**
 * Generates alarm tones using the Web Audio API.
 * Warning: single lower beep. Alarm: triple high beep.
 * Respects localStorage 'heartbeat_audio_alerts' setting.
 */
export function useAudioAlert() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const isEnabled = useCallback(() => {
    return localStorage.getItem('heartbeat_audio_alerts') !== 'false';
  }, []);

  const playTone = useCallback((frequency: number, duration: number, count: number) => {
    if (!isEnabled()) return;
    const ctx = getContext();
    if (ctx.state === 'suspended') ctx.resume();

    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = frequency;
      osc.type = 'sine';

      const startTime = ctx.currentTime + i * (duration + 0.1);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
    }
  }, [getContext, isEnabled]);

  const playWarning = useCallback(() => {
    playTone(440, 0.3, 1); // Single A4 beep
  }, [playTone]);

  const playAlarm = useCallback(() => {
    playTone(880, 0.2, 3); // Triple A5 beep
  }, [playTone]);

  const toggleEnabled = useCallback(() => {
    const current = localStorage.getItem('heartbeat_audio_alerts') !== 'false';
    localStorage.setItem('heartbeat_audio_alerts', String(!current));
    return !current;
  }, []);

  return { playWarning, playAlarm, isEnabled, toggleEnabled };
}
