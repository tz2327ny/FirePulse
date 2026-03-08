import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import type { CurrentTelemetryDTO } from '@heartbeat/shared';
import { FreshnessState, computeFreshnessState } from '@heartbeat/shared';
import { useFreshnessMap } from '../../hooks/useFreshness.js';
import { getStatusDotColor } from './StatusDropdown.js';
import { cn } from '../../utils/cn.js';
import type { TelemetryTableProps } from './TelemetryTable.js';

function getHrTileColor(hr: number): string {
  if (hr >= 180) return 'text-red-600 dark:text-red-400';
  if (hr >= 160) return 'text-orange-600 dark:text-orange-400';
  if (hr >= 140) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-700 dark:text-green-400';
}

function getFreshnessBorderColor(state: FreshnessState | string): string {
  switch (state) {
    case FreshnessState.LIVE:
      return 'border-l-green-500';
    case FreshnessState.DELAYED:
      return 'border-l-yellow-500';
    case FreshnessState.STALE:
      return 'border-l-gray-400';
    case FreshnessState.OFFLINE:
    default:
      return 'border-l-gray-300 dark:border-l-gray-600';
  }
}

interface CompanyGroup {
  company: string;
  rows: CurrentTelemetryDTO[];
}

export function CompanyTileView({ data, inRehabParticipantIds, rehabDispositions }: TelemetryTableProps) {
  const freshnessItems = useMemo(
    () => data.map((d) => ({ deviceMac: d.deviceMac, lastSeenAt: d.lastSeenAt })),
    [data]
  );
  const freshnessMap = useFreshnessMap(freshnessItems);

  const groups = useMemo(() => {
    const map = new Map<string, CurrentTelemetryDTO[]>();

    for (const row of data) {
      const company = row.participantCompany || '__unassigned__';
      const existing = map.get(company) || [];
      existing.push(row);
      map.set(company, existing);
    }

    // Sort within each group by HR descending
    const result: CompanyGroup[] = [];
    for (const [company, rows] of map.entries()) {
      rows.sort((a, b) => (b.heartRate ?? -1) - (a.heartRate ?? -1));
      result.push({ company, rows });
    }

    // Sort companies alphabetically, "__unassigned__" always last
    result.sort((a, b) => {
      if (a.company === '__unassigned__') return 1;
      if (b.company === '__unassigned__') return -1;
      return a.company.localeCompare(b.company);
    });

    return result;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
        <p className="text-lg font-medium">No devices detected</p>
        <p className="mt-1 text-sm">Waiting for telemetry from ESP32 receivers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {groups.map((group) => {
        const label = group.company === '__unassigned__' ? 'Unassigned' : group.company;

        return (
          <div
            key={group.company}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
          >
            {/* Company Header */}
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</h3>
              <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {group.rows.length}
              </span>
            </div>

            {/* Participant Tiles Grid */}
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {group.rows.map((row) => {
                const freshness = freshnessMap.get(row.deviceMac) || FreshnessState.OFFLINE;
                const isStaleOrOffline = freshness === FreshnessState.STALE || freshness === FreshnessState.OFFLINE;
                const isInRehab = row.participantId ? inRehabParticipantIds?.has(row.participantId) : false;
                const firstName = row.participantFirstName || '';
                const lastName = row.participantLastName || '';
                const displayName = firstName
                  ? `${firstName.charAt(0)}. ${lastName}`
                  : row.shortId;

                return (
                  <div
                    key={row.deviceMac}
                    className={cn(
                      'relative flex flex-col rounded-lg border-l-4 bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 transition-colors',
                      getFreshnessBorderColor(freshness),
                      isStaleOrOffline && 'opacity-50'
                    )}
                  >
                    {/* Name + Status dot row */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Status dot */}
                      {row.participantStatus && (
                        <span
                          className={cn(
                            'inline-block h-2 w-2 flex-shrink-0 rounded-full',
                            getStatusDotColor(row.participantStatus)
                          )}
                          title={row.participantStatus.replace('_', ' ')}
                        />
                      )}
                      {/* Name */}
                      {row.participantId ? (
                        <Link
                          to={`/participants/${row.participantId}`}
                          className="truncate text-xs font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                          title={`${firstName} ${lastName}`}
                        >
                          {displayName}
                        </Link>
                      ) : (
                        <span className="truncate text-xs text-gray-400 dark:text-gray-500 italic">
                          {displayName}
                        </span>
                      )}
                      {/* Rehab heart icon */}
                      {isInRehab && (
                        <Heart className="h-3 w-3 flex-shrink-0 text-orange-500" />
                      )}
                    </div>

                    {/* Heart Rate — large */}
                    <div className="mt-1">
                      {row.heartRate != null ? (
                        <span className={cn('text-2xl font-bold tabular-nums', getHrTileColor(row.heartRate))}>
                          {row.heartRate}
                        </span>
                      ) : (
                        <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
