/**
 * @edulens/database - Database layer with postgres.js and Redis
 */

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
