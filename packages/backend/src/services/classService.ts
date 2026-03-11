import { prisma } from '../lib/prisma.js';

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
