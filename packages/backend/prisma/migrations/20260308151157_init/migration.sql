-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'instructor',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "course_type" TEXT,
    "description" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "class_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "default_company_override" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "class_participants_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "class_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'standby',
    "started_at" DATETIME,
    "paused_at" DATETIME,
    "ended_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "participant_status_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_participant_id" TEXT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT NOT NULL,
    "changed_by_user_id" TEXT,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "participant_status_events_session_participant_id_fkey" FOREIGN KEY ("session_participant_id") REFERENCES "session_participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "participant_status_events_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mac_address" TEXT NOT NULL,
    "short_id" TEXT NOT NULL,
    "device_name" TEXT,
    "device_type" TEXT NOT NULL DEFAULT 'unknown',
    "is_ignored" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "device_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "session_id" TEXT,
    "participant_id" TEXT NOT NULL,
    "assigned_by_user_id" TEXT,
    "assigned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" DATETIME,
    "note" TEXT,
    CONSTRAINT "device_assignments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "device_assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "device_assignments_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "device_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "receivers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiver_hw_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location_label" TEXT,
    "ip_address" TEXT,
    "firmware_version" TEXT,
    "wifi_rssi" INTEGER,
    "uptime_seconds" INTEGER,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_heartbeat_at" DATETIME,
    "last_seen_at" DATETIME,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "receiver_status_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiver_id" TEXT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT NOT NULL,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "receiver_status_events_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "receivers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "raw_telemetry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiver_hw_id" TEXT NOT NULL,
    "device_mac" TEXT NOT NULL,
    "device_name" TEXT,
    "heart_rate" INTEGER,
    "rssi" INTEGER NOT NULL,
    "raw_payload" TEXT,
    "packet_timestamp" DATETIME NOT NULL,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "current_telemetry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "device_mac" TEXT NOT NULL,
    "heart_rate" INTEGER,
    "smoothed_rssi" INTEGER,
    "best_receiver_hw_id" TEXT,
    "receiver_count" INTEGER NOT NULL DEFAULT 0,
    "packet_rate" REAL NOT NULL DEFAULT 0,
    "last_seen_at" DATETIME NOT NULL,
    "freshness_state" TEXT NOT NULL DEFAULT 'offline',
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "current_telemetry_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_telemetry_rollups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "captured_at" DATETIME NOT NULL,
    "heart_rate" INTEGER,
    "signal_score" INTEGER,
    "freshness_state" TEXT,
    CONSTRAINT "session_telemetry_rollups_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_telemetry_rollups_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_telemetry_rollups_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "participant_id" TEXT,
    "device_id" TEXT,
    "alert_source" TEXT NOT NULL,
    "alert_level" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" DATETIME,
    "cleared_at" DATETIME,
    "acknowledged_by_user_id" TEXT,
    "metadata_json" TEXT,
    CONSTRAINT "alerts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "alerts_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "alerts_acknowledged_by_user_id_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "participant_id" TEXT,
    "device_id" TEXT,
    "receiver_id" TEXT,
    "user_id" TEXT,
    "payload_json" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "session_events_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "session_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "user_id" TEXT,
    "details" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rehab_visits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME,
    "final_disposition" TEXT,
    "created_by_user_id" TEXT,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "rehab_visits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rehab_visits_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rehab_visits_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rehab_checkpoints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rehab_visit_id" TEXT NOT NULL,
    "checkpoint_type" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "live_hr_snapshot" INTEGER,
    "manual_hr" INTEGER,
    "bp_systolic" INTEGER,
    "bp_diastolic" INTEGER,
    "respirations" INTEGER,
    "spo2" INTEGER,
    "temperature" REAL,
    "temperature_method" TEXT,
    "note" TEXT,
    "disposition" TEXT,
    "entered_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rehab_checkpoints_rehab_visit_id_fkey" FOREIGN KEY ("rehab_visit_id") REFERENCES "rehab_visits" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rehab_checkpoints_entered_by_user_id_fkey" FOREIGN KEY ("entered_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "class_participants_class_id_participant_id_key" ON "class_participants"("class_id", "participant_id");

-- CreateIndex
CREATE INDEX "sessions_state_idx" ON "sessions"("state");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_session_id_participant_id_key" ON "session_participants"("session_id", "participant_id");

-- CreateIndex
CREATE INDEX "participant_status_events_session_participant_id_idx" ON "participant_status_events"("session_participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_mac_address_key" ON "devices"("mac_address");

-- CreateIndex
CREATE INDEX "device_assignments_device_id_unassigned_at_idx" ON "device_assignments"("device_id", "unassigned_at");

-- CreateIndex
CREATE INDEX "device_assignments_participant_id_idx" ON "device_assignments"("participant_id");

-- CreateIndex
CREATE INDEX "device_assignments_session_id_idx" ON "device_assignments"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "receivers_receiver_hw_id_key" ON "receivers"("receiver_hw_id");

-- CreateIndex
CREATE INDEX "receiver_status_events_receiver_id_occurred_at_idx" ON "receiver_status_events"("receiver_id", "occurred_at");

-- CreateIndex
CREATE INDEX "raw_telemetry_device_mac_received_at_idx" ON "raw_telemetry"("device_mac", "received_at");

-- CreateIndex
CREATE INDEX "raw_telemetry_received_at_idx" ON "raw_telemetry"("received_at");

-- CreateIndex
CREATE INDEX "raw_telemetry_receiver_hw_id_received_at_idx" ON "raw_telemetry"("receiver_hw_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "current_telemetry_device_id_key" ON "current_telemetry"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "current_telemetry_device_mac_key" ON "current_telemetry"("device_mac");

-- CreateIndex
CREATE INDEX "session_telemetry_rollups_session_id_participant_id_captured_at_idx" ON "session_telemetry_rollups"("session_id", "participant_id", "captured_at");

-- CreateIndex
CREATE INDEX "session_telemetry_rollups_captured_at_idx" ON "session_telemetry_rollups"("captured_at");

-- CreateIndex
CREATE INDEX "alerts_session_id_status_idx" ON "alerts"("session_id", "status");

-- CreateIndex
CREATE INDEX "alerts_participant_id_idx" ON "alerts"("participant_id");

-- CreateIndex
CREATE INDEX "session_events_session_id_occurred_at_idx" ON "session_events"("session_id", "occurred_at");

-- CreateIndex
CREATE INDEX "session_events_event_type_idx" ON "session_events"("event_type");

-- CreateIndex
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "rehab_visits_session_id_participant_id_idx" ON "rehab_visits"("session_id", "participant_id");

-- CreateIndex
CREATE INDEX "rehab_checkpoints_rehab_visit_id_idx" ON "rehab_checkpoints"("rehab_visit_id");
