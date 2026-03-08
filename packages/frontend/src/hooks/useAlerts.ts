import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext.js';
import { api } from '../api/client.js';
import type { AlertDTO } from '@heartbeat/shared';
import { useAudioAlert } from './useAudioAlert.js';

export function useAlerts(sessionId?: string) {
  const { socket } = useSocket();
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const { playWarning, playAlarm } = useAudioAlert();

  const fetchAlerts = useCallback(async () => {
    const params = new URLSearchParams();
    if (sessionId) params.set('sessionId', sessionId);
    const res = await api.get(`/alerts?${params}`);
    setAlerts(res.data.data);
  }, [sessionId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    if (!socket) return;

    const handleNew = (alert: AlertDTO) => {
      setAlerts((prev) => [alert, ...prev]);
      // Play audio tone for new alerts
      if (alert.alertLevel === 'alarm') {
        playAlarm();
      } else if (alert.alertLevel === 'warning') {
        playWarning();
      }
    };

    const handleUpdated = (alert: AlertDTO) => {
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? alert : a)));
    };

    socket.on('alert:new', handleNew);
    socket.on('alert:updated', handleUpdated);

    return () => {
      socket.off('alert:new', handleNew);
      socket.off('alert:updated', handleUpdated);
    };
  }, [socket]);

  const acknowledge = useCallback(async (alertId: string) => {
    await api.post(`/alerts/${alertId}/ack`);
    fetchAlerts();
  }, [fetchAlerts]);

  const activeAlerts = alerts.filter((a) => a.status === 'active');

  return { alerts, activeAlerts, acknowledge, refetch: fetchAlerts };
}
