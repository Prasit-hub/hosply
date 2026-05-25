import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  const rawUrl = process.env.DATABASE_URL || '';
  
  if (rawUrl.startsWith('postgresql://') || rawUrl.startsWith('postgres://')) {
    // Native PostgreSQL Client (production)
    return new PrismaClient();
  } else {
    // SQLite Fallback Client (development)
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const url = (rawUrl && rawUrl !== 'undefined' && rawUrl !== 'null') ? rawUrl : 'file:./dev.db';
    const adapter = new PrismaBetterSqlite3({ url });
    return new PrismaClient({ adapter });
  }
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
