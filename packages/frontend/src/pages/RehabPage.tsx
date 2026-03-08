import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Heart, Plus, ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { api } from '../api/client.js';
import { useRehab } from '../hooks/useRehab.js';
import { useCanWrite } from '../hooks/useCanWrite.js';
import { CheckpointModal } from '../components/rehab/CheckpointModal.js';
import { formatLocalTime, timeAgo } from '../utils/formatTime.js';
import { cn } from '../utils/cn.js';
import type { SessionDTO, RehabVisitDTO, RehabCheckpointDTO, CreateCheckpointRequest } from '@heartbeat/shared';
import { VisitDisposition } from '@heartbeat/shared';

const VISIT_DISPOSITIONS = [
  { value: VisitDisposition.RETURNED_TO_TRAINING, label: 'Returned to Training', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  { value: VisitDisposition.REMAIN_IN_REHAB, label: 'Remain in Rehab', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  { value: VisitDisposition.REFERRED_TO_EMS, label: 'Referred to EMS', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  { value: VisitDisposition.TRANSPORTED, label: 'Transported', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  { value: VisitDisposition.RELEASED_FROM_TRAINING, label: 'Released from Training', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
];

function getDispositionStyle(disposition: string | null): string {
  return VISIT_DISPOSITIONS.find((d) => d.value === disposition)?.color || 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}

function getDispositionLabel(disposition: string | null): string {
  return VISIT_DISPOSITIONS.find((d) => d.value === disposition)?.label || disposition || 'Unknown';
}

function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

function CheckpointRow({ cp }: { cp: RehabCheckpointDTO }) {
  return (
    <div className="flex items-start gap-3 py-2 text-sm">
      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
        {cp.checkpointType === 'initial' ? 'I' :
         cp.checkpointType === 'end' ? 'E' :
         cp.checkpointType === 'rehab_eval' ? 'V' : 'R'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
            {cp.checkpointType.replace('_', ' ')}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{formatLocalTime(cp.timestamp)}</span>
          {cp.disposition && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              cp.disposition === 'cleared' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
              cp.disposition === 'not_cleared' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
            )}>
              {cp.disposition.replace('_', ' ')}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          {cp.liveHrSnapshot != null && <span>Live HR: {cp.liveHrSnapshot}</span>}
          {cp.manualHr != null && <span>Manual HR: {cp.manualHr}</span>}
          {cp.bpSystolic != null && cp.bpDiastolic != null && (
            <span>BP: {cp.bpSystolic}/{cp.bpDiastolic}</span>
          )}
          {cp.respirations != null && <span>Resp: {cp.respirations}</span>}
          {cp.spo2 != null && <span>SpO2: {cp.spo2}%</span>}
          {cp.temperature != null && (
            <span>Temp: {cp.temperature}F{cp.temperatureMethod ? ` (${cp.temperatureMethod})` : ''}</span>
          )}
        </div>
        {cp.note && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 italic">{cp.note}</p>}
        {cp.enteredByName && (
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">by {cp.enteredByName}</p>
        )}
      </div>
    </div>
  );
}

function ActiveVisitCard({
  visit,
  onAddCheckpoint,
  onCloseVisit,
  onCancelVisit,
}: {
  visit: RehabVisitDTO;
  onAddCheckpoint: (visit: RehabVisitDTO) => void;
  onCloseVisit: (visitId: string, disposition: string) => void;
  onCancelVisit: (visitId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showCloseDropdown, setShowCloseDropdown] = useState(false);

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-800 shadow-sm">
      {/* Card Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          <div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{visit.participantName}</span>
            {visit.participantCompany && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{visit.participantCompany}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Clock className="h-3.5 w-3.5" />
            <ElapsedTime startedAt={visit.startedAt} />
          </div>
          <span className="rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
            {visit.checkpointCount} checkpoint{visit.checkpointCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
          {/* Checkpoint Timeline */}
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {visit.checkpoints.map((cp) => (
              <CheckpointRow key={cp.id} cp={cp} />
            ))}
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
            <button
              onClick={(e) => { e.stopPropagation(); onAddCheckpoint(visit); }}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Checkpoint
            </button>

            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowCloseDropdown(!showCloseDropdown); }}
                className="btn-ghost text-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Close Visit
              </button>

              {showCloseDropdown && (
                <div className="absolute left-0 z-50 mt-1 w-52 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1 shadow-lg">
                  {VISIT_DISPOSITIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseVisit(visit.id, d.value);
                        setShowCloseDropdown(false);
                      }}
                      className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
                    >
                      <span className={cn('mr-2 inline-block h-2 w-2 rounded-full', d.color.split(' ')[0])} />
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onCancelVisit(visit.id); }}
              className="btn-ghost text-sm flex items-center gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 ml-auto"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClosedVisitRow({
  visit,
  onReEvaluate,
  canReEvaluate,
}: {
  visit: RehabVisitDTO;
  onReEvaluate: (visitId: string) => void;
  canReEvaluate: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{visit.participantName}</span>
          {visit.participantCompany && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{visit.participantCompany}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(visit.endedAt!)}</span>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            getDispositionStyle(visit.finalDisposition)
          )}>
            {getDispositionLabel(visit.finalDisposition)}
          </span>
          {canReEvaluate && visit.finalDisposition === 'remain_in_rehab' && (
            <button
              onClick={(e) => { e.stopPropagation(); onReEvaluate(visit.id); }}
              className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
              title="Create a new re-evaluation visit"
            >
              <RefreshCw className="h-3 w-3" />
              Re-evaluate
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {visit.checkpoints.map((cp) => (
              <CheckpointRow key={cp.id} cp={cp} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RehabPage() {
  const { canAccessRehab } = useCanWrite();
  const [currentSession, setCurrentSession] = useState<SessionDTO | null>(null);
  const { activeVisits, closedVisits, addCheckpoint, closeVisit, cancelVisit, reEvaluateVisit, inRehabParticipantIds } = useRehab(currentSession?.id);
  const [checkpointTarget, setCheckpointTarget] = useState<RehabVisitDTO | null>(null);

  useEffect(() => {
    api.get('/sessions/current').then((res) => {
      setCurrentSession(res.data.data);
    }).catch(() => {});
  }, []);

  const handleAddCheckpoint = useCallback((visit: RehabVisitDTO) => {
    setCheckpointTarget(visit);
  }, []);

  const handleSaveCheckpoint = useCallback(async (data: CreateCheckpointRequest) => {
    if (!checkpointTarget) return;
    await addCheckpoint(checkpointTarget.id, data);
  }, [checkpointTarget, addCheckpoint]);

  const handleCloseVisit = useCallback(async (visitId: string, disposition: string) => {
    try {
      await closeVisit(visitId, disposition);
    } catch (err) {
      console.error('Failed to close visit', err);
    }
  }, [closeVisit]);

  const handleCancelVisit = useCallback(async (visitId: string) => {
    try {
      await cancelVisit(visitId);
    } catch (err) {
      console.error('Failed to cancel visit', err);
    }
  }, [cancelVisit]);

  const handleReEvaluate = useCallback(async (visitId: string) => {
    try {
      await reEvaluateVisit(visitId);
    } catch (err) {
      console.error('Failed to re-evaluate visit', err);
    }
  }, [reEvaluateVisit]);

  if (!canAccessRehab) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="h-7 w-7 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Rehab Tracking</h1>
            {currentSession && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Session: <span className="font-medium">{currentSession.name}</span>
              </p>
            )}
          </div>
        </div>
        {activeVisits.length > 0 && (
          <span className="rounded-full bg-orange-100 dark:bg-orange-900/40 px-3 py-1 text-sm font-semibold text-orange-700 dark:text-orange-400">
            {activeVisits.length} Active
          </span>
        )}
      </div>

      {/* No Session Warning */}
      {!currentSession && (
        <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-6 text-center">
          <p className="text-yellow-800 dark:text-yellow-400 font-medium">No active session</p>
          <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">Start a session to begin tracking rehab visits.</p>
        </div>
      )}

      {/* Active Visits */}
      {activeVisits.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Active Visits</h2>
          {activeVisits.map((visit) => (
            <ActiveVisitCard
              key={visit.id}
              visit={visit}
              onAddCheckpoint={handleAddCheckpoint}
              onCloseVisit={handleCloseVisit}
              onCancelVisit={handleCancelVisit}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {currentSession && activeVisits.length === 0 && closedVisits.length === 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-12 text-center">
          <Heart className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-lg font-medium text-gray-400 dark:text-gray-500">No rehab visits</p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            Send participants to rehab from the Dashboard to begin tracking.
          </p>
        </div>
      )}

      {/* Closed Visits */}
      {closedVisits.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Closed Visits ({closedVisits.length})
          </h2>
          {closedVisits.map((visit) => (
            <ClosedVisitRow
              key={visit.id}
              visit={visit}
              onReEvaluate={handleReEvaluate}
              canReEvaluate={!inRehabParticipantIds.has(visit.participantId)}
            />
          ))}
        </div>
      )}

      {/* Checkpoint Modal */}
      {checkpointTarget && (
        <CheckpointModal
          participantName={checkpointTarget.participantName}
          liveHr={
            checkpointTarget.checkpoints.length > 0
              ? checkpointTarget.checkpoints[checkpointTarget.checkpoints.length - 1].liveHrSnapshot
              : null
          }
          onSave={handleSaveCheckpoint}
          onClose={() => setCheckpointTarget(null)}
        />
      )}
    </div>
  );
}
