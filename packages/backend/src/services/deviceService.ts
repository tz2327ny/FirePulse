import { prisma } from '../lib/prisma.js';
import { macToShortId, SessionEventType } from '@heartbeat/shared';
import * as sessionEventService from './sessionEventService.js';

export async function list(includeArchived = false) {
  const devices = await prisma.device.findMany({
    where: includeArchived ? undefined : { isArchived: false },
    orderBy: { createdAt: 'desc' },
  });

  // Get current assignments (most recent unended assignment per device)
  const assignments = await prisma.deviceAssignment.findMany({
    where: {
      deviceId: { in: devices.map((d) => d.id) },
      unassignedAt: null,
    },
    include: { participant: true },
  });

  const assignmentMap = new Map(assignments.map((a) => [a.deviceId, a]));

  return devices.map((d) => ({
    ...d,
    currentAssignment: assignmentMap.get(d.id) || null,
  }));
}

export async function getById(id: string) {
  return prisma.device.findUnique({
    where: { id },
    include: {
      deviceAssignments: {
        orderBy: { assignedAt: 'desc' },
        take: 10,
        include: { participant: true },
      },
    },
  });
}

export async function autoRegister(macAddress: string, deviceName?: string) {
  const existing = await prisma.device.findUnique({ where: { macAddress } });
  if (existing) return existing;

  return prisma.device.create({
    data: {
      macAddress,
      shortId: macToShortId(macAddress),
      deviceName: deviceName || null,
      deviceType: 'unknown',
    },
  });
}

export async function assign(
  deviceId: string,
  participantId: string,
  sessionId?: string,
  userId?: string
) {
  // End any current assignment for this device
  await prisma.deviceAssignment.updateMany({
    where: { deviceId, unassignedAt: null },
    data: { unassignedAt: new Date() },
  });

  const assignment = await prisma.deviceAssignment.create({
    data: {
      deviceId,
      participantId,
      sessionId: sessionId || null,
      assignedByUserId: userId || null,
    },
  });

  // Log to session events for activity timeline
  if (sessionId) {
    const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { shortId: true } });
    await sessionEventService.log({
      sessionId,
      eventType: SessionEventType.DEVICE_ASSIGNED,
      participantId,
      deviceId,
      userId,
      payload: { deviceShortId: device?.shortId },
    });
  }

  return assignment;
}

export async function unassign(deviceId: string) {
  // Get current assignment before ending it (for event logging)
  const current = await prisma.deviceAssignment.findFirst({
    where: { deviceId, unassignedAt: null },
    include: { device: { select: { shortId: true } } },
  });

  const result = await prisma.deviceAssignment.updateMany({
    where: { deviceId, unassignedAt: null },
    data: { unassignedAt: new Date() },
  });

  // Log to session events for activity timeline
  if (current?.sessionId) {
    await sessionEventService.log({
      sessionId: current.sessionId,
      eventType: SessionEventType.DEVICE_UNASSIGNED,
      participantId: current.participantId,
      deviceId,
      payload: { deviceShortId: current.device?.shortId },
    });
  }

  return result;
}

export async function setIgnored(deviceId: string, ignored: boolean) {
  return prisma.device.update({
    where: { id: deviceId },
    data: { isIgnored: ignored },
  });
}

export async function archive(deviceId: string) {
  return prisma.device.update({
    where: { id: deviceId },
    data: { isArchived: true },
  });
}

export async function getCurrentAssignment(deviceId: string) {
  return prisma.deviceAssignment.findFirst({
    where: { deviceId, unassignedAt: null },
    include: { participant: true },
  });
}

export async function getByMac(macAddress: string) {
  return prisma.device.findUnique({ where: { macAddress } });
}
