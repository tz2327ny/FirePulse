import { Play, Pause, Square, Link, Unlink, Bell, AlertTriangle, Users, CheckCircle } from 'lucide-react';
import { formatLocalTime } from '../../utils/formatTime.js';
import type { SessionEventDTO } from '@heartbeat/shared';

interface SessionTimelineProps {
  events: SessionEventDTO[];
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'session_state_changed':
      return null; // Dynamic based on payload
    case 'participant_status_changed':
      return <Users className="h-3.5 w-3.5 text-blue-500" />;
    case 'device_assigned':
      return <Link className="h-3.5 w-3.5 text-green-500" />;
    case 'device_unassigned':
      return <Unlink className="h-3.5 w-3.5 text-gray-500" />;
    case 'alert_opened':
      return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
    case 'alert_acknowledged':
      return <CheckCircle className="h-3.5 w-3.5 text-yellow-600" />;
    case 'alert_cleared':
      return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case 'rehab_visit_created':
      return <Bell className="h-3.5 w-3.5 text-orange-500" />;
    case 'rehab_visit_closed':
      return <CheckCircle className="h-3.5 w-3.5 text-orange-500" />;
    default:
      return <Bell className="h-3.5 w-3.5 text-gray-400" />;
  }
}

function getStateIcon(newState: string) {
  switch (newState) {
    case 'active':
      return <Play className="h-3.5 w-3.5 text-green-500" />;
    case 'paused':
      return <Pause className="h-3.5 w-3.5 text-yellow-500" />;
    case 'ended':
      return <Square className="h-3.5 w-3.5 text-red-500" />;
    default:
      return <Play className="h-3.5 w-3.5 text-blue-500" />;
  }
}

function formatEvent(event: SessionEventDTO): { icon: React.ReactNode; description: string; color: string } {
  const payload = event.payloadJson || {};
  const userName = event.userName || 'System';

  switch (event.eventType) {
    case 'session_state_changed': {
      const newState = payload.newState as string;
      const labels: Record<string, string> = {
        active: 'Session started',
        paused: 'Break started',
        ended: 'Session ended',
      };
      const colors: Record<string, string> = {
        active: 'text-green-700 dark:text-green-400',
        paused: 'text-yellow-700 dark:text-yellow-400',
        ended: 'text-red-700 dark:text-red-400',
      };
      // If resuming from pause
      const oldState = payload.oldState as string;
      const label = oldState === 'paused' && newState === 'active' ? 'Break ended (resumed)' : (labels[newState] || `State → ${newState}`);
      return {
        icon: getStateIcon(newState),
        description: `${label} by ${userName}`,
        color: colors[newState] || 'text-gray-700 dark:text-gray-300',
      };
    }
    case 'participant_status_changed': {
      const name = event.participantName || 'Unknown';
      const newStatus = (payload.newStatus as string || '').replace(/_/g, ' ');
      return {
        icon: <Users className="h-3.5 w-3.5 text-blue-500" />,
        description: `${name} marked as ${newStatus} by ${userName}`,
        color: 'text-blue-700 dark:text-blue-400',
      };
    }
    case 'device_assigned': {
      const name = event.participantName || 'Unknown';
      const deviceId = payload.deviceShortId as string || event.deviceMac || '?';
      return {
        icon: <Link className="h-3.5 w-3.5 text-green-500" />,
        description: `Device ${deviceId} assigned to ${name}`,
        color: 'text-green-700 dark:text-green-400',
      };
    }
    case 'device_unassigned': {
      const name = event.participantName || 'Unknown';
      const deviceId = payload.deviceShortId as string || event.deviceMac || '?';
      return {
        icon: <Unlink className="h-3.5 w-3.5 text-gray-500" />,
        description: `Device ${deviceId} unassigned from ${name}`,
        color: 'text-gray-700 dark:text-gray-300',
      };
    }
    case 'alert_opened': {
      const name = event.participantName || 'Unknown';
      const hr = payload.heartRate as number;
      const level = payload.alertLevel as string || 'warning';
      return {
        icon: <AlertTriangle className={`h-3.5 w-3.5 ${level === 'alarm' ? 'text-red-500' : 'text-yellow-500'}`} />,
        description: `${level.toUpperCase()} alert: ${name} HR ${hr || '?'}`,
        color: level === 'alarm' ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400',
      };
    }
    case 'alert_acknowledged': {
      const name = event.participantName || 'Unknown';
      return {
        icon: <CheckCircle className="h-3.5 w-3.5 text-yellow-600" />,
        description: `Alert acknowledged for ${name} by ${userName}`,
        color: 'text-yellow-700 dark:text-yellow-400',
      };
    }
    case 'alert_cleared': {
      const name = event.participantName || 'Unknown';
      return {
        icon: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
        description: `Alert cleared for ${name}`,
        color: 'text-green-700 dark:text-green-400',
      };
    }
    case 'rehab_visit_created': {
      const name = event.participantName || 'Unknown';
      return {
        icon: <Bell className="h-3.5 w-3.5 text-orange-500" />,
        description: `${name} sent to rehab`,
        color: 'text-orange-700 dark:text-orange-400',
      };
    }
    case 'rehab_visit_closed': {
      const name = event.participantName || 'Unknown';
      const disp = (payload.finalDisposition as string || '').replace(/_/g, ' ');
      return {
        icon: <CheckCircle className="h-3.5 w-3.5 text-orange-500" />,
        description: `Rehab visit closed for ${name}: ${disp}`,
        color: 'text-orange-700 dark:text-orange-400',
      };
    }
    default:
      return {
        icon: <Bell className="h-3.5 w-3.5 text-gray-400" />,
        description: `${event.eventType.replace(/_/g, ' ')}`,
        color: 'text-gray-600 dark:text-gray-400',
      };
  }
}

export function SessionTimeline({ events }: SessionTimelineProps) {
  if (events.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">No events recorded</p>;
  }

  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto">
      {events.map((event) => {
        const { icon, description, color } = formatEvent(event);
        return (
          <div key={event.id} className="flex items-center gap-2 text-xs">
            <div className="flex-shrink-0 w-5 flex justify-center">{icon}</div>
            <span className={`flex-1 ${color}`}>{description}</span>
            <span className="flex-shrink-0 font-mono text-gray-400 dark:text-gray-500">{formatLocalTime(event.occurredAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
