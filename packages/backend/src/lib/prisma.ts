import pkg from '@prisma/client';
const { PrismaClient } = pkg;

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/**
 * Optimize SQLite for high-throughput telemetry workloads.
 * Must be called once at startup after Prisma connects.
 */
export async function initSqlitePragmas() {
  // Use $queryRawUnsafe because some PRAGMAs return results
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
  await prisma.$queryRawUnsafe('PRAGMA cache_size = -20000'); // 20 MB
  await prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY');
  await prisma.$queryRawUnsafe('PRAGMA mmap_size = 268435456'); // 256 MB
}
