/**
 * Health Check Service
 *
 * Provides comprehensive health checks for all system components.
 * Used by /health and /health/events endpoints.
 *
 * @module services/health-check
 */

import { createLogger, serializeError } from "@journey/logger";
import { checkDatabaseHealth } from "@journey/db";
import { getAllCircuitMetrics, type CircuitMetrics } from "@journey/infra";
import { getRedisConnection, isRedisConnected, getRedisInfo } from "../lib/redis";
import { isEventBusInitialized } from "../event-bus/event-bus";
import { getAutomationQueue } from "../event-bus/consumers/automation-consumer";
import { getTimerQueue } from "./timers";
import { getDataRetentionQueue } from "./data-retention";

const log = createLogger("health-check");

// =============================================================================
// TYPES
// =============================================================================

export interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface CircuitBreakersHealth extends ComponentHealth {
  details?: {
    circuits: CircuitMetrics[];
    summary: {
      total: number;
      closed: number;
      open: number;
      halfOpen: number;
    };
  };
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    eventBus: ComponentHealth;
    queues?: ComponentHealth;
    circuitBreakers?: CircuitBreakersHealth;
  };
  summary: {
    totalComponents: number;
    healthyComponents: number;
    degradedComponents: number;
    unhealthyComponents: number;
  };
}

export interface EventSystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  components: {
    redis: ComponentHealth;
    eventBus: ComponentHealth;
    queues: ComponentHealth;
  };
  metrics?: {
    redisConnections?: number;
    queuedJobs?: number;
    processingJobs?: number;
    failedJobs?: number;
  };
}

// =============================================================================
// HEALTH CHECK FUNCTIONS
// =============================================================================

/**
 * Check database health
 */
export async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const healthy = await checkDatabaseHealth();
    const latency = Date.now() - start;

    if (healthy) {
      return {
        status: "healthy",
        latency,
        message: "Database connection is healthy",
      };
    } else {
      return {
        status: "unhealthy",
        latency,
        message: "Database health check failed",
      };
    }
  } catch (error) {
    log.error({ err: serializeError(error) }, "healthCheck:database:error");
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Database check failed",
    };
  }
}

/**
 * Parse Redis INFO response into key-value pairs
 */
function parseRedisInfo(info: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of info.split("\r\n")) {
    if (line && !line.startsWith("#")) {
      const [key, value] = line.split(":");
      if (key && value) {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/**
 * Check Redis health with detailed metrics
 */
export async function checkRedis(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    // Quick check for connection status
    if (!isRedisConnected()) {
      return {
        status: "unhealthy",
        message: "Redis connection not established",
        details: getRedisInfo(),
      };
    }

    const redis = getRedisConnection();

    // Ping check
    const pong = await redis.ping();
    const latency = Date.now() - start;

    if (pong === "PONG") {
      // Get comprehensive Redis info
      const [clientsInfo, memoryInfo, serverInfo, keyspaceInfo] = await Promise.all([
        redis.info("clients"),
        redis.info("memory"),
        redis.info("server"),
        redis.info("keyspace"),
      ]);

      const clients = parseRedisInfo(clientsInfo);
      const memory = parseRedisInfo(memoryInfo);
      const server = parseRedisInfo(serverInfo);
      const keyspace = parseRedisInfo(keyspaceInfo);

      // Extract relevant metrics
      const connectedClients = parseInt(clients.connected_clients || "0", 10);
      const usedMemoryBytes = parseInt(memory.used_memory || "0", 10);
      const uptimeSeconds = parseInt(server.uptime_in_seconds || "0", 10);

      // Count total keys across all databases
      let totalKeys = 0;
      for (const [key, value] of Object.entries(keyspace)) {
        if (key.startsWith("db")) {
          const keysMatch = value.match(/keys=(\d+)/);
          if (keysMatch) {
            totalKeys += parseInt(keysMatch[1], 10);
          }
        }
      }

      return {
        status: "healthy",
        latency,
        message: "Redis connection is healthy",
        details: {
          ...getRedisInfo(),
          connectedClients,
          usedMemory: formatBytes(usedMemoryBytes),
          usedMemoryBytes,
          uptimeSeconds,
          totalKeys,
          redisVersion: server.redis_version,
        },
      };
    } else {
      return {
        status: "degraded",
        latency,
        message: "Redis ping returned unexpected response",
      };
    }
  } catch (error) {
    log.error({ err: serializeError(error) }, "healthCheck:redis:error");
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Redis check failed",
    };
  }
}

/**
 * Check event bus health
 */
export function checkEventBus(): ComponentHealth {
  const initialized = isEventBusInitialized();

  if (initialized) {
    return {
      status: "healthy",
      message: "Event bus is initialized and ready",
    };
  } else {
    return {
      status: "degraded",
      message: "Event bus is not initialized",
    };
  }
}

/**
 * Queue job counts interface
 */
export interface QueueJobCounts {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Check BullMQ queues health with detailed job counts
 */
export async function checkQueues(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    // Get all queue instances
    const automationQueue = getAutomationQueue();
    const timerQueue = getTimerQueue();
    const retentionQueue = getDataRetentionQueue();

    const queueDetails: QueueJobCounts[] = [];
    let totalWaiting = 0;
    let totalActive = 0;
    let totalFailed = 0;

    // Helper to get job counts from a queue
    async function getQueueCounts(
      queue: ReturnType<typeof getAutomationQueue>,
      name: string
    ): Promise<QueueJobCounts | null> {
      if (!queue) return null;
      try {
        const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
        return {
          name,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
        };
      } catch (error) {
        log.warn({ err: serializeError(error), queue: name }, "healthCheck:queue:countError");
        return null;
      }
    }

    // Get counts from all queues in parallel
    const [automationCounts, timerCounts, retentionCounts] = await Promise.all([
      getQueueCounts(automationQueue, "journey-events"),
      getQueueCounts(timerQueue, "journey-timers"),
      getQueueCounts(retentionQueue, "data-retention"),
    ]);

    // Aggregate results
    for (const counts of [automationCounts, timerCounts, retentionCounts]) {
      if (counts) {
        queueDetails.push(counts);
        totalWaiting += counts.waiting;
        totalActive += counts.active;
        totalFailed += counts.failed;
      }
    }

    const latency = Date.now() - start;

    // Determine status based on queue health
    // Degraded if there are many failed jobs or if queues are unavailable
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (queueDetails.length === 0) {
      status = "degraded";
    } else if (totalFailed > 100) {
      // High failure count indicates issues
      status = "degraded";
    }

    return {
      status,
      latency,
      message: `Queue system operational with ${queueDetails.length} active queues`,
      details: {
        queues: queueDetails,
        summary: {
          totalQueues: queueDetails.length,
          totalWaiting,
          totalActive,
          totalFailed,
        },
      },
    };
  } catch (error) {
    log.error({ err: serializeError(error) }, "healthCheck:queues:error");
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Queue check failed",
    };
  }
}

