/**
 * Circuit Breaker Registry
 *
 * Global registry for tracking all circuit breakers.
 * Used for health checks and metrics collection.
 */

import type CircuitBreaker from "opossum";
import type { CircuitMetrics, CircuitServiceType, CircuitState } from "./types";

interface RegisteredCircuit {
  breaker: CircuitBreaker;
  serviceType: CircuitServiceType;
  registeredAt: Date;
  lastStateChange: Date;
}

class CircuitRegistry {
  private circuits = new Map<string, RegisteredCircuit>();

  /**
   * Register a circuit breaker in the registry
   */
  register(name: string, breaker: CircuitBreaker, serviceType: CircuitServiceType): void {
    const now = new Date();
    this.circuits.set(name, {
      breaker,
      serviceType,
      registeredAt: now,
      lastStateChange: now,
    });

    // Track state changes
    breaker.on("open", () => this.updateStateChange(name));
    breaker.on("close", () => this.updateStateChange(name));
    breaker.on("halfOpen", () => this.updateStateChange(name));
  }

  private updateStateChange(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.lastStateChange = new Date();
    }
  }

  /**
   * Get metrics for a specific circuit breaker
   */
  getMetrics(name: string): CircuitMetrics | undefined {
    const circuit = this.circuits.get(name);
    if (!circuit) return undefined;

    const { breaker, serviceType, lastStateChange } = circuit;
    const stats = breaker.stats;

    return {
      name,
      serviceType,
      state: this.getState(breaker),
      stats: {
        successes: stats.successes,
        failures: stats.failures,
        timeouts: stats.timeouts,
        rejects: stats.rejects,
        fallbacks: stats.fallbacks,
        latencyMean: stats.latencyMean,
      },
      lastStateChange: lastStateChange.toISOString(),
    };
  }

  /**
   * Get metrics for all registered circuit breakers
   */
  getAllMetrics(): CircuitMetrics[] {
    return Array.from(this.circuits.keys())
      .map((name) => this.getMetrics(name))
      .filter((m): m is CircuitMetrics => m !== undefined);
  }

  /**
   * Check if a specific circuit is currently open
   */
  isOpen(name: string): boolean {
    const circuit = this.circuits.get(name);
    return circuit?.breaker.opened ?? false;
  }

  /**
   * Get circuit breaker state
   */
  private getState(breaker: CircuitBreaker): CircuitState {
    if (breaker.opened) return "open";
    if (breaker.halfOpen) return "half-open";
    return "closed";
  }

  /**
   * Clear all circuits (for testing)
   */
  clear(): void {
    this.circuits.clear();
  }

  /**
   * Get count of registered circuits
   */
  get size(): number {
    return this.circuits.size;
  }
}

/** Global circuit breaker registry */
export const circuitRegistry = new CircuitRegistry();
