import { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn.js';

export const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  { value: 'late', label: 'Late', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  { value: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  { value: 'left_early', label: 'Left Early', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  { value: 'removed', label: 'Removed', color: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
];

export function getStatusStyle(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color || 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}

export function getStatusDotColor(status: string): string {
  switch (status) {
    case 'present': return 'bg-green-500';
    case 'late': return 'bg-yellow-500';
    case 'absent': return 'bg-red-500';
    case 'left_early': return 'bg-orange-500';
    case 'removed': return 'bg-gray-400';
    default: return 'bg-gray-400';
  }
}

export function StatusDropdown({
  currentStatus,
  sessionParticipantId,
  onStatusChange,
}: {
  currentStatus: string;
  sessionParticipantId: string;
  onStatusChange: (spId: string, status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex cursor-pointer items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize transition-all',
          'hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 dark:hover:ring-gray-600 dark:ring-offset-gray-800',
          getStatusStyle(currentStatus),
        )}
        title="Click to change status"
      >
        {currentStatus.replace('_', ' ')}
        <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-32 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                if (opt.value !== currentStatus) {
                  onStatusChange(sessionParticipantId, opt.value);
                }
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300',
                opt.value === currentStatus && 'font-semibold',
              )}
            >
              <span className={cn('mr-2 inline-block h-2 w-2 rounded-full', opt.color.split(' ')[0])} />
              {opt.label}
              {opt.value === currentStatus && (
                <svg className="ml-auto h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
