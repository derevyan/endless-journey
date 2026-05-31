/**
 * Event Dispatcher
 *
 * Central event dispatcher for routing SSE events to registered handlers.
 * Supports priority-based handler execution, type-specific handlers,
 * global filtering, and observability metrics.
 *
 * @module lib/events/dispatcher
 */

import { createLogger, serializeError } from "@journey/logger";

import type { FrontendEvent, EventHandlerConfig } from "./types";
import { getEventConfig } from "./registry";

const log = createLogger("event-dispatcher");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Filter function for global event filtering
 */
export type GlobalEventFilter = (event: FrontendEvent) => boolean;

/**
 * Dispatcher metrics for observability
 */
export interface DispatcherMetrics {
  /** Total events dispatched */
  eventsDispatched: number;
  /** Total handler executions */
  handlersExecuted: number;
  /** Total handler errors */
  handlerErrors: number;
  /** Unknown event types received */
  unknownEventTypes: number;
  /** Events filtered by global filter */
  eventsFiltered: number;
  /** Duplicate events skipped */
  duplicatesSkipped: number;
  /** Average dispatch time in ms */
  averageDispatchTime: number;
}

// =============================================================================
// EVENT DISPATCHER CLASS
// =============================================================================

/**
 * Event dispatcher for routing events to registered handlers
 */
class EventDispatcher {
  /** Type-specific handlers */
  private handlers: Map<string, EventHandlerConfig[]> = new Map();

  /** Global handlers (receive all events) */
  private globalHandlers: EventHandlerConfig[] = [];

  /** Queue of processed event IDs (for FIFO order) */
  private processedEventQueue: string[] = [];

  /** Set of processed event IDs (for fast lookup) */
  private processedEventSet: Set<string> = new Set();

  /** Max size of processed events cache */
  private readonly maxProcessedCache = 1000;

  /** Global filter (if set, only matching events are dispatched) */
  private globalFilter: GlobalEventFilter | null = null;

  /** Debug mode flag */
  private debugMode = false;

  /** Metrics tracking */
  private metrics: DispatcherMetrics = {
    eventsDispatched: 0,
    handlersExecuted: 0,
    handlerErrors: 0,
    unknownEventTypes: 0,
    eventsFiltered: 0,
    duplicatesSkipped: 0,
    averageDispatchTime: 0,
  };

  /** Dispatch time samples for averaging */
  private dispatchTimes: number[] = [];
  private readonly maxTimeSamples = 100;

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Set a global filter for all events
   * Only events passing the filter will be dispatched
   *
   * @param filter - Filter function or null to clear
   *
   * @example
   * ```ts
   * // Only process CRM events
   * eventDispatcher.setGlobalFilter((event) =>
   *   event.type.startsWith("crm.")
   * );
   *
   * // Clear filter
   * eventDispatcher.setGlobalFilter(null);
   * ```
   */
  setGlobalFilter(filter: GlobalEventFilter | null): void {
    this.globalFilter = filter;
    log.debug({ hasFilter: filter !== null }, "dispatcher:globalFilterSet");
  }

  /**
   * Enable or disable debug mode
   * In debug mode, more detailed logs are produced
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    log.info({ debugMode: enabled }, "dispatcher:debugModeSet");
  }

  // ===========================================================================
  // REGISTRATION
  // ===========================================================================

  /**
   * Register a handler for specific event type(s)
   *
   * @param eventType - Event type or array of types to handle
   * @param config - Handler configuration
   * @returns Unsubscribe function
   */
  register(
    eventType: string | string[],
    config: EventHandlerConfig
  ): () => void {
    const types = Array.isArray(eventType) ? eventType : [eventType];

    types.forEach((type) => {
      const existing = this.handlers.get(type) || [];
      existing.push(config);
      // Sort by priority (higher first)
      existing.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.handlers.set(type, existing);
    });

    if (this.debugMode) {
      log.debug({ eventTypes: types }, "dispatcher:handlerRegistered");
    }

    // Return unsubscribe function
    return () => {
      types.forEach((type) => {
        const existing = this.handlers.get(type);
        if (existing) {
          const filtered = existing.filter((h) => h !== config);
          if (filtered.length > 0) {
            this.handlers.set(type, filtered);
          } else {
            this.handlers.delete(type);
          }
        }
      });
    };
  }

