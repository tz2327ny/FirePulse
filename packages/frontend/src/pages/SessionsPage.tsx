import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import type { SessionDTO, SessionTimingDTO, SessionEventDTO } from '@heartbeat/shared';
import { SessionState, ParticipantStatus } from '@heartbeat/shared';
import {
  PlayCircle, Plus, Pause, Square, Play, ChevronDown, ChevronUp,
  Users, UserPlus, Download, Clock, Timer, List,
} from 'lucide-react';
import { formatLocalDateTime, formatLocalTime, formatDurationMs } from '../utils/formatTime.js';
import { SessionTimeline } from '../components/session/SessionTimeline.js';
import { useCanWrite } from '../hooks/useCanWrite.js';

interface SessionParticipantItem {
  id: string;
  participantId: string;
  status: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    company: string;
  };
}

interface SessionDetail {
  id: string;
  name: string;
  state: string;
  classId: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  timing: SessionTimingDTO | null;
  sessionParticipants: SessionParticipantItem[];
  class?: { name: string } | null;
}

const statusOptions = [
  { value: ParticipantStatus.PRESENT, label: 'Present', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  { value: ParticipantStatus.LATE, label: 'Late', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  { value: ParticipantStatus.ABSENT, label: 'Absent', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  { value: ParticipantStatus.LEFT_EARLY, label: 'Left Early', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  { value: ParticipantStatus.REMOVED, label: 'Removed', color: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
];

function getStatusStyle(status: string): string {
  return statusOptions.find((s) => s.value === status)?.color || 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}

export function SessionsPage() {
  const { canWriteSessions } = useCanWrite();
  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);

  // Detail view
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [sessionEvents, setSessionEvents] = useState<SessionEventDTO[]>([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const [allParticipants, setAllParticipants] = useState<Array<{ id: string; firstName: string; lastName: string; company: string }>>([]);
  const [addParticipantId, setAddParticipantId] = useState('');

  const fetchSessions = useCallback(async () => {
    const res = await api.get('/sessions');
    setSessions(res.data.data);
  }, []);

  const fetchClasses = useCallback(async () => {
    const res = await api.get('/classes');
    setClasses(res.data.data);
  }, []);

  const fetchAllParticipants = useCallback(async () => {
    const res = await api.get('/participants?active=true');
    setAllParticipants(res.data.data);
  }, []);

  const fetchSessionDetail = useCallback(async (id: string) => {
    const res = await api.get(`/sessions/${id}`);
    setSessionDetail(res.data.data);
  }, []);

  useEffect(() => { fetchSessions(); fetchClasses(); fetchAllParticipants(); }, [fetchSessions, fetchClasses, fetchAllParticipants]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setSessionDetail(null);
      setSessionEvents([]);
      setShowTimeline(false);
    } else {
      setExpandedId(id);
      await fetchSessionDetail(id);
      try {
        const evRes = await api.get(`/sessions/${id}/events`);
        setSessionEvents(evRes.data.data);
      } catch { setSessionEvents([]); }
      setShowTimeline(false);
    }
  };

  const handleCreate = async () => {
    await api.post('/sessions', { name, classId: classId || undefined });
    setName('');
    setClassId('');
    setShowCreate(false);
    fetchSessions();
  };

  const changeState = async (id: string, state: SessionState) => {
    await api.post(`/sessions/${id}/state`, { state });
    fetchSessions();
    if (expandedId === id) await fetchSessionDetail(id);
  };

  const handleStatusChange = async (spId: string, newStatus: string) => {
    await api.patch(`/sessions/participants/${spId}/status`, { status: newStatus });
    if (expandedId) await fetchSessionDetail(expandedId);
  };

  const handleAddParticipant = async (sessionId: string) => {
    if (!addParticipantId) return;
    await api.post(`/sessions/${sessionId}/participants`, { participantId: addParticipantId });
    setAddParticipantId('');
    await fetchSessionDetail(sessionId);
    fetchSessions();
  };

  const handleExport = (id: string) => {
    const token = localStorage.getItem('heartbeat_token');
    const url = `${import.meta.env.VITE_API_URL || ''}/api/sessions/${id}/export.csv`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `session-export.csv`;
        a.click();
      });
  };

  const stateColors: Record<string, string> = {
    standby: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
    ended: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };

  const availableParticipants = sessionDetail
    ? allParticipants.filter(
        (p) => !sessionDetail.sessionParticipants.some((sp) => sp.participantId === p.id)
      )
    : [];

  const isEditable = (state: string) => state !== SessionState.ENDED;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sessions</h1>
        </div>
        {canWriteSessions && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="mr-1 h-4 w-4" /> New Session
          </button>
        )}
      </div>

      {canWriteSessions && showCreate && (
        <div className="card space-y-3">
          <h3 className="font-semibold dark:text-gray-100">Create Session</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Session Name" value={name} onChange={(e) => setName(e.target.value)} />
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">No class template (empty roster)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Selecting a class template will copy its roster into the session.
          </p>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary" disabled={!name}>Create</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sessions.map((s) => (
          <div key={s.id} className="card">
            {/* Session header */}
            <div className="flex items-center justify-between">
              <button onClick={() => toggleExpand(s.id)} className="flex items-center gap-2 text-left">
                {expandedId === s.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{s.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateColors[s.state] || ''}`}>
                      {s.state}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {s.className && `Class: ${s.className} · `}
                    {s.participantCount} participants · {s.activeAlertCount} active alerts
                    {s.startedAt && ` · Started ${formatLocalDateTime(s.startedAt)}`}
                    {s.timing && ` · Duration: ${formatDurationMs(s.timing.totalDurationMs)}`}
                    {s.timing && s.timing.breakCount > 0 && ` (Active: ${formatDurationMs(s.timing.activeDurationMs)}, ${s.timing.breakCount} break${s.timing.breakCount !== 1 ? 's' : ''})`}
                  </p>
                </div>
              </button>
              <div className="flex gap-1">
                {canWriteSessions && s.state === SessionState.STANDBY && (
                  <button onClick={() => changeState(s.id, SessionState.ACTIVE)} className="btn-success text-xs">
                    <Play className="mr-1 h-3 w-3" /> Start
                  </button>
                )}
                {canWriteSessions && s.state === SessionState.ACTIVE && (
                  <>
                    <button onClick={() => changeState(s.id, SessionState.PAUSED)} className="btn-warning text-xs">
                      <Pause className="mr-1 h-3 w-3" /> Pause
                    </button>
                    <button onClick={() => changeState(s.id, SessionState.ENDED)} className="btn-danger text-xs">
                      <Square className="mr-1 h-3 w-3" /> End
                    </button>
                  </>
                )}
                {canWriteSessions && s.state === SessionState.PAUSED && (
                  <>
                    <button onClick={() => changeState(s.id, SessionState.ACTIVE)} className="btn-success text-xs">
                      <Play className="mr-1 h-3 w-3" /> Resume
                    </button>
                    <button onClick={() => changeState(s.id, SessionState.ENDED)} className="btn-danger text-xs">
                      <Square className="mr-1 h-3 w-3" /> End
                    </button>
                  </>
                )}
                {s.state === SessionState.ENDED && (
                  <button onClick={() => handleExport(s.id)} className="btn-secondary text-xs">
                    <Download className="mr-1 h-3 w-3" /> Export CSV
                  </button>
                )}
              </div>
            </div>

            {/* Expanded session detail */}
            {expandedId === s.id && sessionDetail && (
              <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                {/* Session timestamps */}
                <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {formatLocalDateTime(sessionDetail.createdAt)}
                  </div>
                  {sessionDetail.startedAt && <div>Started: {formatLocalDateTime(sessionDetail.startedAt)}</div>}
                  {sessionDetail.pausedAt && <div>Paused: {formatLocalDateTime(sessionDetail.pausedAt)}</div>}
                  {sessionDetail.endedAt && <div>Ended: {formatLocalDateTime(sessionDetail.endedAt)}</div>}
                </div>

                {/* Timing panel */}
                {sessionDetail.timing && (
                  <div className="mb-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
                    <div className="mb-2 flex items-center gap-1 text-sm font-medium text-blue-800 dark:text-blue-300">
                      <Timer className="h-4 w-4" />
                      Session Timing
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-blue-500 dark:text-blue-400">Total Duration</p>
                        <p className="font-semibold dark:text-gray-200">{formatDurationMs(sessionDetail.timing.totalDurationMs)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-500 dark:text-blue-400">Active Training</p>
                        <p className="font-semibold text-green-700 dark:text-green-400">{formatDurationMs(sessionDetail.timing.activeDurationMs)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-500 dark:text-blue-400">Break Count</p>
                        <p className="font-semibold dark:text-gray-200">{sessionDetail.timing.breakCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-500 dark:text-blue-400">Total Break Time</p>
                        <p className="font-semibold text-yellow-700 dark:text-yellow-400">{formatDurationMs(sessionDetail.timing.totalBreakMs)}</p>
                      </div>
                    </div>
                    {sessionDetail.timing.breaks.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Break Log</p>
                        {sessionDetail.timing.breaks.map((b, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-mono">Break {i + 1}:</span>
                            <span>{formatLocalTime(b.startedAt)} — {b.endedAt ? formatLocalTime(b.endedAt) : 'ongoing'}</span>
                            <span className="font-medium">{formatDurationMs(b.durationMs)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Activity Timeline */}
                {sessionEvents.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowTimeline(!showTimeline)}
                      className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                    >
                      <List className="h-4 w-4" />
                      Activity Log ({sessionEvents.length} events)
                      {showTimeline ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showTimeline && (
                      <div className="mt-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                        <SessionTimeline events={sessionEvents} />
                      </div>
                    )}
                  </div>
                )}

                {/* Participants header */}
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Users className="h-4 w-4" />
                  Participants ({sessionDetail.sessionParticipants.length})
                </div>

                {/* Add participant (admin + instructor only) */}
                {canWriteSessions && isEditable(s.state) && (
                  <div className="mb-3 flex gap-2">
                    <select
                      className="input flex-1 text-sm"
                      value={addParticipantId}
                      onChange={(e) => setAddParticipantId(e.target.value)}
                    >
                      <option value="">Add participant to session...</option>
                      {availableParticipants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} — {p.company}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAddParticipant(s.id)}
                      className="btn-primary text-xs"
                      disabled={!addParticipantId}
                    >
                      <UserPlus className="mr-1 h-3 w-3" /> Add
                    </button>
                  </div>
                )}

                {/* Participant table */}
                {sessionDetail.sessionParticipants.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Company</th>
                          <th className="px-3 py-2">Status</th>
                          {canWriteSessions && isEditable(s.state) && <th className="px-3 py-2 text-right">Change Status</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {sessionDetail.sessionParticipants.map((sp) => (
                          <tr key={sp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="whitespace-nowrap px-3 py-2 font-medium dark:text-gray-200">
                              {sp.participant.firstName} {sp.participant.lastName}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-500 dark:text-gray-400">
                              {sp.participant.company}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusStyle(sp.status)}`}>
                                {sp.status.replace('_', ' ')}
                              </span>
                            </td>
                            {canWriteSessions && isEditable(s.state) && (
                              <td className="px-3 py-2 text-right">
                                <div className="flex flex-wrap justify-end gap-1">
                                  {statusOptions
                                    .filter((opt) => opt.value !== sp.status)
                                    .map((opt) => (
                                      <button
                                        key={opt.value}
                                        onClick={() => handleStatusChange(sp.id, opt.value)}
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium opacity-60 transition-opacity hover:opacity-100 ${opt.color}`}
                                        title={`Mark as ${opt.label}`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                    No participants in this session. Add participants above or create the session from a class template.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="py-8 text-center text-gray-400 dark:text-gray-500">No sessions yet. Create one to start monitoring.</p>
        )}
      </div>
    </div>
  );
}
