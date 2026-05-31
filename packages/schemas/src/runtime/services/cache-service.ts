/**
 * Cache Service Interface
 *
 * Generic caching interface for Redis-backed caching.
 * Used by CachedVariableService and potentially other cached services.
 *
 * @module services/cache-service
 */

/**
 * Cache entry with metadata.
 */
export interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** When the entry was cached */
  cachedAt: number;
  /** TTL in seconds (if set) */
  ttl?: number;
}

/**
 * Cache operation options.
 */
export interface CacheOptions {
  /** Time-to-live in seconds */
  ttlSeconds?: number;
  /** Skip cache read (force refresh) */
  skipRead?: boolean;
  /** Skip cache write */
  skipWrite?: boolean;
}

/**
 * Cache statistics for monitoring.
 */
export interface CacheStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Hit ratio (0-1) */
  hitRatio: number;
  /** Total keys in cache (if available) */
  keyCount?: number;
  /** Memory usage in bytes (if available) */
  memoryBytes?: number;
}

/**
 * Generic cache service interface.
 *
 * Provides a type-safe caching layer that can be implemented
 * with Redis, in-memory, or other backends.
 *
 * @example
 * ```typescript
 * // Get with automatic cache
 * const value = await cache.get("user:123:preferences");
 *
 * // Set with TTL
 * await cache.set("user:123:preferences", prefs, { ttlSeconds: 300 });
 *
 * // Delete on update
 * await cache.delete("user:123:preferences");
 *
 * // Bulk operations
 * const values = await cache.getMany(["key1", "key2", "key3"]);
 * await cache.deletePattern("user:123:*");
 * ```
 */
export interface ICacheService {
  // =========================================================================
  // Core Operations
  // =========================================================================

  /**
   * Get a value from cache.
   *
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache.
   *
   * @param key - Cache key
   * @param value - Value to cache (must be JSON-serializable)
   * @param options - Cache options (TTL, etc.)
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Delete a value from cache.
   *
   * @param key - Cache key
   * @returns True if key existed and was deleted
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists in cache.
   *
   * @param key - Cache key
   * @returns True if key exists and hasn't expired
   */
  exists(key: string): Promise<boolean>;

  // =========================================================================
  // Bulk Operations
  // =========================================================================

  /**
   * Get multiple values from cache.
   *
   * @param keys - Array of cache keys
   * @returns Map of key to value (missing keys not included)
   */
  getMany<T>(keys: string[]): Promise<Map<string, T>>;

  /**
   * Set multiple values in cache.
   *
   * @param entries - Map of key to value
   * @param options - Cache options (applied to all entries)
   */
  setMany<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void>;

  /**
   * Delete multiple keys from cache.
   *
   * @param keys - Array of cache keys
   * @returns Number of keys deleted
   */
  deleteMany(keys: string[]): Promise<number>;

  /**
   * Delete all keys matching a pattern.
   * Use with caution - can be expensive for large keyspaces.
   *
   * @param pattern - Glob pattern (e.g., "user:123:*")
   * @returns Number of keys deleted
   */
  deletePattern(pattern: string): Promise<number>;

  // =========================================================================
  // TTL Management
  // =========================================================================

  /**
   * Get the remaining TTL for a key.
   *
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  ttl(key: string): Promise<number>;

  /**
   * Update the TTL for an existing key.
   *
   * @param key - Cache key
   * @param ttlSeconds - New TTL in seconds
   * @returns True if key exists and TTL was set
   */
  expire(key: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Refresh TTL without changing the value.
   * Alias for expire() with common use case.
   *
   * @param key - Cache key
   * @param ttlSeconds - New TTL in seconds
   * @returns True if key exists and TTL was refreshed
   */
  touch(key: string, ttlSeconds: number): Promise<boolean>;

  // =========================================================================
  // Utility
  // =========================================================================

  /**
   * Get cache statistics.
   * May not be available for all implementations.
   *
   * @returns Cache statistics or null if not supported
   */
  getStats?(): Promise<CacheStats | null>;

  /**
   * Clear all keys in the cache.
   * Use with extreme caution - typically only for testing.
   */
  clear?(): Promise<void>;

  /**
   * Check if the cache service is connected and healthy.
   *
   * @returns True if cache is available
   */
  isHealthy(): Promise<boolean>;
}

// =========================================================================
// Variable-Specific Cache Configuration
// =========================================================================

/**
 * TTL configuration for variable caching.
 * Different scopes may have different cache lifetimes.
 */
export interface VariableCacheTTL {
  /** TTL for global variables (organization-wide, rarely change) */
  global: number;
  /** TTL for journey variables (per-journey, moderate change rate) */
  journey: number;
  /** TTL for session variables (per-session, frequent changes) */
  session: number;
  /** TTL for user variables (per-user, moderate change rate) */
  user: number;
}

/**
 * Default TTL values for variable caching.
 * Tuned for typical usage patterns.
 */
export const DEFAULT_VARIABLE_CACHE_TTL: VariableCacheTTL = {
  global: 300,    // 5 minutes - global vars rarely change
  journey: 120,   // 2 minutes - journey vars may change on deploy
  session: 60,    // 1 minute - session vars change during execution
  user: 180,      // 3 minutes - user preferences moderate change rate
};

/**
 * Cache key prefixes for variables.
 */
export const VARIABLE_CACHE_KEYS = {
  /** Single global variable: variable:global:{orgId}:{key} */
  global: (orgId: string, key: string) => `variable:global:${orgId}:${key}`,
  /** All global variables: variable:global:{orgId}:__all__ */
  globalAll: (orgId: string) => `variable:global:${orgId}:__all__`,
  /** Single journey variable: variable:journey:{journeyId}:{key} */
  journey: (journeyId: string, key: string) => `variable:journey:${journeyId}:${key}`,
  /** All journey variables: variable:journey:{journeyId}:__all__ */
  journeyAll: (journeyId: string) => `variable:journey:${journeyId}:__all__`,
  /** Single user variable: variable:user:{userId}:{key} */
  user: (userId: string, key: string) => `variable:user:${userId}:${key}`,
  /** All user variables: variable:user:{userId}:__all__ */
  userAll: (userId: string) => `variable:user:${userId}:__all__`,
  /** Pattern for invalidating all variables of a scope */
  pattern: (scope: string, scopeId: string) => `variable:${scope}:${scopeId}:*`,
} as const;
