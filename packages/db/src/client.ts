import { createLogger, serializeError } from "@journey/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const log = createLogger("db");

// Database URL from environment
const databaseUrl = process.env.DATABASE_URL || "postgres://journey:journey_dev@localhost:5432/journey";

// =============================================================================
// CONNECTION POOL CONFIGURATION
// =============================================================================
// Pool settings are configurable via environment variables for production tuning.
// Defaults are optimized for typical API workloads.

const poolConfig = {
  // Maximum connections in pool (default: 20, typical DB limit is 100-200)
  max: parseInt(process.env.DB_POOL_MAX || "20", 10),
  // Minimum connections to keep alive (reduces cold-start latency)
  // Note: postgres.js doesn't have explicit 'min', but idle_timeout controls this
  // Close idle connections after N seconds (default: 30s)
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || "30", 10),
  // Connection timeout in seconds (default: 10s)
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || "10", 10),
  // Max lifetime of a connection in seconds (default: 30 minutes)
  // Helps prevent issues with long-lived connections
  max_lifetime: parseInt(process.env.DB_MAX_LIFETIME || "1800", 10),
};

log.debug(
  {
    max: poolConfig.max,
    idle_timeout: poolConfig.idle_timeout,
    connect_timeout: poolConfig.connect_timeout,
    max_lifetime: poolConfig.max_lifetime,
  },
  "db:pool:config"
);

// Create postgres connection with configured pool
const queryClient = postgres(databaseUrl, {
  max: poolConfig.max,
  idle_timeout: poolConfig.idle_timeout,
  connect_timeout: poolConfig.connect_timeout,
  max_lifetime: poolConfig.max_lifetime,
  onnotice: () => {}, // Suppress notice messages
});

// Create Drizzle ORM instance with schema
export const db = drizzle(queryClient, { schema });

export type DbClient = typeof db;

// Export the query client for direct SQL queries if needed
export { queryClient };

// Export pool configuration for health checks and monitoring
export { poolConfig };

// =============================================================================
// POOL MONITORING
// =============================================================================

/**
 * Get database pool statistics for monitoring.
 * Note: postgres.js has limited pool stats compared to pg.Pool,
 * so we report configuration + connection test.
 */
export interface PoolStats {
  config: typeof poolConfig;
  isConnected: boolean;
  latencyMs?: number;
}

export async function getPoolStats(): Promise<PoolStats> {
  const start = Date.now();
  try {
    await queryClient`SELECT 1`;
    return {
      config: poolConfig,
      isConnected: true,
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      config: poolConfig,
      isConnected: false,
    };
  }
}

/**
 * Start periodic pool stats logging (useful for production monitoring).
 * Call this once at application startup if needed.
 * @param intervalMs - How often to log stats (default: 60 seconds)
 * @returns Cleanup function to stop logging
 */
export function startPoolMonitoring(intervalMs = 60_000): () => void {
  const interval = setInterval(async () => {
    const stats = await getPoolStats();
    if (stats.isConnected) {
      log.debug(
        {
          ...stats.config,
          latencyMs: stats.latencyMs,
        },
        "db:pool:stats"
      );
    } else {
      log.warn({ ...stats.config }, "db:pool:disconnected");
    }
  }, intervalMs);

  return () => clearInterval(interval);
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

type QueryFn<T> = () => Promise<T>;

/**
 * Wrap a DB call with timing + structured logging.
 * Use by passing an operation label and the async query function.
 */
export async function withQueryLogging<T>(operation: string, query: QueryFn<T>, logger = log): Promise<T> {
  const start = Date.now();
  try {
    const result = await query();
    logger.debug({ operation, durationMs: Date.now() - start }, "db:query:success");
    return result;
  } catch (error) {
    logger.error({ operation, durationMs: Date.now() - start, err: serializeError(error) }, "db:query:error");
    throw error;
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch (error) {
    log.error({ err: serializeError(error) }, "db:healthCheck:failed");
    return false;
  }
}

/**
 * Close database connection (for graceful shutdown)
 */
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await queryClient.end();
    log.info({}, "db:connection:closed");
  } catch (error) {
    log.error({ err: serializeError(error) }, "db:connection:closeFailed");
  }
}
