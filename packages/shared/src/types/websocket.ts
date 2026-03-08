import { CurrentTelemetryDTO, ReceiverStatusDTO } from './telemetry.js';
import { AlertDTO, SessionDTO } from './api.js';

// Server -> Client events
export interface ServerToClientEvents {
  'telemetry:update': (data: CurrentTelemetryDTO[]) => void;
  'receiver:status': (data: ReceiverStatusDTO) => void;
  'receiver:heartbeat': (data: ReceiverStatusDTO) => void;
  'alert:new': (data: AlertDTO) => void;
  'alert:updated': (data: AlertDTO) => void;
  'session:updated': (data: SessionDTO) => void;
}

// Client -> Server events
export interface ClientToServerEvents {
  'subscribe:telemetry': () => void;
  'unsubscribe:telemetry': () => void;
  'subscribe:session': (sessionId: string) => void;
  'unsubscribe:session': (sessionId: string) => void;
}

// Socket data attached after auth
export interface SocketData {
  userId: string;
  username: string;
  role: string;
}
