/*
 * FirePulse Receiver — ESP32-S3 BLE Heart Rate Scanner
 *
 * Passively scans for Polar H10, OH1+, and Verity Sense heart rate
 * sensors. Reads HR from BLE broadcast advertisements (no GATT
 * connection needed) and forwards as UDP JSON to the FirePulse backend.
 *
 * Multiple ESP32 receivers can all see the same sensor broadcasts
 * simultaneously — the backend merges by best RSSI.
 *
 * Required libraries (install via Arduino Library Manager):
 *   - NimBLE-Arduino (by h2zero)
 *   - ArduinoJson (by Benoit Blanchon, v7)
 *
 * Board settings:
 *   - Board: ESP32S3 Dev Module
 *   - USB CDC On Boot: Enabled
 *   - Partition Scheme: Default 4MB
 */

#include <WiFi.h>
#include <WiFiUdp.h>
#include <NimBLEDevice.h>
#include <ArduinoJson.h>
#include <time.h>
#include <esp_sntp.h>
#include <esp_mac.h>

#include "config.h"

// ── Global State ─────────────────────────────────────────

// Identity — derived from ESP32 chip MAC in setup()
static char receiverId[16];     // "ESP32-AABBCC"
static char receiverName[24];   // "Receiver AABBCC"

// Network
static WiFiUDP udp;
static bool wifiConnected = false;

// BLE scan
static NimBLEScan* pScan = nullptr;

// Deduplication: track last send time per device MAC
// Using a simple fixed-size array — practical limit of 32 unique devices
#define MAX_TRACKED_DEVICES 32

struct TrackedDevice {
  NimBLEAddress address;
  unsigned long lastSendMs;
  bool active;
};

static TrackedDevice trackedDevices[MAX_TRACKED_DEVICES];
static int trackedDeviceCount = 0;

// Timing
static unsigned long lastHeartbeatMs = 0;
static unsigned long bootTimeMs = 0;
static bool timeSynced = false;

// LED state
static unsigned long lastLedToggleMs = 0;
static bool ledState = false;
static int hrDevicesSeen = 0;       // Count of unique devices seen this scan cycle
static unsigned long lastHrSeenMs = 0;

// ── Forward Declarations ─────────────────────────────────

void deriveReceiverId();
void connectWiFi();
void handleWiFi();
void syncTime();
void initBLE();
void sendTelemetryPacket(const char* deviceMac, const char* deviceName,
                         uint16_t heartRate, int rssi);
void sendHeartbeatPacket();
String getIsoTimestamp();
void updateLED();
int findOrAddDevice(const NimBLEAddress& addr);
String formatMac(const NimBLEAddress& addr);

// ── BLE Scan Callbacks ───────────────────────────────────

class ScanCallbacks : public NimBLEScanCallbacks {

  void onResult(const NimBLEAdvertisedDevice* device) override {
    // Get manufacturer data
    if (!device->haveManufacturerData()) return;

    const std::string& mfgData = device->getManufacturerData();

    // Check minimum length (2 bytes company ID + 4 bytes data = 6)
    if (mfgData.length() < POLAR_MFG_DATA_MIN_LEN) return;

    // Check Polar company ID (0x006B, little-endian: 0x6B, 0x00)
    if ((uint8_t)mfgData[0] != POLAR_COMPANY_ID_LOW ||
        (uint8_t)mfgData[1] != POLAR_COMPANY_ID_HIGH) return;

    // Extract stable heart rate from byte 5
    uint8_t heartRate = (uint8_t)mfgData[POLAR_HR_BYTE_INDEX];

    // Skip if HR is 0 (sensor not on skin / not reading)
    if (heartRate == 0) return;

    // Deduplication — skip if we sent for this device recently
    NimBLEAddress addr = device->getAddress();
    int idx = findOrAddDevice(addr);
    if (idx < 0) return;  // Tracking table full

    unsigned long now = millis();
    if (trackedDevices[idx].lastSendMs > 0 &&
        (now - trackedDevices[idx].lastSendMs) < DEDUP_WINDOW_MS) {
      return;  // Too soon since last send for this device
    }

    // Format device info
    String macStr = formatMac(addr);
    String name = "";
    if (device->haveName()) {
      name = device->getName().c_str();
    }

    int rssi = device->getRSSI();

    // Send UDP telemetry
    sendTelemetryPacket(macStr.c_str(), name.c_str(), heartRate, rssi);

    // Update tracking
    trackedDevices[idx].lastSendMs = now;
    lastHrSeenMs = now;

    // Log first time we see raw bytes for a device (debugging)
    static bool firstLog[MAX_TRACKED_DEVICES] = {false};
    if (!firstLog[idx]) {
      firstLog[idx] = true;
      Serial.printf("[SCAN] Polar device first seen, raw mfg data (%d bytes):",
                    mfgData.length());
      for (size_t i = 0; i < mfgData.length(); i++) {
        Serial.printf(" %02X", (uint8_t)mfgData[i]);
      }
      Serial.println();
    }

    Serial.printf("[HR] %s %s HR=%d RSSI=%d\n",
                  name.length() > 0 ? name.c_str() : "Polar",
                  macStr.c_str(), heartRate, rssi);
  }

