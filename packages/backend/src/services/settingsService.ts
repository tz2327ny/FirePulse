import { prisma } from '../lib/prisma.js';

export async function getAll() {
  return prisma.setting.findMany({ orderBy: { key: 'asc' } });
}

export async function get(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value || null;
}

export async function getNumber(key: string, defaultValue: number): Promise<number> {
  const value = await get(key);
  if (value === null) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export async function getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
  const value = await get(key);
  if (value === null) return defaultValue;
  return value === 'true';
}

export async function updateMany(settings: Array<{ key: string; value: string }>) {
  const results = [];
  for (const s of settings) {
    const result = await prisma.setting.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value },
      update: { value: s.value },
    });
    results.push(result);
  }
  return results;
}
