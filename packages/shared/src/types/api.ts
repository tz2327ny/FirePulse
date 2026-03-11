import {
  SessionState,
  ParticipantStatus,
  AlertLevel,
  AlertStatus,
  AlertSource,
  DeviceType,
  UserRole,
} from './enums.js';

// ---- Auth ----
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserDTO;
}

export interface UserDTO {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

// Admin-only user view (includes isActive + createdAt)
export interface AdminUserDTO {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

// ---- Audit Log ----
export interface AuditLogDTO {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  userName: string | null;
  details: Record<string, unknown> | null;
  occurredAt: string;
}

// ---- Participants ----
export interface ParticipantDTO {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  isArchived: boolean;
  createdAt: string;
}

export interface CreateParticipantRequest {
  firstName: string;
  lastName: string;
  company: string;
}

export interface UpdateParticipantRequest {
  firstName?: string;
  lastName?: string;
  company?: string;
}

// ---- Devices ----
export interface DeviceDTO {
  id: string;
  macAddress: string;
  shortId: string;
  deviceName: string | null;
  deviceType: DeviceType;
  isIgnored: boolean;
  isArchived: boolean;
  currentParticipantId: string | null;
  currentParticipantName: string | null;
  createdAt: string;
}

export interface AssignDeviceRequest {
  participantId: string;
  sessionId?: string;
}

// ---- Classes ----
export interface ClassDTO {
  id: string;
  name: string;
  courseType: string | null;
  description: string | null;
  isArchived: boolean;
  participantCount: number;
  createdAt: string;
}

export interface CreateClassRequest {
  name: string;
  courseType?: string;
  description?: string;
  participantIds?: string[];
}

export interface UpdateClassRequest {
  name?: string;
  courseType?: string;
  description?: string;
}

// ---- Class Roster (resolved for dashboard) ----
export interface ClassRosterItemDTO {
  classParticipantId: string;
  participantId: string;
  firstName: string;
  lastName: string;
  company: string;           // resolved: defaultCompanyOverride ?? participant.company
  deviceId: string | null;
  deviceMac: string | null;
  deviceShortId: string | null;
}

// ---- Sessions ----
export interface SessionBreakDTO {
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
}

export interface SessionTimingDTO {
  totalDurationMs: number;
  activeDurationMs: number;
  breakCount: number;
  totalBreakMs: number;
  breaks: SessionBreakDTO[];
}

export interface SessionDTO {
  id: string;
  classId: string | null;
  className: string | null;
  name: string;
  state: SessionState;
  startedAt: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  activeAlertCount: number;
  timing: SessionTimingDTO | null;
  createdAt: string;
}

export interface CreateSessionRequest {
  classId?: string;
  name: string;
}

export interface SessionParticipantDTO {
  id: string;
  participantId: string;
  firstName: string;
  lastName: string;
  company: string;
  status: ParticipantStatus;
  deviceMac: string | null;
  deviceShortId: string | null;
}

export interface UpdateParticipantStatusRequest {
  status: ParticipantStatus;
  note?: string;
}

// ---- Alerts ----
export interface AlertDTO {
  id: string;
  sessionId: string;
  participantId: string | null;
  participantName: string | null;
  deviceId: string | null;
  alertSource: AlertSource;
  alertLevel: AlertLevel;
  status: AlertStatus;
  openedAt: string;
  acknowledgedAt: string | null;
  clearedAt: string | null;
  acknowledgedByName: string | null;
  metadataJson: Record<string, unknown> | null;
}

// ---- Settings ----
export interface SettingDTO {
  key: string;
  value: string;
  description: string | null;
}

export interface UpdateSettingsRequest {
  settings: Array<{ key: string; value: string }>;
}

// ---- Receivers ----
export interface UpdateReceiverRequest {
  name?: string;
  locationLabel?: string;
}

// ---- Session Events ----
export interface SessionEventDTO {
  id: string;
  sessionId: string;
  eventType: string;
  participantName: string | null;
  deviceMac: string | null;
  receiverName: string | null;
  userName: string | null;
  payloadJson: Record<string, unknown> | null;
  occurredAt: string;
}

// ---- Generic API response wrappers ----
export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

// ---- Rehab ----
export interface RehabCheckpointDTO {
  id: string;
  rehabVisitId: string;
  checkpointType: string;
  timestamp: string;
  liveHrSnapshot: number | null;
  manualHr: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  respirations: number | null;
  spo2: number | null;
  temperature: number | null;
  temperatureMethod: string | null;
  note: string | null;
  disposition: string | null;
  enteredByName: string | null;
  createdAt: string;
}

export interface RehabVisitDTO {
  id: string;
  sessionId: string;
  participantId: string;
  participantName: string;
  participantCompany: string;
  startedAt: string;
  endedAt: string | null;
  finalDisposition: string | null;
  createdByName: string | null;
  checkpoints: RehabCheckpointDTO[];
  checkpointCount: number;
  updatedAt: string;
}

export interface CreateRehabVisitRequest {
  sessionId: string;
  participantId: string;
}

export interface CreateCheckpointRequest {
  checkpointType: string;
  manualHr?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  respirations?: number;
  spo2?: number;
  temperature?: number;
  temperatureMethod?: string;
  note?: string;
  disposition?: string;
}

export interface CloseRehabVisitRequest {
  finalDisposition: string;
}
