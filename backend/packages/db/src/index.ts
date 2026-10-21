import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';
export { printRowCounts } from './row-counts';

/** Create a Prisma client. Reads DATABASE_URL unless a URL is given (e.g. for e2e tests). */
export function createPrismaClient(url?: string): PrismaClient {
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
}
