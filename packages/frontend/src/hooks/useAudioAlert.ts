import { useCallback, useRef, useState } from 'react';

/**
 * Generates alarm tones using the Web Audio API.
 * Warning: single lower beep. Alarm: triple high beep.
 * Respects localStorage 'heartbeat_audio_alerts' setting.
 *
 * IMPORTANT: Call ensureAudioContext() during a user gesture (click)
 * to satisfy browser autoplay policy. Without this, sounds won't play.
 */
export function useAudioAlert() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  /** Must be called during a user gesture (click handler) to unlock audio */
  const ensureAudioContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().then(() => setAudioReady(true));
    } else {
      setAudioReady(true);
    }
    return ctxRef.current;
  }, []);

  const isEnabled = useCallback(() => {
    return localStorage.getItem('heartbeat_audio_alerts') !== 'false';
  }, []);

  const playTone = useCallback((frequency: number, duration: number, count: number) => {
    if (!isEnabled()) return;
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'suspended') return;

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
  }, [isEnabled]);

  const playWarning = useCallback(() => {
    playTone(440, 0.3, 1); // Single A4 beep
  }, [playTone]);

  const playAlarm = useCallback(() => {
    playTone(880, 0.2, 3); // Triple A5 beep
  }, [playTone]);

  const toggleEnabled = useCallback(() => {
    const current = localStorage.getItem('heartbeat_audio_alerts') !== 'false';
    localStorage.setItem('heartbeat_audio_alerts', String(!current));
    // When enabling, init AudioContext during this user gesture
    if (!current) {
      ensureAudioContext();
    }
    return !current;
  }, [ensureAudioContext]);

  /** Play a short test beep — also initializes audio context during user gesture */
  const playTestTone = useCallback(() => {
    ensureAudioContext();
    setTimeout(() => playTone(660, 0.15, 1), 50);
  }, [ensureAudioContext, playTone]);

  return { playWarning, playAlarm, isEnabled, toggleEnabled, playTestTone, audioReady, ensureAudioContext };
}
