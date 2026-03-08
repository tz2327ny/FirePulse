import { cn } from '../../utils/cn.js';

interface SignalBarsProps {
  bars: number; // 0-4
  className?: string;
}

export function SignalBarsIndicator({ bars, className }: SignalBarsProps) {
  const heights = [6, 10, 14, 18];
  const barColor = bars >= 3 ? 'bg-green-500' : bars >= 2 ? 'bg-yellow-500' : bars >= 1 ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600';

  return (
    <div className={cn('flex items-end gap-0.5', className)} title={`${bars}/4 bars`}>
      {heights.map((h, i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-sm transition-colors',
            i < bars ? barColor : 'bg-gray-200 dark:bg-gray-600'
          )}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}
