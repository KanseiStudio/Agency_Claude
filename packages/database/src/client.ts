// Singleton del Prisma Client.
// In Next.js dev mode HMR ricarica spesso il modulo: senza singleton si
// aprirebbero decine di pool di connessioni a MySQL e si saturerebbe il DB.
// Pattern ufficiale Prisma per Next.js.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
