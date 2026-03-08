// Default port numbers
export const DEFAULT_HTTP_PORT = 3001;
export const DEFAULT_UDP_PORT = 41234;

// Telemetry processing defaults
export const DEFAULT_MERGE_WINDOW_MS = 3000;
export const DEFAULT_WRITE_BUFFER_FLUSH_MS = 200;
export const DEFAULT_ROLLUP_INTERVAL_MS = 5000;

// Data retention
export const DEFAULT_RAW_TELEMETRY_RETENTION_HOURS = 168; // 7 days

// Alert defaults
export const DEFAULT_HR_WARNING_THRESHOLD = 160;
export const DEFAULT_HR_ALARM_THRESHOLD = 180;
export const DEFAULT_ALERT_COOLDOWN_MS = 60000; // 1 minute between re-triggers

// Sweeper intervals
export const STALE_SWEEP_INTERVAL_MS = 10000;
export const RECEIVER_SWEEP_INTERVAL_MS = 10000;
export const ROLLUP_FLUSH_INTERVAL_MS = 5000;
export const RAW_PRUNE_INTERVAL_MS = 3600000; // 1 hour
