/**
 * Session Lock Service
 *
 * Provides distributed locking for session processing using Redis.
 * Prevents race conditions when multiple API instances process the same session.
 *
 * Uses Redis SET with NX (set-if-not-exists) and PX (expiry in milliseconds)
 * for atomic lock acquisition.
 *
 * @module services/session-lock-service
 */

import { createLogger, serializeError } from "@journey/logger";
import { ConflictError, ServiceUnavailableError } from "@journey/schemas";
import { getRedisConnection } from "../lib/redis";

const log = createLogger("session-lock-service");

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Lock key prefix for session locks */
const LOCK_PREFIX = "lock:session:";

/** Lock TTL in milliseconds - auto-releases if holder crashes */
const LOCK_TTL_MS = 30_000; // 30 seconds

/** Maximum retries when waiting to acquire lock */
const MAX_RETRIES = 10;

/** Initial retry delay in milliseconds */
const INITIAL_RETRY_DELAY_MS = 100;

/** Maximum retry delay in milliseconds */
const MAX_RETRY_DELAY_MS = 2_000;

// =============================================================================
// TYPES
// =============================================================================

export interface SessionLock {
  sessionId: string;
  lockId: string;
  acquiredAt: number;
}

export interface AcquireLockOptions {
  /** Custom TTL in milliseconds (default: 30s) */
  ttlMs?: number;
  /** Maximum time to wait for lock in milliseconds (default: 10s) */
  waitTimeoutMs?: number;
  /** Skip retrying, fail immediately if lock not available */
  noWait?: boolean;
}

// =============================================================================
// LOCK SERVICE
// =============================================================================

/**
 * Acquire a distributed lock for a session
 *
 * Uses Redis SET NX PX for atomic lock acquisition with automatic expiry.
 * Retries with exponential backoff if lock is held by another process.
 *
 * @param sessionId - The session ID to lock
 * @param options - Lock acquisition options
 * @returns Lock object if acquired, null if unable to acquire
 * @throws Error if Redis is unavailable
 */
export async function acquireSessionLock(
  sessionId: string,
  options: AcquireLockOptions = {}
): Promise<SessionLock | null> {
  const { ttlMs = LOCK_TTL_MS, waitTimeoutMs = 10_000, noWait = false } = options;

  const redis = getRedisConnection();
  const lockKey = `${LOCK_PREFIX}${sessionId}`;
  const lockId = crypto.randomUUID();
  const startTime = Date.now();

  let retryCount = 0;
  let retryDelay = INITIAL_RETRY_DELAY_MS;

  while (true) {
    try {
      // Attempt to acquire lock atomically
      // SET key value NX PX milliseconds
      const result = await redis.set(lockKey, lockId, "PX", ttlMs, "NX");

      if (result === "OK") {
        const lock: SessionLock = {
          sessionId,
          lockId,
          acquiredAt: Date.now(),
        };

        log.debug(
          { sessionId, lockId, ttlMs, retryCount },
          "sessionLock:acquired"
        );

        return lock;
      }

      // Lock is held by another process
      if (noWait) {
        log.debug({ sessionId, lockKey }, "sessionLock:notAvailable:noWait");
        return null;
      }

      // Check if we've exceeded wait timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= waitTimeoutMs) {
        log.warn(
          { sessionId, elapsed, waitTimeoutMs, retryCount },
          "sessionLock:timeout"
        );
        return null;
      }

      // Check if we've exceeded max retries
      if (retryCount >= MAX_RETRIES) {
        log.warn(
          { sessionId, retryCount, MAX_RETRIES },
          "sessionLock:maxRetriesExceeded"
        );
        return null;
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 50;
      await sleep(retryDelay + jitter);

      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      retryCount++;

      log.debug(
        { sessionId, retryCount, nextDelay: retryDelay },
        "sessionLock:retrying"
      );
    } catch (error) {
      log.error(
        { err: serializeError(error), sessionId },
        "sessionLock:acquireError"
      );
      throw new ServiceUnavailableError(
        `Failed to acquire session lock for ${sessionId}`,
        error
      );
    }
  }
}