  void onScanEnd(const NimBLEScanResults& results, int reason) override {
    // Scan ended — will be restarted in loop()
  }
};

static ScanCallbacks scanCallbacks;

// ── Setup ────────────────────────────────────────────────

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(1000);  // Give USB CDC time to initialize

  Serial.println();
  Serial.println("========================================");
  Serial.println(" FirePulse Receiver " FIRMWARE_VERSION);
  Serial.println("========================================");

  // LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);

  // Derive unique receiver ID from chip MAC
  deriveReceiverId();
  Serial.printf("[BOOT] Receiver ID: %s\n", receiverId);

  bootTimeMs = millis();

  // Initialize tracked devices
  memset(trackedDevices, 0, sizeof(trackedDevices));

  // Connect Wi-Fi
  connectWiFi();

  // Sync time via NTP from Pi
  syncTime();

  // Initialize BLE
  initBLE();

  Serial.println("[BOOT] Setup complete, scanning for Polar sensors...");
  Serial.println();
}

// ── Main Loop ────────────────────────────────────────────

void loop() {
  // 1. Handle Wi-Fi reconnection
  handleWiFi();

  // 2. Restart BLE scan if it stopped
  if (pScan && !pScan->isScanning() && wifiConnected) {
    pScan->start(0, false);  // 0 = scan forever, false = non-blocking
  }

  // 3. Send heartbeat every 10 seconds
  unsigned long now = millis();
  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeatPacket();
    lastHeartbeatMs = now;
  }

  // 4. Update LED
  updateLED();

  // 5. Yield to prevent watchdog reset
  delay(10);
}

// ── Identity ─────────────────────────────────────────────

void deriveReceiverId() {
  uint8_t mac[6];
  esp_efuse_mac_get_default(mac);
  char suffix[7];
  snprintf(suffix, sizeof(suffix), "%02X%02X%02X", mac[3], mac[4], mac[5]);
  snprintf(receiverId, sizeof(receiverId), "ESP32-%s", suffix);
  snprintf(receiverName, sizeof(receiverName), "Receiver %s", suffix);
}

// ── Wi-Fi ────────────────────────────────────────────────

void connectWiFi() {
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");

    // Blink LED while connecting
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);

    if (millis() - start > WIFI_CONNECT_TIMEOUT_MS) {
      Serial.println(" TIMEOUT");
      Serial.println("[WIFI] Will retry in loop");
      wifiConnected = false;
      return;
    }
  }

  wifiConnected = true;
  Serial.println(" OK");
  Serial.printf("[WIFI] IP: %s, RSSI: %d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

void handleWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConnected) {
      wifiConnected = true;
      Serial.printf("[WIFI] Reconnected, IP: %s\n",
                    WiFi.localIP().toString().c_str());
      syncTime();  // Re-sync time on reconnect
    }
    return;
  }

  // Lost connection
  if (wifiConnected) {
    wifiConnected = false;
    Serial.println("[WIFI] Disconnected");
  }

  // ESP32 WiFi has auto-reconnect, but nudge it periodically
  static unsigned long lastRetry = 0;
  if (millis() - lastRetry > WIFI_RETRY_DELAY_MS) {
    Serial.println("[WIFI] Attempting reconnect...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    lastRetry = millis();
  }
}

// ── Time Sync ────────────────────────────────────────────

void syncTime() {
  Serial.printf("[TIME] Syncing via NTP from %s...\n", NTP_SERVER);

  // Set SNTP re-sync interval to 30 minutes
  sntp_set_sync_interval(NTP_SYNC_INTERVAL_MS);

  // Configure SNTP — timezone offset 0 (UTC), no daylight saving
  configTime(0, 0, NTP_SERVER);

  // Wait up to 5 seconds for initial sync
  struct tm timeinfo;
  int retries = 0;
  while (!getLocalTime(&timeinfo, 1000) && retries < 5) {
    retries++;
    Serial.print(".");
  }

  if (retries < 5) {
    timeSynced = true;
    char buf[30];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    Serial.printf("\n[TIME] Synced: %s\n", buf);
  } else {
    Serial.println("\n[TIME] Sync failed, timestamps will be approximate");
  }
}

// ── BLE ──────────────────────────────────────────────────

void initBLE() {
  Serial.println("[BLE]  Initializing NimBLE...");

  NimBLEDevice::init("");

  pScan = NimBLEDevice::getScan();
  pScan->setScanCallbacks(&scanCallbacks, false);
  pScan->setActiveScan(true);   // Request scan responses (gets device names)
  pScan->setInterval(100);      // Scan interval in 0.625ms units (62.5ms)
  pScan->setWindow(99);         // Scan window — nearly continuous
  pScan->setDuplicateFilter(false);  // We handle dedup ourselves

  // Start scanning — 0 means scan indefinitely
  pScan->start(0, false);

  Serial.println("[BLE]  Scanning started (continuous, passive broadcast mode)");
}

