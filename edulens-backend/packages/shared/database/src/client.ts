/**
 * Prisma Client Singleton
 *
 * Ensures only one instance of Prisma Client is created and reused
 * Important for serverless environments (AWS Lambda)
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@edulens/common';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting database connection limit during hot reload
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    errorFormat: 'pretty',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  logger.info('Disconnecting Prisma Client');
  await prisma.$disconnect();
});

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed', error as Error);
    return false;
  }
}

// Transaction helper
export async function transaction<T>(
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn);
}
