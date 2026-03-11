import {
  RSSI_EXCELLENT,
  RSSI_GOOD,
  RSSI_FAIR,
  RSSI_POOR,
  WIFI_RSSI_EXCELLENT,
  WIFI_RSSI_GOOD,
  WIFI_RSSI_FAIR,
  WIFI_RSSI_POOR,
} from '../constants/signal.js';

/** Compute 0–4 signal bars from BLE RSSI only */
export function computeSignalBars(rssi: number): number {
  if (rssi > RSSI_EXCELLENT) return 4;
  if (rssi > RSSI_GOOD) return 3;
  if (rssi > RSSI_FAIR) return 2;
  if (rssi > RSSI_POOR) return 1;
  return 0;
}

/** Compute 0–4 signal bars from WiFi RSSI */
export function computeWifiSignalBars(rssi: number): number {
  if (rssi > WIFI_RSSI_EXCELLENT) return 4;
  if (rssi > WIFI_RSSI_GOOD) return 3;
  if (rssi > WIFI_RSSI_FAIR) return 2;
  if (rssi > WIFI_RSSI_POOR) return 1;
  return 0;
}
