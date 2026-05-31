/**
 * Circuit Breaker Module
 *
 * Exports all circuit breaker functionality.
 */

// Core functionality
export {
  createCircuitBreaker,
  getCircuitMetrics,
  getAllCircuitMetrics,
  isCircuitOpen,
} from "./circuit-breaker";

// Types
export type {
  CircuitState,
  CircuitServiceType,
  CircuitBreakerConfig,
  CircuitMetrics,
  CircuitStats,
} from "./types";

export { CircuitOpenError } from "./types";

// Registry (for advanced use cases)
export { circuitRegistry } from "./registry";

// Config (for testing/debugging)
export { defaultConfigs, getConfig } from "./config";