  /**
   * Register a global handler that receives all events
   *
   * @param config - Handler configuration
   * @returns Unsubscribe function
   */
  registerGlobal(config: EventHandlerConfig): () => void {
    this.globalHandlers.push(config);
    // Sort by priority (higher first)
    this.globalHandlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    if (this.debugMode) {
      log.debug("dispatcher:globalHandlerRegistered");
    }

    return () => {
      this.globalHandlers = this.globalHandlers.filter((h) => h !== config);
    };
  }

  // ===========================================================================
  // DISPATCH
  // ===========================================================================

  /**
   * Dispatch an event to all registered handlers
   *
   * @param event - Event to dispatch
   */
  async dispatch(event: FrontendEvent): Promise<void> {
    const startTime = performance.now();

    // Deduplicate events by ID (fast O(1) lookup)
    if (this.processedEventSet.has(event.id)) {
      this.metrics.duplicatesSkipped++;
      if (this.debugMode) {
        log.debug({ eventId: event.id }, "dispatcher:duplicateSkipped");
      }
      return;
    }

    // Check global filter
    if (this.globalFilter && !this.globalFilter(event)) {
      this.metrics.eventsFiltered++;
      if (this.debugMode) {
        log.debug({ eventType: event.type }, "dispatcher:filteredByGlobalFilter");
      }
      return;
    }

    // Add to processed cache (both queue for order and set for lookup)
    this.processedEventQueue.push(event.id);
    this.processedEventSet.add(event.id);

    // Cleanup cache if too large (remove oldest entries first - FIFO)
    if (this.processedEventQueue.length > this.maxProcessedCache) {
      const toRemove = Math.floor(this.maxProcessedCache * 0.1);
      const removedIds = this.processedEventQueue.splice(0, toRemove);
      for (const id of removedIds) {
        this.processedEventSet.delete(id);
      }
    }

    // Validate event type against registry
    const eventConfig = getEventConfig(event.type);
    if (!eventConfig) {
      this.metrics.unknownEventTypes++;
      log.warn(
        { eventType: event.type, eventId: event.id },
        "dispatcher:unknownEventType"
      );
    }

    if (this.debugMode) {
      log.debug(
        { eventType: event.type, eventId: event.id, hasConfig: !!eventConfig },
        "dispatcher:dispatchEvent"
      );
    }

    // Collect all handlers to run
    const handlersToRun: EventHandlerConfig[] = [];

    // Add type-specific handlers
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      handlersToRun.push(...typeHandlers);
    }

    // Add global handlers
    handlersToRun.push(...this.globalHandlers);

    // Sort by priority (higher first)
    handlersToRun.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Execute handlers
    for (const config of handlersToRun) {
      try {
        // Check filter
        if (config.filter && !config.filter(event)) {
          continue;
        }

        await config.handler(event);
        this.metrics.handlersExecuted++;
      } catch (err) {
        this.metrics.handlerErrors++;
        log.error(
          { err: serializeError(err), eventType: event.type },
          "dispatcher:handlerError"
        );
      }
    }

    // Update metrics
    this.metrics.eventsDispatched++;
    const dispatchTime = performance.now() - startTime;
    this.dispatchTimes.push(dispatchTime);
    if (this.dispatchTimes.length > this.maxTimeSamples) {
      this.dispatchTimes.shift();
    }
    this.metrics.averageDispatchTime =
      this.dispatchTimes.reduce((a, b) => a + b, 0) / this.dispatchTimes.length;
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Clear all registered handlers and processed events cache
   */
  clear(): void {
    this.handlers.clear();
    this.globalHandlers = [];
    this.processedEventQueue = [];
    this.processedEventSet.clear();
    log.debug("dispatcher:cleared");
  }

  /**
   * Get count of registered handlers
   */
  getHandlerCount(): { typeSpecific: number; global: number } {
    let typeSpecific = 0;
    this.handlers.forEach((handlers) => {
      typeSpecific += handlers.length;
    });
    return {
      typeSpecific,
      global: this.globalHandlers.length,
    };
  }

  /**
   * Get dispatcher metrics for observability
   */
  getMetrics(): DispatcherMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      eventsDispatched: 0,
      handlersExecuted: 0,
      handlerErrors: 0,
      unknownEventTypes: 0,
      eventsFiltered: 0,
      duplicatesSkipped: 0,
      averageDispatchTime: 0,
    };
    this.dispatchTimes = [];
    log.debug("dispatcher:metricsReset");
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global event dispatcher instance
 */
export const eventDispatcher = new EventDispatcher();
