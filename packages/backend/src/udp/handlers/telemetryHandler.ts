import type { TelemetryPacket } from '../packetParser.js';
import * as telemetryService from '../../services/telemetryService.js';
import * as receiverService from '../../services/receiverService.js';
import * as alertService from '../../services/alertService.js';
import * as settingsService from '../../services/settingsService.js';
import * as deviceService from '../../services/deviceService.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { DEFAULT_HR_WARNING_THRESHOLD, DEFAULT_HR_ALARM_THRESHOLD, DEFAULT_ALERT_COOLDOWN_MS } from '@heartbeat/shared';

export async function handleTelemetryPacket(packet: TelemetryPacket) {
  try {
    // Auto-register receiver if unknown
    await receiverService.autoRegister(packet.receiver_id, packet.receiver_name);
    await receiverService.updateLastSeen(packet.receiver_id);

    // Process telemetry (raw insert + merge + broadcast)
    await telemetryService.processTelemetry(
      packet.receiver_id,
      packet.device_mac.toUpperCase(),
      packet.device_name || null,
      packet.heart_rate,
      packet.rssi,
      packet.raw_advertisement_data || null,
      new Date(packet.timestamp)
    );

    // Check for HR alerts if session is active
    if (packet.heart_rate > 0) {
      const activeSession = await prisma.session.findFirst({
        where: { state: 'active' },
        orderBy: { createdAt: 'desc' },
      });

      if (activeSession) {
        const device = await deviceService.getByMac(packet.device_mac.toUpperCase());
        if (device) {
          const assignment = await deviceService.getCurrentAssignment(device.id);
          if (assignment) {
            const warningThreshold = await settingsService.getNumber('hr_warning_threshold', DEFAULT_HR_WARNING_THRESHOLD);
            const alarmThreshold = await settingsService.getNumber('hr_alarm_threshold', DEFAULT_HR_ALARM_THRESHOLD);
            const cooldown = await settingsService.getNumber('alert_cooldown_ms', DEFAULT_ALERT_COOLDOWN_MS);

            await alertService.checkHeartRateAlert(
              activeSession.id,
              assignment.participantId,
              device.id,
              packet.heart_rate,
              warningThreshold,
              alarmThreshold,
              cooldown
            );
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err, packet: packet.device_mac }, 'Error processing telemetry packet');
  }
}
