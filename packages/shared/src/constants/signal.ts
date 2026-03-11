// BLE RSSI thresholds for signal quality (4-tier, RSSI-only)
export const RSSI_EXCELLENT = -65;  // 4 bars
export const RSSI_GOOD = -75;      // 3 bars
export const RSSI_FAIR = -85;      // 2 bars
export const RSSI_POOR = -95;      // 1 bar
// Below -95 = 0 bars

// WiFi RSSI thresholds (different scale from BLE)
export const WIFI_RSSI_EXCELLENT = -50;  // 4 bars
export const WIFI_RSSI_GOOD = -60;      // 3 bars
export const WIFI_RSSI_FAIR = -70;      // 2 bars
export const WIFI_RSSI_POOR = -80;      // 1 bar

// Maximum signal bars
export const MAX_SIGNAL_BARS = 4;
