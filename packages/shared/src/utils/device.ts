/**
 * Derive a short ID from a BLE MAC address.
 * Example: "A0:9E:1A:4F:8B:21" -> "8B21"
 */
export function macToShortId(mac: string): string {
  const parts = mac.split(':');
  if (parts.length < 2) return mac;
  return (parts[parts.length - 2] + parts[parts.length - 1]).toUpperCase();
}

/**
 * Validate MAC address format (AA:BB:CC:DD:EE:FF)
 */
export function isValidMac(mac: string): boolean {
  return /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/.test(mac);
}
