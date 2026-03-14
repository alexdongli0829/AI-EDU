/**
 * Redis Client Singleton
 *
 * Manages Redis connection for caching and real-time features
 */

import Redis, { RedisOptions } from 'ioredis';
import { logger, CACHE_TTL } from '@edulens/common';

// Redis client singleton
let redisClient: Redis | null = null;

// Redis configuration
const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
};

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis client error', error);
    });

    redisClient.on('close', () => {
      logger.info('Redis client disconnected');
    });
  }

  return redisClient;
}

/**
 * Close Redis connection
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await disconnectRedis();
});

// ==================== Cache Helper Functions ====================

const redis = getRedisClient();

/**
 * Get value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error(`Cache get error for key: ${key}`, error as Error);
    return null;
  }
}

/**
 * Set value in cache with TTL
 */
export async function cacheSet(
  key: string,
  value: any,
  ttl?: number
): Promise<boolean> {
  try {
    const stringValue = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, stringValue);
    } else {
      await redis.set(key, stringValue);
    }
    return true;
  } catch (error) {
    logger.error(`Cache set error for key: ${key}`, error as Error);
    return false;
  }
}

/**
 * Delete key from cache
 */
export async function cacheDel(key: string): Promise<boolean> {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error(`Cache delete error for key: ${key}`, error as Error);
    return false;
  }
}

/**
 * Check if key exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    logger.error(`Cache exists error for key: ${key}`, error as Error);
    return false;
  }
}

/**
 * Set expiration on key
 */
export async function cacheExpire(key: string, ttl: number): Promise<boolean> {
  try {
    await redis.expire(key, ttl);
    return true;
  } catch (error) {
    logger.error(`Cache expire error for key: ${key}`, error as Error);
    return false;
  }
}

/**
 * Get multiple keys at once
 */
export async function cacheMultiGet<T>(keys: string[]): Promise<(T | null)[]> {
  try {
    const values = await redis.mget(...keys);
    return values.map((value) => (value ? JSON.parse(value) as T : null));
  } catch (error) {
    logger.error(`Cache multi-get error`, error as Error);
    return keys.map(() => null);
  }
}

/**
 * Delete keys by pattern (use with caution in production)
 */
export async function cacheDelPattern(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    logger.error(`Cache delete pattern error: ${pattern}`, error as Error);
    return 0;
  }
}

/**
 * Increment counter
 */
export async function cacheIncr(key: string): Promise<number> {
  try {
    return await redis.incr(key);
  } catch (error) {
    logger.error(`Cache incr error for key: ${key}`, error as Error);
    return 0;
  }
}

/**
 * Health check
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', error as Error);
    return false;
  }
}
