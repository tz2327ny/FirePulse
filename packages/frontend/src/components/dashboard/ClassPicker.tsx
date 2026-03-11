import { Users, BookOpen } from 'lucide-react';
import type { ClassDTO } from '@heartbeat/shared';

interface ClassPickerProps {
  classes: ClassDTO[];
  onSelect: (classId: string) => void;
}

export function ClassPicker({ classes, onSelect }: ClassPickerProps) {
  const activeClasses = classes.filter((c) => !c.isArchived);

  if (activeClasses.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 text-center">
        <BookOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400">No Classes</h2>
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 max-w-sm">
          Create a class first to start monitoring. Go to the Classes page to set up a roster with participants and device assignments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-6">
        <BookOpen className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Select a Class</h2>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Choose which class to monitor</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeClasses.map((cls) => (
          <button
            key={cls.id}
            onClick={() => onSelect(cls.id)}
            className="card p-5 text-left hover:ring-2 hover:ring-blue-400 dark:hover:ring-blue-500 transition-all hover:shadow-md"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{cls.name}</h3>
            {cls.courseType && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{cls.courseType}</p>
            )}
            <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Users className="h-4 w-4" />
              <span>{cls.participantCount} participant{cls.participantCount !== 1 ? 's' : ''}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
