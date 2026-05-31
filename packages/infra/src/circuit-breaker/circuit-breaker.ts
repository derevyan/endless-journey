/**
 * Circuit Breaker Implementation
 *
 * Wraps opossum circuit breaker with Journey-specific logging and metrics.
 * Provides a simple API for protecting async functions from cascading failures.
 */

import { createLogger } from "@journey/logger";
import CircuitBreaker from "opossum";
import type { CircuitBreakerConfig, CircuitMetrics } from "./types";
import { CircuitOpenError } from "./types";
import { getConfig } from "./config";
import { circuitRegistry } from "./registry";

const log = createLogger("circuit-breaker");

/**
 * Create a circuit breaker for an async function
 *
 * @param fn - The async function to wrap
 * @param config - Circuit breaker configuration
 * @returns Wrapped function with circuit breaker protection
 *
 * @example
 * ```typescript
 * const protectedFetch = createCircuitBreaker(
 *   fetch,
 *   { name: "api-service", serviceType: "webhook" }
 * );
 *
 * // Use like normal fetch, but with circuit breaker protection
 * const response = await protectedFetch("https://api.example.com");
 * ```
 */
export function createCircuitBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: CircuitBreakerConfig
): (...args: TArgs) => Promise<TResult> {
  // Merge with defaults
  const fullConfig = getConfig(config);

  // Return passthrough if disabled
  if (!fullConfig.enabled) {
    log.info({ name: config.name }, "circuitBreaker:disabled");
    return fn;
  }

  // Create opossum circuit breaker
  const breaker = new CircuitBreaker(fn, {
    timeout: fullConfig.timeout,
    errorThresholdPercentage: fullConfig.errorThresholdPercentage,
    volumeThreshold: fullConfig.volumeThreshold,
    resetTimeout: fullConfig.resetTimeout,
    name: fullConfig.name,
  });

  // Setup event handlers for logging
  breaker.on("open", () => {
    log.warn(
      {
        name: fullConfig.name,
        serviceType: fullConfig.serviceType,
        stats: {
          failures: breaker.stats.failures,
          successes: breaker.stats.successes,
        },
      },
      "circuitBreaker:open"
    );
  });

  breaker.on("close", () => {
    log.info(
      { name: fullConfig.name, serviceType: fullConfig.serviceType },
      "circuitBreaker:close"
    );
  });

  breaker.on("halfOpen", () => {
    log.info(
      { name: fullConfig.name, serviceType: fullConfig.serviceType },
      "circuitBreaker:halfOpen"
    );
  });

  breaker.on("timeout", () => {
    log.warn(
      { name: fullConfig.name, timeoutMs: fullConfig.timeout },
      "circuitBreaker:timeout"
    );
  });

  breaker.on("reject", () => {
    log.warn({ name: fullConfig.name }, "circuitBreaker:reject");
  });

  // Register in global registry for health checks
  circuitRegistry.register(fullConfig.name, breaker, fullConfig.serviceType);

  log.debug(
    {
      name: fullConfig.name,
      serviceType: fullConfig.serviceType,
      timeout: fullConfig.timeout,
      errorThreshold: fullConfig.errorThresholdPercentage,
      resetTimeout: fullConfig.resetTimeout,
    },
    "circuitBreaker:created"
  );

  // Return wrapped function
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await breaker.fire(...args);
    } catch (error) {
      // Check if circuit is open and wrap error appropriately
      if (breaker.opened) {
        throw new CircuitOpenError(fullConfig.name, fullConfig.serviceType);
      }
      throw error;
    }
  };
}

/**
 * Get metrics for a specific circuit breaker
 */
export function getCircuitMetrics(name: string): CircuitMetrics | undefined {
  return circuitRegistry.getMetrics(name);
}

/**
 * Get metrics for all circuit breakers
 */
export function getAllCircuitMetrics(): CircuitMetrics[] {
  return circuitRegistry.getAllMetrics();
}

/**
 * Check if a circuit is currently open
 */
export function isCircuitOpen(name: string): boolean {
  return circuitRegistry.isOpen(name);
}
