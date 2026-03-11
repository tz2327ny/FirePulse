import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client.js';
import type { ClassDTO, ClassRosterItemDTO, SessionDTO } from '@heartbeat/shared';

const STORAGE_KEY = 'firepulse_selected_class_id';

export function useClassContext() {
  const [classes, setClasses] = useState<ClassDTO[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );
  const [selectedClass, setSelectedClass] = useState<ClassDTO | null>(null);
  const [roster, setRoster] = useState<ClassRosterItemDTO[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  // Fetch class list on mount
  useEffect(() => {
    api.get('/classes')
      .then((res) => setClasses(res.data.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // When selectedClassId changes, fetch roster + check for matching session
  useEffect(() => {
    if (!selectedClassId) {
      setSelectedClass(null);
      setRoster([]);
      setCurrentSession(null);
      setIsSessionLoaded(true);
      return;
    }

    // Find class in loaded list
    const cls = classes.find((c) => c.id === selectedClassId);
    setSelectedClass(cls || null);

    // Fetch roster
    api.get(`/classes/${selectedClassId}/roster`)
      .then((res) => setRoster(res.data.data))
      .catch(() => setRoster([]));

    // Fetch current session and check if it belongs to this class
    setIsSessionLoaded(false);
    api.get('/sessions/current')
      .then((res) => {
        const session: SessionDTO = res.data.data;
        if (session && session.classId === selectedClassId) {
          setCurrentSession(session);
        } else {
          setCurrentSession(null);
        }
      })
      .catch(() => setCurrentSession(null))
      .finally(() => setIsSessionLoaded(true));
  }, [selectedClassId, classes]);

  // Set of device MACs in the class roster (for filtering telemetry)
  const rosterDeviceMacs = useMemo(() => {
    const set = new Set<string>();
    for (const r of roster) {
      if (r.deviceMac) set.add(r.deviceMac);
    }
    return set;
  }, [roster]);

  const selectClass = useCallback((classId: string) => {
    setSelectedClassId(classId);
    localStorage.setItem(STORAGE_KEY, classId);
  }, []);

  const clearClass = useCallback(() => {
    setSelectedClassId(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshSession = useCallback(() => {
    if (!selectedClassId) return;
    api.get('/sessions/current')
      .then((res) => {
        const session: SessionDTO = res.data.data;
        if (session && session.classId === selectedClassId) {
          setCurrentSession(session);
        } else {
          setCurrentSession(null);
        }
      })
      .catch(() => setCurrentSession(null));
  }, [selectedClassId]);

  const refreshRoster = useCallback(() => {
    if (!selectedClassId) return;
    api.get(`/classes/${selectedClassId}/roster`)
      .then((res) => setRoster(res.data.data))
      .catch(() => {});
  }, [selectedClassId]);

  return {
    classes,
    selectedClassId,
    selectedClass,
    selectClass,
    clearClass,
    roster,
    rosterDeviceMacs,
    currentSession,
    setCurrentSession,
    isSessionLoaded,
    isLoading,
    refreshSession,
    refreshRoster,
  };
}
