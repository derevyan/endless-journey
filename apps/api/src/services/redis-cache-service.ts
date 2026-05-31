/**
 * Redis Cache Service
 *
 * Generic Redis-backed cache service implementing ICacheService interface.
 * Used by CachedVariableService and potentially other cached services.
 *
 * @module services/redis-cache-service
 */

import { createLogger, serializeError } from "@journey/logger";
import type { ICacheService, CacheOptions, CacheStats } from "@journey/schemas";
import { getRedisConnection, isRedisConnected } from "../lib/redis";

const log = createLogger("redis-cache-service");

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Default TTL in seconds (5 minutes) */
const DEFAULT_TTL_SECONDS = 300;

/** Max keys to scan in deletePattern (avoid blocking) */
const SCAN_BATCH_SIZE = 100;

// =============================================================================
// STATS TRACKING
// =============================================================================

let cacheHits = 0;
let cacheMisses = 0;

// =============================================================================
// REDIS CACHE SERVICE
// =============================================================================

/**
 * Redis-backed cache service.
 * Implements ICacheService for use throughout the application.
 */
export const redisCacheService: ICacheService = {
  /**
   * Get a value from cache.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = getRedisConnection();
      const value = await redis.get(key);

      if (value === null) {
        cacheMisses++;
        log.debug({ key }, "cache:miss");
        return null;
      }

      cacheHits++;
      log.debug({ key }, "cache:hit");

      // Parse JSON value
      return JSON.parse(value) as T;
    } catch (error) {
      log.error({ key, err: serializeError(error) }, "cache:get:error");
      // Return null on error (graceful degradation)
      cacheMisses++;
      return null;
    }
  },

  /**
   * Set a value in cache.
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    if (options?.skipWrite) {
      return;
    }

    try {
      const redis = getRedisConnection();
      const ttl = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
      const serialized = JSON.stringify(value);

      await redis.setex(key, ttl, serialized);
      log.debug({ key, ttl }, "cache:set");
    } catch (error) {
      log.error({ key, err: serializeError(error) }, "cache:set:error");
      // Swallow error (cache is non-critical)
    }
  },

  /**
   * Delete a value from cache.
   */
  async delete(key: string): Promise<boolean> {
    try {
      const redis = getRedisConnection();
      const result = await redis.del(key);
      log.debug({ key, deleted: result > 0 }, "cache:delete");
      return result > 0;
    } catch (error) {
      log.error({ key, err: serializeError(error) }, "cache:delete:error");
      return false;
    }
  },

  /**
   * Check if a key exists in cache.
   */
  async exists(key: string): Promise<boolean> {
    try {
      const redis = getRedisConnection();
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      log.error({ key, err: serializeError(error) }, "cache:exists:error");
      return false;
    }
  },

  /**
   * Get multiple values from cache.
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    if (keys.length === 0) {
      return result;
    }

    try {
      const redis = getRedisConnection();
      const values = await redis.mget(...keys);

      for (let i = 0; i < keys.length; i++) {
        const value = values[i];
        if (value !== null) {
          cacheHits++;
          result.set(keys[i], JSON.parse(value) as T);
        } else {
          cacheMisses++;
        }
      }

      log.debug({ count: keys.length, hits: result.size }, "cache:getMany");
      return result;
    } catch (error) {
      log.error({ count: keys.length, err: serializeError(error) }, "cache:getMany:error");
      cacheMisses += keys.length;
      return result;
    }
  },

  /**
   * Set multiple values in cache.
   */
  async setMany<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void> {
    if (entries.size === 0 || options?.skipWrite) {
      return;
    }

    try {
      const redis = getRedisConnection();
      const ttl = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
      const pipeline = redis.pipeline();

      for (const [key, value] of entries) {
        pipeline.setex(key, ttl, JSON.stringify(value));
      }

      await pipeline.exec();
      log.debug({ count: entries.size, ttl }, "cache:setMany");
    } catch (error) {
      log.error({ count: entries.size, err: serializeError(error) }, "cache:setMany:error");
    }
  },

  /**
   * Delete multiple keys from cache.
   */
  async deleteMany(keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    try {
      const redis = getRedisConnection();
      const result = await redis.del(...keys);
      log.debug({ count: keys.length, deleted: result }, "cache:deleteMany");
      return result;
    } catch (error) {
      log.error({ count: keys.length, err: serializeError(error) }, "cache:deleteMany:error");
      return 0;
    }
  },

  /**
   * Delete all keys matching a pattern.
   * Uses SCAN to avoid blocking Redis.
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const redis = getRedisConnection();
      let deleted = 0;
      let cursor = "0";

      // Use SCAN to iterate keys matching pattern
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          SCAN_BATCH_SIZE
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          const result = await redis.del(...keys);
          deleted += result;
        }
      } while (cursor !== "0");

      log.info({ pattern, deleted }, "cache:deletePattern");
      return deleted;
    } catch (error) {
      log.error({ pattern, err: serializeError(error) }, "cache:deletePattern:error");
      return 0;
    }
  },

  /**
   * Get the remaining TTL for a key.
   */
  async ttl(key: string): Promise<number> {
    try {
      const redis = getRedisConnection();
      return await redis.ttl(key);
    } catch (error) {
      log.error({ key, err: serializeError(error) }, "cache:ttl:error");
      return -2; // Key doesn't exist
    }
  },

  /**
   * Update the TTL for an existing key.
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const redis = getRedisConnection();
      const result = await redis.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      log.error({ key, ttlSeconds, err: serializeError(error) }, "cache:expire:error");
      return false;
    }
  },

  /**
   * Refresh TTL without changing the value.
   */
  async touch(key: string, ttlSeconds: number): Promise<boolean> {
    return this.expire(key, ttlSeconds);
  },

  /**
   * Get cache statistics.
   */
  async getStats(): Promise<CacheStats | null> {
    const total = cacheHits + cacheMisses;
    return {
      hits: cacheHits,
      misses: cacheMisses,
      hitRatio: total > 0 ? cacheHits / total : 0,
    };
  },

  /**
   * Clear all keys in the cache.
   * WARNING: Use with extreme caution.
   */
  async clear(): Promise<void> {
    try {
      const redis = getRedisConnection();
      await redis.flushdb();
      cacheHits = 0;
      cacheMisses = 0;
      log.warn({}, "cache:clear - ALL KEYS DELETED");
    } catch (error) {
      log.error({ err: serializeError(error) }, "cache:clear:error");
    }
  },

  /**
   * Check if the cache service is connected and healthy.
   */
  async isHealthy(): Promise<boolean> {
    try {
      return isRedisConnected();
    } catch {
      return false;
    }
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Reset cache statistics (for testing).
 */
export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Get current cache statistics.
 */
export function getCacheStats(): { hits: number; misses: number; hitRatio: number } {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRatio: total > 0 ? cacheHits / total : 0,
  };
}
