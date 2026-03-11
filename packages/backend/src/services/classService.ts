import { prisma } from '../lib/prisma.js';
import type { ClassRosterItemDTO } from '@heartbeat/shared';

export async function list(includeArchived = false) {
  return prisma.class.findMany({
    where: includeArchived ? undefined : { isArchived: false },
    include: { _count: { select: { classParticipants: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  return prisma.class.findUnique({
    where: { id },
    include: {
      classParticipants: {
        include: { participant: true, device: true },
      },
    },
  });
}

export async function create(data: {
  name: string;
  courseType?: string;
  description?: string;
  participantIds?: string[];
}) {
  const { participantIds, ...classData } = data;
  return prisma.class.create({
    data: {
      ...classData,
      classParticipants: participantIds
        ? {
            create: participantIds.map((pid) => ({ participantId: pid })),
          }
        : undefined,
    },
    include: { _count: { select: { classParticipants: true } } },
  });
}

export async function update(id: string, data: { name?: string; courseType?: string; description?: string }) {
  return prisma.class.update({ where: { id }, data });
}

export async function archive(id: string) {
  return prisma.class.update({ where: { id }, data: { isArchived: true } });
}

export async function addParticipants(classId: string, participantIds: string[]) {
  return prisma.classParticipant.createMany({
    data: participantIds.map((pid) => ({ classId, participantId: pid })),
    // skipDuplicates not supported in SQLite — handled by unique constraint
  });
}

export async function removeParticipant(classId: string, participantId: string) {
  return prisma.classParticipant.delete({
    where: { classId_participantId: { classId, participantId } },
  });
}

export async function assignDevice(classId: string, participantId: string, deviceId: string) {
  return prisma.classParticipant.update({
    where: { classId_participantId: { classId, participantId } },
    data: { deviceId },
    include: { participant: true, device: true },
  });
}

export async function unassignDevice(classId: string, participantId: string) {
  return prisma.classParticipant.update({
    where: { classId_participantId: { classId, participantId } },
    data: { deviceId: null },
    include: { participant: true, device: true },
  });
}

export async function getRosterWithDevices(classId: string): Promise<ClassRosterItemDTO[]> {
  const classParticipants = await prisma.classParticipant.findMany({
    where: { classId },
    include: { participant: true, device: true },
  });

  return classParticipants.map((cp: any) => ({
    classParticipantId: cp.id,
    participantId: cp.participantId,
    firstName: cp.participant.firstName,
    lastName: cp.participant.lastName,
    company: cp.defaultCompanyOverride || cp.participant.company,
    deviceId: cp.deviceId,
    deviceMac: cp.device?.macAddress || null,
    deviceShortId: cp.device?.shortId || null,
  }));
}

export async function updateParticipantCompany(classId: string, participantId: string, company: string | null) {
  return prisma.classParticipant.update({
    where: { classId_participantId: { classId, participantId } },
    data: { defaultCompanyOverride: company },
    include: { participant: true, device: true },
  });
}
