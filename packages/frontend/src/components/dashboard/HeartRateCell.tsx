import { cn } from '../../utils/cn.js';

interface HeartRateCellProps {
  heartRate: number | null;
  className?: string;
}

function getHrColor(hr: number): string {
  if (hr >= 180) return 'text-red-600 dark:text-red-400 font-bold';
  if (hr >= 160) return 'text-orange-600 dark:text-orange-400 font-semibold';
  if (hr >= 140) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-700 dark:text-green-400';
}

export function HeartRateCell({ heartRate, className }: HeartRateCellProps) {
  if (heartRate === null || heartRate === undefined) {
    return <span className={cn('text-gray-400 dark:text-gray-500', className)}>—</span>;
  }

  return (
    <span className={cn('tabular-nums', getHrColor(heartRate), className)}>
      {heartRate}
    </span>
  );
}
