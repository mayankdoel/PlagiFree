import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
const memoryCache = new Map<string, string>();

let redis: Redis | null = null;

function getRedisClient() {
  if (!redisUrl) {
    return null;
  }

  if (!redis) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  return redis;
}

export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedisClient();

  if (client) {
    try {
      if (client.status === "wait") {
        await client.connect();
      }
      const value = await client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  const value = memoryCache.get(key);
  return value ? (JSON.parse(value) as T) : null;
}

export async function setCache<T>(key: string, value: T, ttlSeconds = 3600) {
  const serialized = JSON.stringify(value);
  const client = getRedisClient();

  if (client) {
    try {
      if (client.status === "wait") {
        await client.connect();
      }
      await client.set(key, serialized, "EX", ttlSeconds);
      return;
    } catch {
      // Fall back to in-memory cache when Redis is not available.
    }
  }

  memoryCache.set(key, serialized);
}
