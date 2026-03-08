import { FreshnessState } from './enums.js';

// UDP packet from ESP32 — telemetry
export interface UdpTelemetryPacket {
  type: 'telemetry';
  receiver_id: string;
  receiver_name?: string;
  timestamp: string;
  device_mac: string;
  device_name?: string;
  heart_rate: number;
  rssi: number;
  raw_advertisement_data?: string;
}

// UDP packet from ESP32 — receiver heartbeat
export interface UdpHeartbeatPacket {
  type: 'heartbeat';
  receiver_id: string;
  uptime: number;
  ip_address: string;
  wifi_rssi: number;
  firmware_version?: string;
  timestamp: string;
}

// Combined UDP packet type
export type UdpPacket = UdpTelemetryPacket | UdpHeartbeatPacket;

// Current telemetry state for dashboard display
export interface CurrentTelemetryDTO {
  deviceMac: string;
  shortId: string;
  deviceName: string | null;
  heartRate: number | null;
  smoothedRssi: number | null;
  bestReceiverHwId: string | null;
  bestReceiverName: string | null;
  receiverCount: number;
  packetRate: number;
  lastSeenAt: string;
  freshnessState: FreshnessState;
  signalBars: number;
  // Joined participant data (if assigned)
  participantId: string | null;
  participantFirstName: string | null;
  participantLastName: string | null;
  participantCompany: string | null;
  participantStatus: string | null;
  // Session participant record ID (for inline status changes)
  sessionParticipantId: string | null;
}

// Receiver status for UI display
export interface ReceiverStatusDTO {
  id: string;
  receiverHwId: string;
  name: string;
  locationLabel: string | null;
  ipAddress: string | null;
  firmwareVersion: string | null;
  wifiRssi: number | null;
  uptimeSeconds: number | null;
  isOnline: boolean;
  lastHeartbeatAt: string | null;
  lastSeenAt: string | null;
}

// Telemetry rollup for session graphs
export interface TelemetryRollupDTO {
  capturedAt: string;
  heartRate: number | null;
  signalScore: number | null;
  freshnessState: FreshnessState;
}
