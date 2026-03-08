import type { HeartbeatPacket } from '../packetParser.js';
import * as receiverService from '../../services/receiverService.js';
import { eventBus } from '../../lib/eventBus.js';
import { logger } from '../../lib/logger.js';

export async function handleHeartbeatPacket(packet: HeartbeatPacket) {
  try {
    // Auto-register receiver if unknown
    await receiverService.autoRegister(packet.receiver_id);

    // Update receiver heartbeat
    const receiver = await receiverService.updateHeartbeat(packet.receiver_id, {
      ipAddress: packet.ip_address,
      firmwareVersion: packet.firmware_version,
      wifiRssi: packet.wifi_rssi,
      uptimeSeconds: packet.uptime,
    });

    if (receiver) {
      eventBus.emit('receiver:heartbeat', receiver);
    }
  } catch (err) {
    logger.error({ err, receiverId: packet.receiver_id }, 'Error processing heartbeat packet');
  }
}
