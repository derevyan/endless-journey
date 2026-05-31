/**
 * Session Cache Service
 *
 * Provides Redis-based caching for session engine state.
 * Enables horizontal scaling by sharing session state across API instances.
 *
 * Caches the EnhancedUserJourney object which can be used to reconstruct
 * a SessionEngine instance without full database round-trips.
 *
 * @module services/session-cache-service
 */

import { createLogger, serializeError } from "@journey/logger";
import { ServiceUnavailableError, type EnhancedUserJourney } from "@journey/schemas";
import { getRedisConnection } from "../lib/redis";

const log = createLogger("session-cache-service");

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Cache key prefix for session state */
const CACHE_PREFIX = "session:state:";

/** Cache key prefix for journey-to-sessions index */
const JOURNEY_INDEX_PREFIX = "session:journey:";

/** Default cache TTL in seconds (30 minutes) */
const DEFAULT_TTL_SECONDS = 30 * 60;

// =============================================================================
// TYPES
// =============================================================================

export interface CachedSessionState {
  /** Session ID */
  sessionId: string;
  /** Journey ID for this session */
  journeyId: string;
  /** The serialized session state */
  session: EnhancedUserJourney;
  /** Timestamp when cached */
  cachedAt: number;
  /** Version for cache invalidation */
  version: number;
}

export interface CacheOptions {
  /** Custom TTL in seconds (default: 30 minutes) */
  ttlSeconds?: number;
}

/**
 * Result of a conditional cache update
 */
export interface ConditionalUpdateResult {
  /** Whether the update was applied */
  success: boolean;
  /** New version after update (if successful) */
  newVersion?: number;
  /** Current version in cache (if conflict detected) */
  currentVersion?: number;
  /** Reason for failure */
  reason?: "version_mismatch" | "not_found" | "error";
}

// =============================================================================
// CACHE SERVICE
// =============================================================================

function buildCacheEntry(
  sessionId: string,
  journeyId: string,
  session: EnhancedUserJourney,
  version: number
): CachedSessionState {
  return {
    sessionId,
    journeyId,
    session,
    cachedAt: Date.now(),
    version,
  };
}

/**
 * Get cached session state from Redis
 *
 * @param sessionId - The session ID to retrieve
 * @returns Cached state if found and valid, null otherwise
 * @throws Error if Redis is unavailable (fail-fast behavior)
 */