/**
 * Check circuit breakers health
 *
 * Provides visibility into external service availability:
 * - healthy: All circuits closed (services operating normally)
 * - degraded: Any circuit half-open or 1 circuit open
 * - unhealthy: 2+ circuits open (multiple external services failing)
 */
export function checkCircuitBreakers(): CircuitBreakersHealth {
  const circuits = getAllCircuitMetrics();

  // Count circuits by state
  const summary = {
    total: circuits.length,
    closed: circuits.filter((c) => c.state === "closed").length,
    open: circuits.filter((c) => c.state === "open").length,
    halfOpen: circuits.filter((c) => c.state === "half-open").length,
  };

  // Determine status based on circuit states
  let status: "healthy" | "degraded" | "unhealthy";
  let message: string;

  if (summary.open >= 2) {
    status = "unhealthy";
    message = `Multiple external services unavailable (${summary.open} circuits open)`;
  } else if (summary.open === 1 || summary.halfOpen > 0) {
    status = "degraded";
    const issues: string[] = [];
    if (summary.open === 1) issues.push("1 circuit open");
    if (summary.halfOpen > 0) issues.push(`${summary.halfOpen} circuits recovering`);
    message = `External service issues: ${issues.join(", ")}`;
  } else if (summary.total === 0) {
    status = "healthy";
    message = "No circuit breakers registered yet";
  } else {
    status = "healthy";
    message = `All ${summary.total} circuit breakers closed`;
  }

  return {
    status,
    message,
    details: {
      circuits,
      summary,
    },
  };
}

// =============================================================================
// AGGREGATED HEALTH CHECKS
// =============================================================================

/**
 * Get full system health status
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const [database, redis, queues] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQueues(),
  ]);

  const eventBus = checkEventBus();
  const circuitBreakers = checkCircuitBreakers();

  const components = { database, redis, eventBus, queues, circuitBreakers };

  // Calculate summary
  const statuses = Object.values(components).map((c) => c.status);
  const healthyCount = statuses.filter((s) => s === "healthy").length;
  const degradedCount = statuses.filter((s) => s === "degraded").length;
  const unhealthyCount = statuses.filter((s) => s === "unhealthy").length;

  // Determine overall status
  let overallStatus: "healthy" | "degraded" | "unhealthy";
  if (unhealthyCount > 0) {
    // Critical components unhealthy = system unhealthy
    if (database.status === "unhealthy" || redis.status === "unhealthy") {
      overallStatus = "unhealthy";
    } else {
      overallStatus = "degraded";
    }
  } else if (degradedCount > 0) {
    overallStatus = "degraded";
  } else {
    overallStatus = "healthy";
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    components,
    summary: {
      totalComponents: statuses.length,
      healthyComponents: healthyCount,
      degradedComponents: degradedCount,
      unhealthyComponents: unhealthyCount,
    },
  };
}

/**
 * Get event system specific health
 */
export async function getEventSystemHealth(): Promise<EventSystemHealth> {
  const [redis, queues] = await Promise.all([checkRedis(), checkQueues()]);

  const eventBus = checkEventBus();

  const components = { redis, eventBus, queues };

  // Determine overall status
  const statuses = Object.values(components).map((c) => c.status);
  let overallStatus: "healthy" | "degraded" | "unhealthy";

  if (statuses.includes("unhealthy")) {
    overallStatus = "unhealthy";
  } else if (statuses.includes("degraded")) {
    overallStatus = "degraded";
  } else {
    overallStatus = "healthy";
  }

  // Extract metrics from component details
  const redisDetails = redis.details as { connectedClients?: number } | undefined;
  const queueSummary = (queues.details as { summary?: { totalWaiting?: number; totalActive?: number; totalFailed?: number } } | undefined)?.summary;

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    components,
    metrics: {
      redisConnections: redisDetails?.connectedClients,
      queuedJobs: queueSummary?.totalWaiting,
      processingJobs: queueSummary?.totalActive,
      failedJobs: queueSummary?.totalFailed,
    },
  };
}