// ── Device Tracking / Deduplication ──────────────────────

int findOrAddDevice(const NimBLEAddress& addr) {
  // Search existing entries
  for (int i = 0; i < trackedDeviceCount; i++) {
    if (trackedDevices[i].active && trackedDevices[i].address == addr) {
      return i;
    }
  }

  // Add new entry if space available
  if (trackedDeviceCount < MAX_TRACKED_DEVICES) {
    int idx = trackedDeviceCount++;
    trackedDevices[idx].address = addr;
    trackedDevices[idx].lastSendMs = 0;
    trackedDevices[idx].active = true;
    return idx;
  }

  // Table full — try to reuse a stale slot (no data in 60s)
  unsigned long now = millis();
  for (int i = 0; i < MAX_TRACKED_DEVICES; i++) {
    if (trackedDevices[i].active &&
        (now - trackedDevices[i].lastSendMs) > 60000) {
      trackedDevices[i].address = addr;
      trackedDevices[i].lastSendMs = 0;
      return i;
    }
  }

  Serial.println("[WARN] Device tracking table full");
  return -1;
}

// ── MAC Address Formatting ───────────────────────────────

String formatMac(const NimBLEAddress& addr) {
  // NimBLEAddress::toString() returns "aa:bb:cc:dd:ee:ff" (lowercase)
  String mac = addr.toString().c_str();
  mac.toUpperCase();
  return mac;
}

// ── Timestamp ────────────────────────────────────────────

String getIsoTimestamp() {
  if (!timeSynced) {
    // Fallback: rough timestamp based on millis
    return "1970-01-01T00:00:00.000Z";
  }

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 0)) {
    return "1970-01-01T00:00:00.000Z";
  }

  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &timeinfo);

  // Add milliseconds
  struct timeval tv;
  gettimeofday(&tv, NULL);
  int ms = tv.tv_usec / 1000;

  char fullBuf[35];
  snprintf(fullBuf, sizeof(fullBuf), "%s.%03dZ", buf, ms);
  return String(fullBuf);
}

// ── UDP Packet Sending ───────────────────────────────────

void sendTelemetryPacket(const char* deviceMac, const char* deviceName,
                         uint16_t heartRate, int rssi) {
  if (!wifiConnected) return;

  JsonDocument doc;
  doc["type"] = "telemetry";
  doc["receiver_id"] = receiverId;
  doc["receiver_name"] = receiverName;
  doc["timestamp"] = getIsoTimestamp();
  doc["device_mac"] = deviceMac;
  if (deviceName[0] != '\0') {
    doc["device_name"] = deviceName;
  }
  doc["heart_rate"] = (int)heartRate;
  doc["rssi"] = rssi;

  char buffer[512];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));

  udp.beginPacket(UDP_HOST, UDP_PORT);
  udp.write((const uint8_t*)buffer, len);
  udp.endPacket();
}

void sendHeartbeatPacket() {
  if (!wifiConnected) return;

  unsigned long uptimeSec = (millis() - bootTimeMs) / 1000;

  JsonDocument doc;
  doc["type"] = "heartbeat";
  doc["receiver_id"] = receiverId;
  doc["uptime"] = (unsigned long)uptimeSec;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["timestamp"] = getIsoTimestamp();

  char buffer[256];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));

  udp.beginPacket(UDP_HOST, UDP_PORT);
  udp.write((const uint8_t*)buffer, len);
  udp.endPacket();

  // Count active devices (seen in last 30s)
  int activeDevices = 0;
  unsigned long now = millis();
  for (int i = 0; i < trackedDeviceCount; i++) {
    if (trackedDevices[i].active &&
        trackedDevices[i].lastSendMs > 0 &&
        (now - trackedDevices[i].lastSendMs) < 30000) {
      activeDevices++;
    }
  }

  Serial.printf("[HB] uptime=%lus IP=%s WiFi=%ddBm devices=%d\n",
                uptimeSec, WiFi.localIP().toString().c_str(),
                WiFi.RSSI(), activeDevices);
}

// ── LED Status ───────────────────────────────────────────

void updateLED() {
  unsigned long now = millis();

  if (!wifiConnected) {
    // Fast blink — Wi-Fi disconnected
    if (now - lastLedToggleMs > 200) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState ? HIGH : LOW);
      lastLedToggleMs = now;
    }
  } else if (lastHrSeenMs == 0 || (now - lastHrSeenMs) > 30000) {
    // Solid on — connected but no HR devices seen recently
    digitalWrite(LED_PIN, HIGH);
  } else {
    // Double-blink pattern — receiving HR data
    unsigned long phase = now % 2000;
    if (phase < 100 || (phase > 200 && phase < 300)) {
      digitalWrite(LED_PIN, HIGH);
    } else {
      digitalWrite(LED_PIN, LOW);
    }
  }
}
