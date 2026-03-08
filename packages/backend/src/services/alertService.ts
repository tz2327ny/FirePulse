import { prisma } from '../lib/prisma.js';
import { eventBus } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';
import { AlertLevel, AlertSource, AlertStatus, SessionEventType } from '@heartbeat/shared';
import * as sessionEventService from './sessionEventService.js';

// Track last alert time per device to enforce cooldown
const alertCooldowns = new Map<string, number>();

export async function list(sessionId?: string, statusFilter?: string) {
  return prisma.alert.findMany({
    where: {
      ...(sessionId ? { sessionId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      participant: { select: { firstName: true, lastName: true } },
      acknowledgedBy: { select: { displayName: true } },
    },
    orderBy: { openedAt: 'desc' },
  });
}

export async function acknowledge(alertId: string, userId: string) {
  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: AlertStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
      acknowledgedByUserId: userId,
    },
  });

  eventBus.emit('alert:updated', alert);

  await sessionEventService.log({
    sessionId: alert.sessionId,
    eventType: SessionEventType.ALERT_ACKNOWLEDGED,
    participantId: alert.participantId || undefined,
    deviceId: alert.deviceId || undefined,
    userId,
    payload: { alertId: alert.id, alertLevel: alert.alertLevel },
  });

  return alert;
}

export async function clearAlert(alertId: string) {
  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: AlertStatus.CLEARED,
      clearedAt: new Date(),
    },
  });

  eventBus.emit('alert:updated', alert);

  await sessionEventService.log({
    sessionId: alert.sessionId,
    eventType: SessionEventType.ALERT_CLEARED,
    participantId: alert.participantId || undefined,
    deviceId: alert.deviceId || undefined,
    payload: { alertId: alert.id, alertLevel: alert.alertLevel },
  });

  return alert;
}

export async function checkHeartRateAlert(
  sessionId: string,
  participantId: string | null,
  deviceId: string | null,
  heartRate: number,
  warningThreshold: number,
  alarmThreshold: number,
  cooldownMs: number
) {
  if (!participantId) return;

  const cooldownKey = `hr:${deviceId || participantId}`;
  const lastAlertTime = alertCooldowns.get(cooldownKey) || 0;
  if (Date.now() - lastAlertTime < cooldownMs) return;

  let level: AlertLevel | null = null;
  if (heartRate >= alarmThreshold) {
    level = AlertLevel.ALARM;
  } else if (heartRate >= warningThreshold) {
    level = AlertLevel.WARNING;
  }

  if (!level) return;

  // Check if there's already an active alert for this participant
  const existing = await prisma.alert.findFirst({
    where: {
      sessionId,
      participantId,
      alertSource: AlertSource.HEART_RATE,
      status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
    },
  });

  if (existing) {
    // Upgrade level if needed
    if (level === AlertLevel.ALARM && existing.alertLevel === AlertLevel.WARNING) {
      await prisma.alert.update({
        where: { id: existing.id },
        data: { alertLevel: level, metadataJson: JSON.stringify({ heartRate }) },
      });
    }
    return;
  }

  const alert = await prisma.alert.create({
    data: {
      sessionId,
      participantId,
      deviceId,
      alertSource: AlertSource.HEART_RATE,
      alertLevel: level,
      status: AlertStatus.ACTIVE,
      metadataJson: JSON.stringify({ heartRate }),
    },
  });

  alertCooldowns.set(cooldownKey, Date.now());
  logger.warn({ participantId, heartRate, level }, 'Heart rate alert triggered');

  eventBus.emit('alert:new', alert);

  await sessionEventService.log({
    sessionId,
    eventType: SessionEventType.ALERT_OPENED,
    participantId: participantId || undefined,
    deviceId: deviceId || undefined,
    payload: { alertId: alert.id, alertLevel: level, heartRate },
  });

  return alert;
}

export async function getActiveCount(sessionId: string) {
  return prisma.alert.count({
    where: { sessionId, status: AlertStatus.ACTIVE },
  });
}
