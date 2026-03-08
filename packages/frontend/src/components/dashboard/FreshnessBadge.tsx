import { FreshnessState } from '@heartbeat/shared';
import { cn } from '../../utils/cn.js';

const freshnessStyles: Record<string, string> = {
  [FreshnessState.LIVE]: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400',
  [FreshnessState.DELAYED]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400',
  [FreshnessState.STALE]: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  [FreshnessState.OFFLINE]: 'bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-500',
};

const freshnessLabels: Record<string, string> = {
  [FreshnessState.LIVE]: 'Live',
  [FreshnessState.DELAYED]: 'Delayed',
  [FreshnessState.STALE]: 'Stale',
  [FreshnessState.OFFLINE]: 'Offline',
};

interface FreshnessBadgeProps {
  state: FreshnessState | string;
  className?: string;
}

export function FreshnessBadge({ state, className }: FreshnessBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        freshnessStyles[state] || freshnessStyles[FreshnessState.OFFLINE],
        className
      )}
    >
      {state === FreshnessState.LIVE && (
        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      )}
      {freshnessLabels[state] || state}
    </span>
  );
}
