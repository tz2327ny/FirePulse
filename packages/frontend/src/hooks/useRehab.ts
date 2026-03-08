import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket } from '../context/SocketContext.js';
import { api } from '../api/client.js';
import type { RehabVisitDTO, CreateCheckpointRequest } from '@heartbeat/shared';

export function useRehab(sessionId?: string) {
  const { socket } = useSocket();
  const [visits, setVisits] = useState<RehabVisitDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVisits = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await api.get(`/rehab?sessionId=${sessionId}`);
      setVisits(res.data.data);
    } catch (err) {
      console.error('Failed to fetch rehab visits', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleCreated = (visit: RehabVisitDTO) => {
      if (sessionId && visit.sessionId === sessionId) {
        setVisits((prev) => [visit, ...prev]);
      }
    };

    const handleUpdated = (visit: RehabVisitDTO) => {
      setVisits((prev) => prev.map((v) => (v.id === visit.id ? visit : v)));
    };

    const handleCancelled = (data: { id: string }) => {
      setVisits((prev) => prev.filter((v) => v.id !== data.id));
    };

    socket.on('rehab:visit_created', handleCreated);
    socket.on('rehab:visit_updated', handleUpdated);
    socket.on('rehab:visit_cancelled', handleCancelled);

    return () => {
      socket.off('rehab:visit_created', handleCreated);
      socket.off('rehab:visit_updated', handleUpdated);
      socket.off('rehab:visit_cancelled', handleCancelled);
    };
  }, [socket, sessionId]);

  const activeVisits = useMemo(
    () => visits.filter((v) => !v.endedAt),
    [visits]
  );

  const closedVisits = useMemo(
    () => visits.filter((v) => v.endedAt),
    [visits]
  );

  const inRehabParticipantIds = useMemo(
    () => new Set(activeVisits.map((v) => v.participantId)),
    [activeVisits]
  );

  // Map of participantId → finalDisposition for closed visits
  // Only shows the MOST RECENT closed visit's disposition per participant.
  // If the most recent is "returned_to_training", no badge is shown (participant is back to normal).
  const rehabDispositions = useMemo(() => {
    const map = new Map<string, string>();
    const seen = new Set<string>();
    // Sort by endedAt descending so most recent disposition wins
    const sorted = [...closedVisits].sort(
      (a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime()
    );
    for (const v of sorted) {
      if (seen.has(v.participantId)) continue; // already processed most recent for this participant
      seen.add(v.participantId);
      // Only add to map if NOT "returned_to_training" (they're back to normal)
      if (v.finalDisposition && v.finalDisposition !== 'returned_to_training') {
        map.set(v.participantId, v.finalDisposition);
      }
    }
    // Don't show disposition if participant has a new active visit
    for (const pid of inRehabParticipantIds) {
      map.delete(pid);
    }
    return map;
  }, [closedVisits, inRehabParticipantIds]);

  const createVisit = useCallback(
    async (participantId: string) => {
      if (!sessionId) throw new Error('No session');
      const res = await api.post('/rehab', { sessionId, participantId });
      return res.data.data as RehabVisitDTO;
    },
    [sessionId]
  );

  const addCheckpoint = useCallback(
    async (visitId: string, data: CreateCheckpointRequest) => {
      const res = await api.post(`/rehab/${visitId}/checkpoints`, data);
      return res.data.data as RehabVisitDTO;
    },
    []
  );

  const closeVisit = useCallback(
    async (visitId: string, finalDisposition: string) => {
      const res = await api.post(`/rehab/${visitId}/close`, { finalDisposition });
      return res.data.data as RehabVisitDTO;
    },
    []
  );

  const cancelVisit = useCallback(
    async (visitId: string) => {
      await api.delete(`/rehab/${visitId}`);
    },
    []
  );

  const reEvaluateVisit = useCallback(
    async (visitId: string) => {
      const res = await api.post(`/rehab/${visitId}/re-evaluate`);
      return res.data.data as RehabVisitDTO;
    },
    []
  );

  return {
    visits,
    activeVisits,
    closedVisits,
    inRehabParticipantIds,
    rehabDispositions,
    loading,
    createVisit,
    addCheckpoint,
    closeVisit,
    cancelVisit,
    reEvaluateVisit,
    refetch: fetchVisits,
  };
}
