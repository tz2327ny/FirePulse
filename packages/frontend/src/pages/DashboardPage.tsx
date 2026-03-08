import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelemetry } from '../hooks/useTelemetry.js';
import { useAlerts } from '../hooks/useAlerts.js';
import { useRehab } from '../hooks/useRehab.js';
import { computeFreshnessState } from '@heartbeat/shared';
import { getServerAdjustedNow } from '../lib/clockSync.js';
import { TelemetryTable } from '../components/dashboard/TelemetryTable.js';
import { CompanyTileView } from '../components/dashboard/CompanyTileView.js';
import { ConfirmDialog } from '../components/common/ConfirmDialog.js';
import { api } from '../api/client.js';
import type { SessionDTO, CurrentTelemetryDTO } from '@heartbeat/shared';
import { SessionState, FreshnessState } from '@heartbeat/shared';
import { AlertTriangle, Bell, Activity, Heart, Pause, Square, Play, Timer, Volume2, VolumeX, Table2, LayoutGrid } from 'lucide-react';
import { useElapsedTimer } from '../hooks/useElapsedTimer.js';
import { useAudioAlert } from '../hooks/useAudioAlert.js';
import { useCanWrite } from '../hooks/useCanWrite.js';

export function DashboardPage() {
  const navigate = useNavigate();
  const { telemetryArray, isLoading } = useTelemetry();
  const [currentSession, setCurrentSession] = useState<SessionDTO | null>(null);
  const { activeAlerts, acknowledge } = useAlerts(currentSession?.id);
  const { createVisit, inRehabParticipantIds, rehabDispositions } = useRehab(currentSession?.id);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendAllConfirm, setSendAllConfirm] = useState<{ participantIds: string[]; names: string[] } | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const { isEnabled: isAudioEnabled, toggleEnabled: toggleAudio } = useAudioAlert();
  const [audioOn, setAudioOn] = useState(() => localStorage.getItem('heartbeat_audio_alerts') !== 'false');
  const [viewMode, setViewMode] = useState<'table' | 'tiles'>(() =>
    (localStorage.getItem('heartbeat_dashboard_view') as 'table' | 'tiles') || 'table'
  );
  const { canWriteSessions, canSendToRehab } = useCanWrite();
  const data = telemetryArray();

  const handleViewToggle = useCallback((mode: 'table' | 'tiles') => {
    setViewMode(mode);
    localStorage.setItem('heartbeat_dashboard_view', mode);
  }, []);

  const elapsed = useElapsedTimer(
    currentSession?.startedAt ?? null,
    currentSession?.state === SessionState.PAUSED,
    currentSession?.timing?.totalBreakMs ?? 0
  );

  useEffect(() => {
    api.get('/sessions/current').then((res) => {
      setCurrentSession(res.data.data);
    }).catch(() => {});
  }, []);

  // ---- Helpers ----

  const isEligibleForRehab = useCallback((row: CurrentTelemetryDTO): boolean => {
    if (!row.participantId) return false;
    if (inRehabParticipantIds.has(row.participantId)) return false;
    if (row.participantStatus !== 'present') return false;
    const freshness = row.lastSeenAt ? computeFreshnessState(new Date(row.lastSeenAt), getServerAdjustedNow()) : FreshnessState.OFFLINE;
    return freshness === FreshnessState.LIVE || freshness === FreshnessState.DELAYED;
  }, [inRehabParticipantIds]);

  // Unassigned devices that are actively collecting HR data
  const unassignedFreshDevices = useMemo(() => {
    return data.filter((row) => {
      if (row.participantId) return false;
      if (row.heartRate == null) return false;
      const freshness = row.lastSeenAt ? computeFreshnessState(new Date(row.lastSeenAt), getServerAdjustedNow()) : FreshnessState.OFFLINE;
      return freshness === FreshnessState.LIVE || freshness === FreshnessState.DELAYED;
    });
  }, [data]);

  // ---- Handlers ----

  const handleStatusChange = useCallback(async (sessionParticipantId: string, newStatus: string) => {
    try {
      await api.patch(`/sessions/participants/${sessionParticipantId}/status`, { status: newStatus });
    } catch (err) {
      console.error('Failed to change status', err);
    }
  }, []);

  const handleSendToRehab = useCallback(async (participantId: string) => {
    try {
      await createVisit(participantId);
      // Stay on dashboard — the "In Rehab" badge updates in real-time via WebSocket
    } catch (err) {
      console.error('Failed to send to rehab', err);
    }
  }, [createVisit]);

  const handleSendAllToRehabClick = useCallback(() => {
    const eligible = data.filter(isEligibleForRehab);
    if (eligible.length === 0) return;

    setSendAllConfirm({
      participantIds: eligible.map((r) => r.participantId!),
      names: eligible.map((r) => `${r.participantFirstName} ${r.participantLastName}`),
    });
  }, [data, isEligibleForRehab]);

  const handleSendAllConfirmed = useCallback(async () => {
    if (!sendAllConfirm) return;
    setSendAllConfirm(null);
    setSendingAll(true);
    try {
      await Promise.allSettled(sendAllConfirm.participantIds.map((pid) => createVisit(pid)));
      navigate('/rehab');
    } catch (err) {
      console.error('Failed to send all to rehab', err);
    } finally {
      setSendingAll(false);
    }
  }, [sendAllConfirm, createVisit, navigate]);

  const handleSessionStateChange = useCallback(async (newState: SessionState) => {
    if (!currentSession) return;
    try {
      await api.post(`/sessions/${currentSession.id}/state`, { state: newState });
      // Re-fetch to get updated timing data
      const res = await api.get('/sessions/current');
      setCurrentSession(res.data.data);
    } catch (err) {
      console.error('Failed to change session state', err);
    }
  }, [currentSession]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Live Dashboard</h1>
          {currentSession && (
            <div className="mt-0.5 flex items-center gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Session: <span className="font-medium dark:text-gray-300">{currentSession.name}</span>
                {' '}
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  currentSession.state === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                  currentSession.state === 'paused' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                  currentSession.state === 'standby' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                  'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {currentSession.state}
                </span>
              </p>
              {currentSession.startedAt && currentSession.state !== SessionState.ENDED && (
                <span className="inline-flex items-center gap-1.5 font-mono text-lg font-bold text-gray-700 dark:text-gray-300">
                  <Timer className="h-4 w-4 text-gray-400" />
                  {elapsed}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <Activity className="h-4 w-4" />
            <span>{data.length} devices</span>
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 p-0.5">
            <button
              onClick={() => handleViewToggle('table')}
              className={`rounded-md p-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              title="Table view"
            >
              <Table2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleViewToggle('tiles')}
              className={`rounded-md p-1.5 transition-colors ${
                viewMode === 'tiles'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              title="Company tile view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          {/* Audio Alert Toggle */}
          <button
            onClick={() => { toggleAudio(); setAudioOn(!audioOn); }}
            className={`btn-ghost p-1.5 ${audioOn ? 'text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'}`}
            title={audioOn ? 'Mute alerts' : 'Unmute alerts'}
          >
            {audioOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* Session Control Buttons (admin + instructor only) */}
          {canWriteSessions && currentSession && currentSession.state === SessionState.STANDBY && (
            <button
              onClick={() => handleSessionStateChange(SessionState.ACTIVE)}
              className="btn-success text-xs inline-flex items-center gap-1"
            >
              <Play className="h-3 w-3" /> Start
            </button>
          )}
          {canWriteSessions && currentSession && currentSession.state === SessionState.ACTIVE && (
            <>
              <button
                onClick={() => handleSessionStateChange(SessionState.PAUSED)}
                className="btn-warning text-xs inline-flex items-center gap-1"
              >
                <Pause className="h-3 w-3" /> Break
              </button>
              <button
                onClick={() => setShowEndConfirm(true)}
                className="btn-danger text-xs inline-flex items-center gap-1"
              >
                <Square className="h-3 w-3" /> End
              </button>
            </>
          )}
          {canWriteSessions && currentSession && currentSession.state === SessionState.PAUSED && (
            <>
              <button
                onClick={() => handleSessionStateChange(SessionState.ACTIVE)}
                className="btn-success text-xs inline-flex items-center gap-1"
              >
                <Play className="h-3 w-3" /> Resume
              </button>
              <button
                onClick={() => setShowEndConfirm(true)}
                className="btn-danger text-xs inline-flex items-center gap-1"
              >
                <Square className="h-3 w-3" /> End
              </button>
            </>
          )}

          {/* Send All to Rehab (all roles can send) */}
          {canSendToRehab && currentSession && data.some(isEligibleForRehab) && (
            <button
              onClick={handleSendAllToRehabClick}
              disabled={sendingAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
            >
              <Heart className="h-3.5 w-3.5" />
              {sendingAll ? 'Sending...' : 'Send All to Rehab'}
            </button>
          )}
        </div>
      </div>

      {/* Unassigned Device Warning */}
      {unassignedFreshDevices.length > 0 && (
        <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span className="font-semibold text-yellow-800 dark:text-yellow-300">
              {unassignedFreshDevices.length} unassigned device{unassignedFreshDevices.length !== 1 ? 's' : ''} collecting data
            </span>
          </div>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
            {unassignedFreshDevices.map((d) => d.shortId).join(', ')}
            {' '}&mdash; Assign participants to avoid data loss.
          </p>
        </div>
      )}

      {/* Active Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-5 w-5 text-red-600 dark:text-red-400" />
            <span className="font-semibold text-red-800 dark:text-red-300">
              {activeAlerts.length} Active Alert{activeAlerts.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {activeAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 p-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${alert.alertLevel === 'alarm' ? 'text-red-600' : 'text-yellow-500'}`} />
                  <span className="text-sm font-medium dark:text-gray-200">
                    {alert.participantName || 'Unknown'} — HR {(alert.metadataJson as any)?.heartRate || '?'}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    alert.alertLevel === 'alarm' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                  }`}>
                    {alert.alertLevel}
                  </span>
                </div>
                <button
                  onClick={() => acknowledge(alert.id)}
                  className="btn-ghost text-xs"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Telemetry View */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            Loading telemetry...
          </div>
        ) : viewMode === 'tiles' ? (
          <CompanyTileView
            data={data}
            onStatusChange={canWriteSessions && currentSession ? handleStatusChange : undefined}
            onSendToRehab={canSendToRehab && currentSession ? handleSendToRehab : undefined}
            inRehabParticipantIds={inRehabParticipantIds}
            rehabDispositions={rehabDispositions}
          />
        ) : (
          <TelemetryTable
            data={data}
            onStatusChange={canWriteSessions && currentSession ? handleStatusChange : undefined}
            onSendToRehab={canSendToRehab && currentSession ? handleSendToRehab : undefined}
            inRehabParticipantIds={inRehabParticipantIds}
            rehabDispositions={rehabDispositions}
          />
        )}
      </div>

      {/* Send All to Rehab Confirmation Dialog */}
      {sendAllConfirm && (
        <ConfirmDialog
          title="Send All to Rehab"
          message={`Send ${sendAllConfirm.names.length} participant${sendAllConfirm.names.length !== 1 ? 's' : ''} to rehab?`}
          confirmLabel="Send to Rehab"
          confirmClassName="btn-danger"
          onConfirm={handleSendAllConfirmed}
          onCancel={() => setSendAllConfirm(null)}
        >
          <ul className="max-h-48 overflow-y-auto space-y-1 text-sm text-gray-700">
            {sendAllConfirm.names.map((name, i) => (
              <li key={i} className="flex items-center gap-2">
                <Heart className="h-3 w-3 text-red-400 flex-shrink-0" />
                {name}
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      )}

      {/* End Session Confirmation Dialog */}
      {showEndConfirm && currentSession && (
        <ConfirmDialog
          title="End Session"
          message={`Are you sure you want to end "${currentSession.name}"? This action cannot be undone. All monitoring will stop.`}
          confirmLabel="End Session"
          confirmClassName="btn-danger"
          onConfirm={() => {
            setShowEndConfirm(false);
            handleSessionStateChange(SessionState.ENDED);
          }}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}
    </div>
  );
}
