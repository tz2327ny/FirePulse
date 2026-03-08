export const config = {
  httpPort: parseInt(process.env.HTTP_PORT || '3001'),
  udpPort: parseInt(process.env.UDP_PORT || '41234'),
  databaseUrl: process.env.DATABASE_URL || 'file:./data/firepulse.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  nodeEnv: process.env.NODE_ENV || 'development',
  mergeWindowMs: parseInt(process.env.MERGE_WINDOW_MS || '3000'),
  writeBufferFlushMs: parseInt(process.env.WRITE_BUFFER_FLUSH_MS || '200'),
  rawTelemetryRetentionHours: parseInt(process.env.RAW_TELEMETRY_RETENTION_HOURS || '168'),
  rollupIntervalMs: parseInt(process.env.ROLLUP_INTERVAL_MS || '5000'),
} as const;
