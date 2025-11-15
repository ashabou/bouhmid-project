import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/winston.config.js';

/**
 * Prisma Client Singleton
 *
 * This ensures we only have one instance of Prisma Client
 * throughout the application lifecycle.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Log slow queries in development
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query' as never, (e: any) => {
    if (e.duration > 1000) { // Log queries taking more than 1 second
      logger.warn('Slow query detected', {
        query: e.query,
        duration: `${e.duration}ms`,
        params: e.params,
      });
    }
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown
 */
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
