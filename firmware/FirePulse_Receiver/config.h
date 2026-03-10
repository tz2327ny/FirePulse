#ifndef CONFIG_H
#define CONFIG_H

// ── Wi-Fi ────────────────────────────────────────────────
#define WIFI_SSID              "FirePulse"
#define WIFI_PASSWORD          "firepulse123"
#define WIFI_CONNECT_TIMEOUT_MS 15000
#define WIFI_RETRY_DELAY_MS     5000

// ── UDP Target ───────────────────────────────────────────
#define UDP_HOST               "10.0.50.1"
#define UDP_PORT               41234

// ── NTP Time Sync ────────────────────────────────────────
#define NTP_SERVER             "10.0.50.1"
#define NTP_SYNC_INTERVAL_MS   (30 * 60 * 1000)   // 30 minutes

// ── BLE Scanning ─────────────────────────────────────────
#define POLAR_COMPANY_ID_LOW   0x6B
#define POLAR_COMPANY_ID_HIGH  0x00
#define POLAR_MFG_DATA_MIN_LEN 6        // Minimum bytes for valid HR broadcast
#define POLAR_HR_BYTE_INDEX    5        // Stable HR at byte 5
#define DEDUP_WINDOW_MS        800      // Ignore repeated broadcasts within this window

// ── Heartbeat Packet ─────────────────────────────────────
#define HEARTBEAT_INTERVAL_MS  10000    // 10 seconds

// ── Firmware Identity ────────────────────────────────────
#define FIRMWARE_VERSION       "1.0.0"

// ── LED ──────────────────────────────────────────────────
#define LED_PIN                2        // Built-in LED on most ESP32-S3 boards

// ── Serial Debug ─────────────────────────────────────────
#define SERIAL_BAUD            115200

#endif
