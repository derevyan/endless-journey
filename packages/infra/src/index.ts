/**
 * @journey/infra - Infrastructure utilities
 *
 * Shared infrastructure components for the Journey Builder platform.
 *
 * @module infra
 */

// Circuit Breaker
export {
  // Core functionality
  createCircuitBreaker,
  getCircuitMetrics,
  getAllCircuitMetrics,
  isCircuitOpen,
  // Types
  type CircuitState,
  type CircuitServiceType,
  type CircuitBreakerConfig,
  type CircuitMetrics,
  type CircuitStats,
  // Error
  CircuitOpenError,
  // Registry
  circuitRegistry,
} from "./circuit-breaker";
