import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import type { CurrentTelemetryDTO } from '@heartbeat/shared';
import { FreshnessState, computeFreshnessState } from '@heartbeat/shared';
import { useFreshnessMap } from '../../hooks/useFreshness.js';
import { getServerAdjustedNow } from '../../lib/clockSync.js';
import { HeartRateCell } from './HeartRateCell.js';
import { SignalBarsIndicator } from './SignalBarsIndicator.js';
import { FreshnessBadge } from './FreshnessBadge.js';
import { StatusDropdown, getStatusStyle } from './StatusDropdown.js';
import { cn } from '../../utils/cn.js';

type SortKey = 'name' | 'company' | 'hr' | 'signal' | 'freshness' | 'status';
type SortDir = 'asc' | 'desc';

const FRESHNESS_ORDER: Record<string, number> = {
  [FreshnessState.LIVE]: 0,
  [FreshnessState.DELAYED]: 1,
  [FreshnessState.STALE]: 2,
  [FreshnessState.OFFLINE]: 3,
};

const STATUS_ORDER: Record<string, number> = {
  present: 0, late: 1, absent: 2, left_early: 3, removed: 4,
};

const DISPOSITION_STYLES: Record<string, { label: string; color: string }> = {
  remain_in_rehab: { label: 'Remain in Rehab', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  referred_to_ems: { label: 'Referred to EMS', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  transported: { label: 'Transported', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  released_from_training: { label: 'Released', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
};

export interface TelemetryTableProps {
  data: CurrentTelemetryDTO[];
  onStatusChange?: (sessionParticipantId: string, newStatus: string) => void;
  onSendToRehab?: (participantId: string) => void;
  inRehabParticipantIds?: Set<string>;
  rehabDispositions?: Map<string, string>;
}

export function TelemetryTable({ data, onStatusChange, onSendToRehab, inRehabParticipantIds, rehabDispositions }: TelemetryTableProps) {
  const freshnessItems = useMemo(
    () => data.map((d) => ({ deviceMac: d.deviceMac, lastSeenAt: d.lastSeenAt })),
    [data]
  );
  const freshnessMap = useFreshnessMap(freshnessItems);

  const [sortKey, setSortKey] = useState<SortKey>('hr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'hr' ? 'desc' : 'asc');
    }
  };

  const getFreshness = (row: CurrentTelemetryDTO): FreshnessState =>
    row.lastSeenAt ? computeFreshnessState(new Date(row.lastSeenAt), getServerAdjustedNow()) : FreshnessState.OFFLINE;

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': {
          const nameA = a.participantLastName || a.shortId;
          const nameB = b.participantLastName || b.shortId;
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case 'company': {
          const compA = a.participantCompany || '';
          const compB = b.participantCompany || '';
          cmp = compA.localeCompare(compB);
          break;
        }
        case 'hr':
          cmp = (a.heartRate ?? -1) - (b.heartRate ?? -1);
          break;
        case 'signal':
          cmp = (a.signalBars ?? -1) - (b.signalBars ?? -1);
          break;
        case 'freshness': {
          const fA = FRESHNESS_ORDER[getFreshness(a)] ?? 99;
          const fB = FRESHNESS_ORDER[getFreshness(b)] ?? 99;
          cmp = fA - fB;
          break;
        }
        case 'status': {
          const sA = STATUS_ORDER[a.participantStatus || ''] ?? 99;
          const sB = STATUS_ORDER[b.participantStatus || ''] ?? 99;
          cmp = sA - sB;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="ml-1 inline-block w-3" />;
    return sortDir === 'asc'
      ? <ChevronUp className="ml-0.5 inline h-3 w-3" />
      : <ChevronDown className="ml-0.5 inline h-3 w-3" />;
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
        <p className="text-lg font-medium">No devices detected</p>
        <p className="mt-1 text-sm">Waiting for telemetry from ESP32 receivers...</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <th className="px-4 py-3">
              <button onClick={() => handleSort('name')} className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 select-none">
                Name <SortIcon col="name" />
              </button>
            </th>
            <th className="px-4 py-3">
              <button onClick={() => handleSort('company')} className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 select-none">
                Company <SortIcon col="company" />
              </button>
            </th>
            <th className="px-4 py-3">Device</th>
            <th className="px-4 py-3 text-center">
              <button onClick={() => handleSort('hr')} className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 select-none">
                HR <SortIcon col="hr" />
              </button>
            </th>
            <th className="px-4 py-3 text-center">
              <button onClick={() => handleSort('signal')} className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 select-none">
                Signal <SortIcon col="signal" />
              </button>
            </th>
            <th className="px-4 py-3 text-center">
              <button onClick={() => handleSort('freshness')} className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 select-none">
                Freshness <SortIcon col="freshness" />
              </button>
            </th>
            <th className="px-4 py-3">
              <button onClick={() => handleSort('status')} className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 select-none">
                Status <SortIcon col="status" />
              </button>
            </th>
            <th className="px-4 py-3 text-center">Rehab</th>
            <th className="px-4 py-3">Receiver</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {sortedData.map((row) => {
            const freshness = freshnessMap.get(row.deviceMac) || FreshnessState.OFFLINE;
            const isStaleOrOffline = freshness === FreshnessState.STALE || freshness === FreshnessState.OFFLINE;
            const isUnexpectedlyOffline = isStaleOrOffline && row.participantStatus === 'present';

            return (
              <tr
                key={row.deviceMac}
                className={cn(
                  'transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50',
                  isStaleOrOffline && !isUnexpectedlyOffline && 'opacity-50'
                )}
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium dark:text-gray-200">
                  <div className="flex items-center gap-1.5">
                    {isUnexpectedlyOffline && (
                      <span title="Device offline — participant still present"><AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500 animate-pulse" /></span>
                    )}
                    {row.participantFirstName && row.participantId
                    ? <Link to={`/participants/${row.participantId}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline">
                        {row.participantFirstName} {row.participantLastName}
                      </Link>
                    : <span className="text-gray-400 dark:text-gray-500 italic">Unassigned</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-400">
                  {row.participantCompany || '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{row.shortId}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center text-lg">
                  <HeartRateCell heartRate={row.heartRate} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <SignalBarsIndicator bars={row.signalBars} />
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <FreshnessBadge state={freshness} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.participantStatus && row.sessionParticipantId && onStatusChange ? (
                    <StatusDropdown
                      currentStatus={row.participantStatus}
                      sessionParticipantId={row.sessionParticipantId}
                      onStatusChange={onStatusChange}
                    />
                  ) : row.participantStatus ? (
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      getStatusStyle(row.participantStatus),
                    )}>
                      {row.participantStatus.replace('_', ' ')}
                    </span>
                  ) : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  {row.participantId && inRehabParticipantIds?.has(row.participantId) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
                      <Heart className="h-3 w-3" />
                      In Rehab
                    </span>
                  ) : row.participantId && rehabDispositions?.has(row.participantId) ? (
                    (() => {
                      const disp = rehabDispositions.get(row.participantId!)!;
                      const style = DISPOSITION_STYLES[disp] || { label: disp.replace(/_/g, ' '), color: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' };
                      return (
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          style.color
                        )}>
                          <Heart className="h-3 w-3" />
                          {style.label}
                        </span>
                      );
                    })()
                  ) : row.participantId && onSendToRehab ? (
                    <button
                      onClick={() => onSendToRehab(row.participantId!)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Send to Rehab"
                    >
                      <Heart className="h-3 w-3" />
                    </button>
                  ) : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                  {row.bestReceiverName || row.bestReceiverHwId || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