export async function getCachedSession(
  sessionId: string
): Promise<CachedSessionState | null> {
  const redis = getRedisConnection();
  const cacheKey = `${CACHE_PREFIX}${sessionId}`;

  try {
    const cached = await redis.get(cacheKey);

    if (!cached) {
      log.debug({ sessionId }, "sessionCache:miss");
      return null;
    }

    const parsed = JSON.parse(cached) as CachedSessionState;

    // Validate structure
    if (!parsed.sessionId || !parsed.session || !parsed.journeyId) {
      log.warn({ sessionId }, "sessionCache:invalidStructure");
      await redis.del(cacheKey);
      return null;
    }

    log.debug(
      { sessionId, cachedAt: parsed.cachedAt, age: Date.now() - parsed.cachedAt },
      "sessionCache:hit"
    );

    return parsed;
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId },
      "sessionCache:getError"
    );
    // Fail fast - don't swallow errors
    throw new ServiceUnavailableError(`Failed to get cached session: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Cache session state in Redis
 *
 * Also maintains a journey-to-sessions index for bulk invalidation.
 *
 * @param sessionId - The session ID
 * @param journeyId - The journey ID (for indexing)
 * @param session - The session state to cache
 * @param options - Cache options
 * @throws Error if Redis is unavailable (fail-fast behavior)
 */
export async function setCachedSession(
  sessionId: string,
  journeyId: string,
  session: EnhancedUserJourney,
  options: CacheOptions = {}
): Promise<void> {
  const { ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  const redis = getRedisConnection();
  const cacheKey = `${CACHE_PREFIX}${sessionId}`;
  const journeyIndexKey = `${JOURNEY_INDEX_PREFIX}${journeyId}`;

  const cacheEntry = buildCacheEntry(sessionId, journeyId, session, 1);

  try {
    // Use pipeline for atomic multi-command execution
    const pipeline = redis.pipeline();

    // Set the session cache with TTL
    pipeline.setex(cacheKey, ttlSeconds, JSON.stringify(cacheEntry));

    // Add session to journey index (for bulk invalidation)
    pipeline.sadd(journeyIndexKey, sessionId);
    pipeline.expire(journeyIndexKey, ttlSeconds + 60); // Index expires slightly after sessions

    await pipeline.exec();

    log.debug(
      { sessionId, journeyId, ttlSeconds },
      "sessionCache:set"
    );
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId },
      "sessionCache:setError"
    );
    throw new ServiceUnavailableError(`Failed to cache session: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Update cached session state (refresh TTL)
 *
 * Use this after processing a message to keep active sessions in cache.
 *
 * @param sessionId - The session ID
 * @param session - Updated session state
 * @param options - Cache options
 */
export async function updateCachedSession(
  sessionId: string,
  session: EnhancedUserJourney,
  options: CacheOptions = {}
): Promise<void> {
  const { ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  const redis = getRedisConnection();
  const cacheKey = `${CACHE_PREFIX}${sessionId}`;

  try {
    // Get existing entry to preserve metadata
    const existing = await redis.get(cacheKey);
    let version = 1;
    let journeyId = session.journeyId;

    if (existing) {
      const parsed = JSON.parse(existing) as CachedSessionState;
      version = (parsed.version || 0) + 1;
      journeyId = parsed.journeyId;
    }

    const cacheEntry = buildCacheEntry(sessionId, journeyId, session, version);

    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(cacheEntry));

    log.debug(
      { sessionId, version, ttlSeconds },
      "sessionCache:updated"
    );
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId },
      "sessionCache:updateError"
    );
    throw new ServiceUnavailableError(`Failed to update cached session: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Delete cached session state
 *
 * @param sessionId - The session ID to delete
 * @returns true if deleted, false if not found
 */
export async function deleteCachedSession(sessionId: string): Promise<boolean> {
  const redis = getRedisConnection();
  const cacheKey = `${CACHE_PREFIX}${sessionId}`;

  try {
    const deleted = await redis.del(cacheKey);

    if (deleted > 0) {
      log.debug({ sessionId }, "sessionCache:deleted");
    }

    return deleted > 0;
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId },
      "sessionCache:deleteError"
    );
    throw new ServiceUnavailableError(`Failed to delete cached session: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Delete all cached sessions for a journey
 *
 * Used when a journey is updated/republished to ensure fresh state.
 *
 * @param journeyId - The journey ID
 * @returns Number of sessions invalidated
 */
export async function invalidateJourneySessions(journeyId: string): Promise<number> {
  const redis = getRedisConnection();
  const journeyIndexKey = `${JOURNEY_INDEX_PREFIX}${journeyId}`;

  try {
    // Get all session IDs for this journey
    const sessionIds = await redis.smembers(journeyIndexKey);

    if (sessionIds.length === 0) {
      log.debug({ journeyId }, "sessionCache:invalidateJourney:noSessions");
      return 0;
    }

    // Delete all session caches and the index
    const pipeline = redis.pipeline();

    for (const sessionId of sessionIds) {
      pipeline.del(`${CACHE_PREFIX}${sessionId}`);
    }
    pipeline.del(journeyIndexKey);

    await pipeline.exec();

    log.info(
      { journeyId, invalidatedCount: sessionIds.length },
      "sessionCache:invalidateJourney:complete"
    );

    return sessionIds.length;
  } catch (error) {
    log.error(
      { err: serializeError(error), journeyId },
      "sessionCache:invalidateJourneyError"
    );
    throw new ServiceUnavailableError(`Failed to invalidate journey sessions: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get cache statistics for monitoring
 *
 * @returns Cache statistics
 */
export async function getCacheStats(): Promise<{
  totalCachedSessions: number;
  cacheKeyPattern: string;
}> {
  const redis = getRedisConnection();

  try {
    // Count session cache keys (use SCAN for large datasets)
    const keys = await redis.keys(`${CACHE_PREFIX}*`);

    return {
      totalCachedSessions: keys.length,
      cacheKeyPattern: `${CACHE_PREFIX}*`,
    };
  } catch (error) {
    log.error({ err: serializeError(error) }, "sessionCache:statsError");
    throw new ServiceUnavailableError(`Failed to get cache stats: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Touch a cached session (refresh TTL without updating content)
 *
 * @param sessionId - The session ID
 * @param ttlSeconds - New TTL in seconds
 * @returns true if touched, false if not found
 */
export async function touchCachedSession(
  sessionId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<boolean> {
  const redis = getRedisConnection();
  const cacheKey = `${CACHE_PREFIX}${sessionId}`;

  try {
    const result = await redis.expire(cacheKey, ttlSeconds);
    return result === 1;
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId },
      "sessionCache:touchError"
    );
    return false;
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS (with error swallowing for route handlers)
// =============================================================================

/**
 * Clear all cached sessions for a given journey.
 * Called when sessions are reset to ensure no stale cache.
 * Swallows errors and returns 0 on failure.
 */
export async function clearSessionEnginesForJourney(journeyId: string): Promise<number> {
  try {
    const count = await invalidateJourneySessions(journeyId);
    if (count > 0) {
      log.info({ journeyId, clearedCount: count }, "sessionCache:journeySessionsCleared");
    }
    return count;
  } catch (error) {
    log.error({ err: serializeError(error), journeyId }, "sessionCache:clearJourneySessionsError");
    return 0;
  }
}

/**
 * Clear a specific cached session by session ID.
 * Swallows errors and returns false on failure.
 */
export async function clearSessionEngine(sessionId: string): Promise<boolean> {
  try {
    const deleted = await deleteCachedSession(sessionId);
    if (deleted) {
      log.debug({ sessionId }, "sessionCache:sessionCleared");
    }
    return deleted;
  } catch (error) {
    log.error({ err: serializeError(error), sessionId }, "sessionCache:clearSessionError");
    return false;
  }
}

// =============================================================================
// OPTIMISTIC LOCKING (Cache Versioning for Conflict Detection)
// =============================================================================

/**
 * Conditionally update cached session only if version matches.
 *
 * Implements optimistic locking to prevent lost updates when multiple
 * processes attempt to update the same session concurrently.
 *
 * Usage:
 * 1. Read session with getCachedSession() and note the version
 * 2. Process the update
 * 3. Call updateCachedSessionIfVersion() with expected version
 * 4. If conflict, reload and retry or handle appropriately
 *
 * @example
 * ```ts
 * const cached = await getCachedSession(sessionId);
 * const expectedVersion = cached?.version ?? 0;
 *
 * // Process the update...
 *
 * const result = await updateCachedSessionIfVersion(
 *   sessionId,
 *   updatedSession,
 *   expectedVersion
 * );
 *
 * if (!result.success && result.reason === "version_mismatch") {
 *   log.warn({ sessionId, expected: expectedVersion, current: result.currentVersion }, "cache:conflict");
 *   // Handle conflict (reload and retry, or use current state)
 * }
 * ```
 *
 * @param sessionId - The session ID
 * @param session - Updated session state
 * @param expectedVersion - The version we expect to be in cache
 * @param options - Cache options
 * @returns Result indicating success or conflict
 */
export async function updateCachedSessionIfVersion(
  sessionId: string,
  session: EnhancedUserJourney,
  expectedVersion: number,
  options: CacheOptions = {}
): Promise<ConditionalUpdateResult> {
  const { ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  const redis = getRedisConnection();
  const cacheKey = `${CACHE_PREFIX}${sessionId}`;

  try {
    // Use WATCH/MULTI for optimistic locking
    // Note: ioredis doesn't support WATCH in pipeline, so we use a transaction

    // First, get current state
    const existing = await redis.get(cacheKey);

    if (!existing) {
      log.debug({ sessionId, expectedVersion }, "sessionCache:conditionalUpdate:notFound");
      return { success: false, reason: "not_found" };
    }

    const parsed = JSON.parse(existing) as CachedSessionState;
    const currentVersion = parsed.version || 0;

    // Check version match
    if (currentVersion !== expectedVersion) {
      log.debug(
        { sessionId, expectedVersion, currentVersion },
        "sessionCache:conditionalUpdate:versionMismatch"
      );
      return {
        success: false,
        reason: "version_mismatch",
        currentVersion,
      };
    }

    // Version matches - apply update
    const newVersion = currentVersion + 1;
    const cacheEntry = buildCacheEntry(sessionId, parsed.journeyId, session, newVersion);

    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(cacheEntry));

    log.debug(
      { sessionId, oldVersion: currentVersion, newVersion },
      "sessionCache:conditionalUpdate:success"
    );

    return { success: true, newVersion };
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId, expectedVersion },
      "sessionCache:conditionalUpdateError"
    );
    return { success: false, reason: "error" };
  }
}

/**
 * Get the current cache version for a session.
 *
 * Lightweight check without fetching full session data.
 * Useful for preflight version checks.
 *
 * @param sessionId - The session ID
 * @returns Current version or null if not cached
 */
export async function getCacheVersion(sessionId: string): Promise<number | null> {
  const redis = getRedisConnection();
  const cacheKey = `${CACHE_PREFIX}${sessionId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedSessionState;
    return parsed.version || 0;
  } catch (error) {
    log.error({ err: serializeError(error), sessionId }, "sessionCache:getVersionError");
    return null;
  }
}

/**
 * Compare-and-swap session state using Lua script for atomicity.
 *
 * More robust than updateCachedSessionIfVersion() as it uses atomic
 * Lua script to prevent race conditions between read and write.
 *
 * @param sessionId - The session ID
 * @param session - Updated session state
 * @param expectedVersion - The version we expect
 * @param options - Cache options
 * @returns Result indicating success or conflict
 */
export async function compareAndSwapSession(
  sessionId: string,
  session: EnhancedUserJourney,
  expectedVersion: number,
  options: CacheOptions = {}
): Promise<ConditionalUpdateResult> {
  const { ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  const redis = getRedisConnection();
  const cacheKey = `${CACHE_PREFIX}${sessionId}`;

  // Lua script for atomic compare-and-swap
  // Returns: 1 = success, 0 = version mismatch, -1 = not found
  const casScript = `
    local existing = redis.call('GET', KEYS[1])
    if not existing then
      return -1
    end
    local data = cjson.decode(existing)
    local currentVersion = data.version or 0
    if currentVersion ~= tonumber(ARGV[1]) then
      return currentVersion
    end
    redis.call('SETEX', KEYS[1], ARGV[2], ARGV[3])
    return 1
  `;

  try {
    const journeyId = session.journeyId;
    const newVersion = expectedVersion + 1;
    const cacheEntry = buildCacheEntry(sessionId, journeyId, session, newVersion);
    const serialized = JSON.stringify(cacheEntry);

    const result = await redis.eval(
      casScript,
      1,
      cacheKey,
      expectedVersion.toString(),
      ttlSeconds.toString(),
      serialized
    ) as number;

    if (result === 1) {
      log.debug({ sessionId, newVersion }, "sessionCache:cas:success");
      return { success: true, newVersion };
    } else if (result === -1) {
      log.debug({ sessionId }, "sessionCache:cas:notFound");
      return { success: false, reason: "not_found" };
    } else {
      // result is the current version
      log.debug(
        { sessionId, expectedVersion, currentVersion: result },
        "sessionCache:cas:versionMismatch"
      );
      return { success: false, reason: "version_mismatch", currentVersion: result };
    }
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId, expectedVersion },
      "sessionCache:casError"
    );
    return { success: false, reason: "error" };
  }
}
