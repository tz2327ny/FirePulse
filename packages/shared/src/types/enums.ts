// Session states
export enum SessionState {
  STANDBY = 'standby',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
}

// Participant status within a session
export enum ParticipantStatus {
  PRESENT = 'present',
  LATE = 'late',
  ABSENT = 'absent',
  LEFT_EARLY = 'left_early',
  REMOVED = 'removed',
}

// Freshness states for telemetry
export enum FreshnessState {
  LIVE = 'live',
  DELAYED = 'delayed',
  STALE = 'stale',
  OFFLINE = 'offline',
}

// Alert source types
export enum AlertSource {
  HEART_RATE = 'hr',
  FRESHNESS = 'freshness',
  RECEIVER = 'receiver',
  REHAB = 'rehab',
}

// Alert severity levels
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ALARM = 'alarm',
}

// Alert lifecycle states
export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  CLEARED = 'cleared',
}

// User roles
export enum UserRole {
  ADMIN = 'admin',
  INSTRUCTOR = 'instructor',
  MEDICAL = 'medical',
}

// Device types
export enum DeviceType {
  OH1_PLUS = 'oh1_plus',
  CHEST_STRAP = 'chest_strap',
  GENERIC_HR = 'generic_hr',
  UNKNOWN = 'unknown',
}

// Rehab checkpoint types (future)
export enum RehabCheckpointType {
  INITIAL = 'initial',
  REHAB_ROUTINE = 'rehab_routine',
  REHAB_EVAL = 'rehab_eval',
  END = 'end',
}

// Rehab checkpoint disposition (future)
export enum CheckpointDisposition {
  CLEARED = 'cleared',
  HOLD_EVAL = 'hold_eval',
  NOT_CLEARED = 'not_cleared',
}

// Rehab visit disposition (future)
export enum VisitDisposition {
  PENDING = 'pending',
  RETURNED_TO_TRAINING = 'returned_to_training',
  REMAIN_IN_REHAB = 'remain_in_rehab',
  REFERRED_TO_EMS = 'referred_to_ems',
  TRANSPORTED = 'transported',
  RELEASED_FROM_TRAINING = 'released_from_training',
}

// Session event types
export enum SessionEventType {
  SESSION_CREATED = 'session_created',
  SESSION_STATE_CHANGED = 'session_state_changed',
  PARTICIPANT_STATUS_CHANGED = 'participant_status_changed',
  DEVICE_ASSIGNED = 'device_assigned',
  DEVICE_UNASSIGNED = 'device_unassigned',
  DEVICE_REASSIGNED = 'device_reassigned',
  DEVICE_IGNORED = 'device_ignored',
  ALERT_OPENED = 'alert_opened',
  ALERT_ACKNOWLEDGED = 'alert_acknowledged',
  ALERT_CLEARED = 'alert_cleared',
  RECEIVER_ONLINE = 'receiver_online',
  RECEIVER_OFFLINE = 'receiver_offline',
}
