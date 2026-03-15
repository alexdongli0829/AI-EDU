/**
 * Redis cache utilities for test-engine.
 * Self-contained implementation that replaces the @edulens/database workspace dependency.
 */

import Redis from 'ioredis';

let client: Redis | null = null;

function getClient(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    client.on('error', (err) => console.error('Redis error:', err));
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await getClient().get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<boolean> {
  try {
    await getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

export async function cacheDel(key: string): Promise<boolean> {
  try {
    await getClient().del(key);
    return true;
  } catch {
    return false;
  }
}
