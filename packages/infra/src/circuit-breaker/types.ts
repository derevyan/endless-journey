/**
 * Circuit Breaker Types
 *
 * Type definitions for the circuit breaker infrastructure.
 */

// Re-export CircuitOpenError from schemas for consistency
export { CircuitOpenError } from "@journey/schemas";

/** Circuit breaker state */
export type CircuitState = "closed" | "open" | "half-open";

/** Service types that can have circuit breakers */
export type CircuitServiceType = "llm" | "webhook" | "telegram" | "crm" | "mcp";

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  /** Name for identification in logs and metrics */
  name: string;
  /** Service type for grouping */
  serviceType: CircuitServiceType;
  /** Timeout in milliseconds for requests */
  timeout?: number;
  /** Error threshold percentage (0-100) to trip the circuit */
  errorThresholdPercentage?: number;
  /** Number of requests to sample for error rate */
  volumeThreshold?: number;
  /** Time in milliseconds to wait before attempting reset */
  resetTimeout?: number;
  /** Enable/disable circuit breaker (for testing) */
  enabled?: boolean;
}

/** Circuit breaker statistics */
export interface CircuitStats {
  successes: number;
  failures: number;
  timeouts: number;
  rejects: number;
  fallbacks: number;
  latencyMean: number;
}

/** Circuit breaker metrics */
export interface CircuitMetrics {
  name: string;
  serviceType: CircuitServiceType;
  state: CircuitState;
  stats: CircuitStats;
  lastStateChange: string;
}
