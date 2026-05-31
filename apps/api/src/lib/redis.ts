/**
 * Shared Redis Connection
 *
 * Provides a singleton Redis connection for all BullMQ services.
 * This ensures we reuse the same connection across timer service,
 * automation event service, and any future queue-based services.
 *
 * @module lib/redis
 */

import Redis from "ioredis";
import { createLogger } from "@journey/logger";
import { appConfig } from "../config";

const log = createLogger("redis");

// =============================================================================
// CONFIGURATION
// =============================================================================

const redisUrl = appConfig.redis.url;

/**
 * Parse Redis URL into connection options
 */
function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
  };
}

// =============================================================================
// SINGLETON CONNECTION
// =============================================================================

let connection: Redis | null = null;

/**
 * Get the shared Redis connection
 *
 * Creates a new connection if one doesn't exist.
 * The connection is configured for BullMQ compatibility.
 *
 * @returns Redis connection instance
 */
export function getRedisConnection(): Redis {
  if (!connection) {
    const config = parseRedisUrl(redisUrl);
    connection = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    log.info({ host: config.host, port: config.port }, "redis:connectionCreated");
  }
  return connection;
}

/**
 * Check if Redis connection is established
 */
export function isRedisConnected(): boolean {
  return connection !== null && connection.status === "ready";
}

/**
 * Close the shared Redis connection
 *
 * Should be called during graceful shutdown.
 */
export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    log.info({}, "redis:closingConnection");
    await connection.quit();
    connection = null;
    log.info({}, "redis:connectionClosed");
  }
}

/**
 * Get Redis URL for logging/debugging (without password)
 */
export function getRedisInfo(): { host: string; port: number } {
  const config = parseRedisUrl(redisUrl);
  return { host: config.host, port: config.port };
}


