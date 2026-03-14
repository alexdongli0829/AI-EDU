/**
 * @edulens/database - Database layer with Prisma ORM and Redis
 */

// Prisma Client
export { prisma, checkDatabaseHealth, transaction } from './client';

// Redis Client & Cache Utilities
export {
  getRedisClient,
  disconnectRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheExists,
  cacheExpire,
  cacheMultiGet,
  cacheDelPattern,
  cacheIncr,
  checkRedisHealth,
} from './redis';

// Re-export Prisma types
export * from '@prisma/client';
