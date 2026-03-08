import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext.js';
import { api } from '../api/client.js';
import type { CurrentTelemetryDTO } from '@heartbeat/shared';

export function useTelemetry() {
  const { socket } = useSocket();
  const [telemetry, setTelemetry] = useState<Map<string, CurrentTelemetryDTO>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    api.get('/telemetry/current')
      .then((res) => {
        const map = new Map<string, CurrentTelemetryDTO>();
        for (const t of res.data.data) {
          map.set(t.deviceMac, t);
        }
        setTelemetry(map);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Socket.IO updates
  useEffect(() => {
    if (!socket) return;

    const handler = (updates: CurrentTelemetryDTO[]) => {
      setTelemetry((prev) => {
        const next = new Map(prev);
        for (const t of updates) {
          next.set(t.deviceMac, t);
        }
        return next;
      });
    };

    socket.on('telemetry:update', handler);
    return () => { socket.off('telemetry:update', handler); };
  }, [socket]);

  const telemetryArray = useCallback(() => {
    return Array.from(telemetry.values());
  }, [telemetry]);

  return { telemetry, telemetryArray, isLoading };
}
