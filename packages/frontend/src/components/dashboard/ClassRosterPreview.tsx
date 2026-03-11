import { useState } from 'react';
import { Play, Cpu, Wifi, WifiOff, Edit3 } from 'lucide-react';
import { computeFreshnessState, FreshnessState } from '@heartbeat/shared';
import { getServerAdjustedNow } from '../../lib/clockSync.js';
import type { ClassRosterItemDTO, ClassDTO, CurrentTelemetryDTO } from '@heartbeat/shared';

interface ClassRosterPreviewProps {
  selectedClass: ClassDTO;
  roster: ClassRosterItemDTO[];
  allTelemetry: CurrentTelemetryDTO[];
  onStartSession: (name: string) => void;
  isStarting: boolean;
}

export function ClassRosterPreview({
  selectedClass,
  roster,
  allTelemetry,
  onStartSession,
  isStarting,
}: ClassRosterPreviewProps) {
  const defaultName = `${selectedClass.name} — ${new Date().toLocaleDateString()}`;
  const [sessionName, setSessionName] = useState(defaultName);
  const [isEditing, setIsEditing] = useState(false);

  // Build a map of deviceMac → telemetry for quick lookup
  const telemetryByMac = new Map<string, CurrentTelemetryDTO>();
  for (const t of allTelemetry) {
    telemetryByMac.set(t.deviceMac, t);
  }

  return (
    <div className="space-y-4">
      {/* Start Session Bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                autoFocus
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <span className="font-medium">{sessionName}</span>
                <Edit3 className="h-3.5 w-3.5 text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => onStartSession(sessionName)}
            disabled={isStarting || !sessionName.trim()}
            className="btn-success inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {isStarting ? 'Starting...' : 'Start Session'}
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Company</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Device</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {roster.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  No participants in this class. Add participants on the Classes page.
                </td>
              </tr>
            ) : (
              roster.map((r) => {
                const telemetry = r.deviceMac ? telemetryByMac.get(r.deviceMac) : null;
                const freshness = telemetry?.lastSeenAt
                  ? computeFreshnessState(new Date(telemetry.lastSeenAt), getServerAdjustedNow())
                  : FreshnessState.OFFLINE;
                const isLive = freshness === FreshnessState.LIVE || freshness === FreshnessState.DELAYED;

                return (
                  <tr key={r.classParticipantId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.company || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.deviceShortId ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                          <Cpu className="h-3 w-3" />
                          {r.deviceShortId}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs italic">No device</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!r.deviceMac ? (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                      ) : isLive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Wifi className="h-3 w-3" /> Live
                          {telemetry?.heartRate != null && (
                            <span className="ml-1 font-mono font-bold">{telemetry.heartRate} bpm</span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <WifiOff className="h-3 w-3" /> Offline
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
