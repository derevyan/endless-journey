/**
 * Rate Limiter
 *
 * Token bucket rate limiter using Redis for distributed rate limiting.
 * Protects event publishing from spam and abuse.
 *
 * @module lib/rate-limiter
 */

import { createLogger, serializeError } from "@journey/logger";
import { getRedisConnection } from "./redis";
import { appConfig } from "../config";

const log = createLogger("rate-limiter");

/**
 * Configuration for token bucket rate limiting
 */
interface RateLimitConfig {
  /** Maximum tokens in bucket */
  maxTokens: number;
  /** Tokens to add per interval */
  refillRate: number;
  /** Refill interval in seconds */
  refillInterval: number;
  /**
   * Behavior when Redis is unavailable:
   * - true (default): Reject requests (fail-closed, secure)
   * - false: Allow requests (fail-open, available but risky)
   */
  failClosed?: boolean;
}

/**
 * Result of a rate limit check
 */
interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining tokens in bucket */
  remaining: number;
  /** Unix timestamp (ms) when bucket will refill */
  resetAt: number;
}

/**
 * Default rate limit configurations
 * Can be overridden via environment variables:
 * - RATE_LIMIT_EVENTS_MAX_TOKENS (default: 1000)
 * - RATE_LIMIT_EVENTS_REFILL_RATE (default: 1000)
 * - RATE_LIMIT_EVENTS_INTERVAL (default: 60)
 * - RATE_LIMIT_SSE_MAX_CONNECTIONS (default: 10)
 */
export const RATE_LIMITS = {
  /** Event publishing: 1000 events per minute per org */
  events: {
    maxTokens: appConfig.rateLimits.events.maxTokens,
    refillRate: appConfig.rateLimits.events.refillRate,
    refillInterval: appConfig.rateLimits.events.refillInterval,
  },
  /** SSE connections: 10 connections per user */
  sseConnections: {
    maxTokens: appConfig.rateLimits.sseConnections.maxTokens,
    refillRate: appConfig.rateLimits.sseConnections.refillRate,
    refillInterval: appConfig.rateLimits.sseConnections.refillInterval,
  },
};

/**
 * Check and consume rate limit token using token bucket algorithm
 *
 * @param key - Unique key for the rate limit (e.g., "events:org-123")
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const bucketKey = `ratelimit:${key}`;

  try {
    const redis = getRedisConnection();

    // Lua script for atomic token bucket operation
    const script = `
      local key = KEYS[1]
      local maxTokens = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local refillInterval = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])

      -- Get current state
      local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local tokens = tonumber(bucket[1]) or maxTokens
      local lastRefill = tonumber(bucket[2]) or now

      -- Calculate tokens to add based on elapsed time
      local elapsed = (now - lastRefill) / 1000
      local tokensToAdd = math.floor(elapsed / refillInterval) * refillRate
      tokens = math.min(maxTokens, tokens + tokensToAdd)

      -- Update last refill time if tokens were added
      if tokensToAdd > 0 then
        lastRefill = now
      end

      -- Try to consume a token
      if tokens >= 1 then
        tokens = tokens - 1
        redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', key, refillInterval * 2)
        return {1, tokens, lastRefill + refillInterval * 1000}
      else
        -- Calculate reset time
        local resetAt = lastRefill + refillInterval * 1000
        return {0, 0, resetAt}
      end
    `;

    const result = (await redis.eval(
      script,
      1,
      bucketKey,
      config.maxTokens,
      config.refillRate,
      config.refillInterval,
      now
    )) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      resetAt: result[2],
    };
  } catch (error) {
    log.error({ err: serializeError(error), key }, "rateLimit:redisError");

    // Default: fail-closed (reject requests when Redis unavailable)
    // Set failClosed: false only for non-critical endpoints
    if (config.failClosed !== false) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + 60000, // Retry in 1 minute
      };
    }

    // Fail-open mode (explicitly opted-in)
    return {
      allowed: true,
      remaining: config.maxTokens,
      resetAt: now + config.refillInterval * 1000,
    };
  }
}

/**
 * Check event publishing rate limit for an organization
 *
 * @param organizationId - Organization ID
 * @returns Rate limit result
 */
export async function checkEventRateLimit(
  organizationId: string
): Promise<RateLimitResult> {
  return checkRateLimit(`events:${organizationId}`, RATE_LIMITS.events);
}

// =============================================================================
// HTTP REQUEST RATE LIMITING (Hono Middleware)
// =============================================================================