/**
 * Release a distributed lock for a session
 *
 * Uses Lua script to atomically check lock ownership before releasing.
 * This prevents accidentally releasing a lock that was acquired by another process
 * (e.g., if our lock expired and another process took it).
 *
 * @param lock - The lock object returned from acquireSessionLock
 * @returns true if lock was released, false if lock was not held
 */
export async function releaseSessionLock(lock: SessionLock): Promise<boolean> {
  const redis = getRedisConnection();
  const lockKey = `${LOCK_PREFIX}${lock.sessionId}`;

  // Lua script for atomic check-and-delete
  // Only delete if the lock value matches our lockId
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  try {
    const result = await redis.eval(luaScript, 1, lockKey, lock.lockId);
    const released = result === 1;

    if (released) {
      const heldFor = Date.now() - lock.acquiredAt;
      log.debug(
        { sessionId: lock.sessionId, lockId: lock.lockId, heldForMs: heldFor },
        "sessionLock:released"
      );
    } else {
      log.warn(
        { sessionId: lock.sessionId, lockId: lock.lockId },
        "sessionLock:releaseSkipped:notOwner"
      );
    }

    return released;
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId: lock.sessionId },
      "sessionLock:releaseError"
    );
    // Don't throw - lock will auto-expire anyway
    return false;
  }
}

/**
 * Extend the TTL of an existing lock
 *
 * Useful for long-running operations that may exceed the initial TTL.
 *
 * @param lock - The lock object to extend
 * @param additionalMs - Additional time in milliseconds
 * @returns true if extended, false if lock was not held
 */
export async function extendSessionLock(
  lock: SessionLock,
  additionalMs: number = LOCK_TTL_MS
): Promise<boolean> {
  const redis = getRedisConnection();
  const lockKey = `${LOCK_PREFIX}${lock.sessionId}`;

  // Lua script for atomic check-and-extend
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("pexpire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;

  try {
    const result = await redis.eval(luaScript, 1, lockKey, lock.lockId, additionalMs);
    const extended = result === 1;

    if (extended) {
      log.debug(
        { sessionId: lock.sessionId, additionalMs },
        "sessionLock:extended"
      );
    }

    return extended;
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId: lock.sessionId },
      "sessionLock:extendError"
    );
    return false;
  }
}

/**
 * Execute a function while holding a session lock
 *
 * Automatically acquires and releases the lock around the function execution.
 * If lock cannot be acquired, throws an error.
 *
 * @param sessionId - The session ID to lock
 * @param fn - The function to execute while holding the lock
 * @param options - Lock acquisition options
 * @returns The result of the function
 * @throws Error if lock cannot be acquired or Redis is unavailable
 */
export async function withSessionLock<T>(
  sessionId: string,
  fn: () => Promise<T>,
  options: AcquireLockOptions = {}
): Promise<T> {
  const lock = await acquireSessionLock(sessionId, options);

  if (!lock) {
    log.error({ sessionId }, "sessionLock:withLock:acquireFailed");
    throw new ConflictError(`Could not acquire lock for session ${sessionId}`);
  }

  try {
    return await fn();
  } finally {
    await releaseSessionLock(lock);
  }
}

/**
 * Check if a session is currently locked
 *
 * Useful for diagnostics and debugging.
 *
 * @param sessionId - The session ID to check
 * @returns true if locked, false otherwise
 */
export async function isSessionLocked(sessionId: string): Promise<boolean> {
  const redis = getRedisConnection();
  const lockKey = `${LOCK_PREFIX}${sessionId}`;

  try {
    const value = await redis.get(lockKey);
    return value !== null;
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId },
      "sessionLock:checkError"
    );
    return false;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
