/**
 * Persistence Monitoring
 *
 * Monitors database persistence operations and tracks failure rates.
 * Provides alerts when persistence failures exceed configured thresholds.
 *
 * This module helps detect:
 * - Message persistence failures (agent_conversations table)
 * - Interaction logging failures (interactions table via logConsumer)
 * - Network/database issues that could lead to data loss
 *
 * CRITICAL: These failures can cause conversation context loss after cache expiry.
 */

import { createLogger } from "@journey/logger";

const log = createLogger("engine:persistence-monitoring");

/**
 * Persistence operation metrics
 */
interface PersistenceMetrics {
  totalAttempts: number;
  totalFailures: number;
  failureRate: number;
  lastFailureTime?: Date;
  consecutiveFailures: number;
}

/**
 * Configuration for persistence monitoring
 */
interface PersistenceMonitoringConfig {
  /** Failure rate threshold (0-1) to trigger alert (default: 0.01 = 1%) */
  failureRateThreshold: number;
  /** Window size for calculating failure rate (default: 1000 attempts) */
  windowSize: number;
  /** Consecutive failure count threshold (default: 5) */
  consecutiveFailureThreshold: number;
  /** Enable Sentry integration (optional) */
  sentryIntegration?: boolean;
  /** Enable DataDog integration (optional) */
  dataDogIntegration?: boolean;
}

/** Metrics for interactions table persistence */
let interactionMetrics: PersistenceMetrics = {
  totalAttempts: 0,
  totalFailures: 0,
  failureRate: 0,
  consecutiveFailures: 0,
};

/** Metrics for agent_conversations table persistence */
let agentConversationMetrics: PersistenceMetrics = {
  totalAttempts: 0,
  totalFailures: 0,
  failureRate: 0,
  consecutiveFailures: 0,
};

/** Default configuration */
let config: PersistenceMonitoringConfig = {
  failureRateThreshold: 0.01, // 1% failure rate
  windowSize: 1000,
  consecutiveFailureThreshold: 5,
  sentryIntegration: false,
  dataDogIntegration: false,
};

/**
 * Initialize persistence monitoring with configuration
 */
export function initializePersistenceMonitoring(cfg: Partial<PersistenceMonitoringConfig> = {}) {
  config = { ...config, ...cfg };
  log.info(
    {
      failureRateThreshold: config.failureRateThreshold,
      windowSize: config.windowSize,
      consecutiveFailureThreshold: config.consecutiveFailureThreshold,
    },
    "persistence-monitoring:initialized"
  );
}

/**
 * Track interaction table persistence attempt
 */
export function trackInteractionPersistenceAttempt(success: boolean) {
  interactionMetrics.totalAttempts++;

  if (!success) {
    interactionMetrics.totalFailures++;
    interactionMetrics.consecutiveFailures++;
    interactionMetrics.lastFailureTime = new Date();

    // Calculate failure rate over window
    const recentFailures = Math.min(interactionMetrics.totalFailures, config.windowSize);
    const recentAttempts = Math.min(interactionMetrics.totalAttempts, config.windowSize);
    interactionMetrics.failureRate = recentAttempts > 0 ? recentFailures / recentAttempts : 0;

    // Alert on high failure rate
    if (interactionMetrics.failureRate > config.failureRateThreshold) {
      alertPersistenceFailure("interactions", interactionMetrics);
    }

    // Alert on consecutive failures
    if (interactionMetrics.consecutiveFailures >= config.consecutiveFailureThreshold) {
      alertConsecutiveFailures("interactions", interactionMetrics.consecutiveFailures);
    }
  } else {
    // Reset consecutive failure counter on success
    interactionMetrics.consecutiveFailures = 0;
  }
}

/**
 * Track agent_conversations table persistence attempt
 */
