import { prisma } from '../lib/prisma.js';

export async function list(activeOnly = false) {
  return prisma.participant.findMany({
    where: activeOnly ? { isArchived: false } : undefined,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function getById(id: string) {
  return prisma.participant.findUnique({ where: { id } });
}

export async function create(data: { firstName: string; lastName: string; company: string }) {
  return prisma.participant.create({ data });
}

export async function update(id: string, data: { firstName?: string; lastName?: string; company?: string }) {
  return prisma.participant.update({ where: { id }, data });
}

export async function archive(id: string) {
  return prisma.participant.update({
    where: { id },
    data: { isArchived: true },
  });
}
