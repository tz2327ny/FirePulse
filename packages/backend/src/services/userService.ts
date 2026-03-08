import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';

const SALT_ROUNDS = 10;

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export async function list(activeOnly = false) {
  return prisma.user.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { displayName: 'asc' },
    select: userSelect,
  });
}

export async function getById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
}

export async function create(data: {
  username: string;
  password: string;
  displayName: string;
  role: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  return prisma.user.create({
    data: {
      username: data.username,
      displayName: data.displayName,
      role: data.role,
      passwordHash,
    },
    select: userSelect,
  });
}

export async function update(
  id: string,
  data: { displayName?: string; role?: string; password?: string }
) {
  const updateData: Record<string, unknown> = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  }

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: userSelect,
  });
}

export async function deactivate(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: userSelect,
  });
}

export async function reactivate(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: true },
    select: userSelect,
  });
}