import { rateLimiter } from "hono-rate-limiter";
import type { Context } from "hono";
import type { Store } from "hono-rate-limiter";

/**
 * Redis-backed store for hono-rate-limiter
 *
 * Implements the Store interface using our existing Redis connection.
 */
class RedisRateLimitStore implements Store {
  prefix: string;

  constructor(options: { prefix?: string } = {}) {
    this.prefix = options.prefix ?? "hrl:";
  }

  async get(key: string): Promise<{ totalHits: number; resetTime: Date } | undefined> {
    try {
      const redis = getRedisConnection();
      const data = await redis.hgetall(`${this.prefix}${key}`);

      if (!data || !data.totalHits) {
        return undefined;
      }

      return {
        totalHits: parseInt(data.totalHits, 10),
        resetTime: new Date(parseInt(data.resetTime, 10)),
      };
    } catch (error) {
      log.error({ err: serializeError(error), key }, "rateLimitStore:get:error");
      return undefined;
    }
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    try {
      const redis = getRedisConnection();
      const fullKey = `${this.prefix}${key}`;

      // Increment hits
      const totalHits = await redis.hincrby(fullKey, "totalHits", 1);

      // Get or set reset time
      let resetTime: Date;
      const existingReset = await redis.hget(fullKey, "resetTime");

      if (existingReset) {
        resetTime = new Date(parseInt(existingReset, 10));
      } else {
        // Set reset time to windowMs from now (handled by rateLimiter options)
        resetTime = new Date(Date.now() + 60000); // Default 1 minute, will be overwritten
        await redis.hset(fullKey, "resetTime", resetTime.getTime().toString());
      }

      // Set TTL (2 minutes, refreshed on each hit)
      await redis.expire(fullKey, 120);

      return { totalHits, resetTime };
    } catch (error) {
      log.error({ err: serializeError(error), key }, "rateLimitStore:increment:error");
      // Fail closed - report high hit count to trigger rate limit
      // This prevents DDoS during Redis outages
      return { totalHits: Number.MAX_SAFE_INTEGER, resetTime: new Date(Date.now() + 60000) };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      const redis = getRedisConnection();
      await redis.hincrby(`${this.prefix}${key}`, "totalHits", -1);
    } catch (error) {
      log.error({ err: serializeError(error), key }, "rateLimitStore:decrement:error");
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      const redis = getRedisConnection();
      await redis.del(`${this.prefix}${key}`);
    } catch (error) {
      log.error({ err: serializeError(error), key }, "rateLimitStore:reset:error");
    }
  }
}

/**
 * Extract client identifier for rate limiting
 * Uses authenticated user ID if available, otherwise falls back to IP
 */
function getClientKey(c: Context): string {
  // Try to get authenticated user ID
  const user = c.get("user") as { id?: string } | undefined;
  if (user?.id) {
    return `user:${user.id}`;
  }

  // Fall back to IP address
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "anonymous";

  return `ip:${ip}`;
}

// Shared Redis store for all rate limiters
const redisStore = new RedisRateLimitStore({ prefix: "ratelimit:http:" });

/**
 * Global API rate limiter
 *
 * Limits: 100 requests per minute per user/IP
 * Applies to all API endpoints
 */
export const globalRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: appConfig.rateLimits.http.global,
  standardHeaders: "draft-6",
  keyGenerator: getClientKey,
  store: redisStore,
  message: { error: "Too many requests, please try again later" },
});

/**
 * Auth endpoint rate limiter (stricter)
 *
 * Limits: 10 requests per 15 minutes per IP
 * Applies to sign-in/sign-up endpoints to prevent brute force
 */
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: appConfig.rateLimits.http.auth,
  standardHeaders: "draft-6",
  keyGenerator: (c) => {
    // Always use IP for auth endpoints (user not authenticated yet)
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "anonymous";
    return `auth:${ip}`;
  },
  store: new RedisRateLimitStore({ prefix: "ratelimit:auth:" }),
  message: { error: "Too many authentication attempts, please try again later" },
});

/**
 * Webhook rate limiter
 *
 * Limits: 200 requests per minute per channel
 * Higher limit for webhooks since they're automated
 */
export const webhookRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: appConfig.rateLimits.http.webhook,
  standardHeaders: "draft-6",
  keyGenerator: (c) => {
    const channelId = c.req.param("channelId") || "unknown";
    return `webhook:${channelId}`;
  },
  store: new RedisRateLimitStore({ prefix: "ratelimit:webhook:" }),
  message: { error: "Too many webhook requests" },
});
