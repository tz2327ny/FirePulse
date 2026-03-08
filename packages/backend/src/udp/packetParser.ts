import { z } from 'zod';

const telemetryPacketSchema = z.object({
  type: z.literal('telemetry'),
  receiver_id: z.string().min(1),
  receiver_name: z.string().optional(),
  timestamp: z.string(),
  device_mac: z.string().regex(/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/),
  device_name: z.string().optional(),
  heart_rate: z.number().int().min(0).max(300),
  rssi: z.number().int(),
  raw_advertisement_data: z.string().optional(),
});

const heartbeatPacketSchema = z.object({
  type: z.literal('heartbeat'),
  receiver_id: z.string().min(1),
  uptime: z.number().int().min(0),
  ip_address: z.string(),
  wifi_rssi: z.number().int(),
  firmware_version: z.string().optional(),
  timestamp: z.string(),
});

export type TelemetryPacket = z.infer<typeof telemetryPacketSchema>;
export type HeartbeatPacket = z.infer<typeof heartbeatPacketSchema>;

export function parseTelemetryPacket(data: unknown): TelemetryPacket | null {
  const result = telemetryPacketSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseHeartbeatPacket(data: unknown): HeartbeatPacket | null {
  const result = heartbeatPacketSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parsePacketType(data: unknown): 'telemetry' | 'heartbeat' | null {
  if (typeof data === 'object' && data !== null && 'type' in data) {
    const type = (data as Record<string, unknown>).type;
    if (type === 'telemetry' || type === 'heartbeat') return type;
  }
  return null;
}