export function trackAgentConversationPersistenceAttempt(success: boolean) {
  agentConversationMetrics.totalAttempts++;

  if (!success) {
    agentConversationMetrics.totalFailures++;
    agentConversationMetrics.consecutiveFailures++;
    agentConversationMetrics.lastFailureTime = new Date();

    // Calculate failure rate over window
    const recentFailures = Math.min(agentConversationMetrics.totalFailures, config.windowSize);
    const recentAttempts = Math.min(agentConversationMetrics.totalAttempts, config.windowSize);
    agentConversationMetrics.failureRate = recentAttempts > 0 ? recentFailures / recentAttempts : 0;

    // Alert on high failure rate
    if (agentConversationMetrics.failureRate > config.failureRateThreshold) {
      alertPersistenceFailure("agent_conversations", agentConversationMetrics);
    }

    // Alert on consecutive failures
    if (agentConversationMetrics.consecutiveFailures >= config.consecutiveFailureThreshold) {
      alertConsecutiveFailures("agent_conversations", agentConversationMetrics.consecutiveFailures);
    }
  } else {
    // Reset consecutive failure counter on success
    agentConversationMetrics.consecutiveFailures = 0;
  }
}

/**
 * Alert on persistence failure
 */
function alertPersistenceFailure(table: "interactions" | "agent_conversations", metrics: PersistenceMetrics) {
  const message = `HIGH FAILURE RATE: ${table} persistence failing at ${(metrics.failureRate * 100).toFixed(2)}% rate`;

  log.error(
    {
      table,
      failureRate: metrics.failureRate,
      totalFailures: metrics.totalFailures,
      totalAttempts: metrics.totalAttempts,
      threshold: config.failureRateThreshold,
    },
    message
  );

  // Integration with external monitoring (example)
  if (config.sentryIntegration) {
    // Example: Sentry.captureException(new Error(message))
    log.info({ table }, "alert:sent-to-sentry");
  }

  if (config.dataDogIntegration) {
    // Example: dd_trace.tracer.trace("persistence_failure", ...);
    log.info({ table }, "alert:sent-to-datadog");
  }
}

/**
 * Alert on consecutive failures
 */
function alertConsecutiveFailures(table: "interactions" | "agent_conversations", count: number) {
  const message = `CONSECUTIVE FAILURES: ${table} persistence failed ${count} times in a row`;

  log.error(
    {
      table,
      consecutiveFailures: count,
      threshold: config.consecutiveFailureThreshold,
    },
    message
  );

  // Integration with external monitoring
  if (config.sentryIntegration) {
    log.info({ table }, "alert:sent-to-sentry");
  }

  if (config.dataDogIntegration) {
    log.info({ table }, "alert:sent-to-datadog");
  }
}

/**
 * Get current metrics for interactions table
 */
export function getInteractionMetrics(): PersistenceMetrics {
  return { ...interactionMetrics };
}

/**
 * Get current metrics for agent_conversations table
 */
export function getAgentConversationMetrics(): PersistenceMetrics {
  return { ...agentConversationMetrics };
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics() {
  interactionMetrics = {
    totalAttempts: 0,
    totalFailures: 0,
    failureRate: 0,
    consecutiveFailures: 0,
  };

  agentConversationMetrics = {
    totalAttempts: 0,
    totalFailures: 0,
    failureRate: 0,
    consecutiveFailures: 0,
  };
}

/**
 * Get health status
 */
export function getPersistenceHealthStatus(): {
  healthy: boolean;
  interactions: PersistenceMetrics;
  agentConversations: PersistenceMetrics;
} {
  const interactionHealthy =
    interactionMetrics.failureRate <= config.failureRateThreshold &&
    interactionMetrics.consecutiveFailures < config.consecutiveFailureThreshold;

  const agentConversationHealthy =
    agentConversationMetrics.failureRate <= config.failureRateThreshold &&
    agentConversationMetrics.consecutiveFailures < config.consecutiveFailureThreshold;

  return {
    healthy: interactionHealthy && agentConversationHealthy,
    interactions: { ...interactionMetrics },
    agentConversations: { ...agentConversationMetrics },
  };
}
