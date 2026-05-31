/**
 * Events System
 *
 * Centralized event publishing and consumption for the Journey platform.
 *
 * @module events
 *
 * @example
 * // Import from events
 * import { publishEvent, createEvent, publishers } from "../../event-bus";
 *
 * // Publish an event
 * await publishers.crm.stageChanged(ctx, data);
 */

// Core event bus
export * from "./event-bus";

// Publisher factory
export * from "./publisher-factory";

// Utilities
export * from "./utils";

// Consumers
export * from "./consumers";

// Publishers
export * from "./publishers";

// Automation service (rename getAutomationQueue to avoid conflict with consumers)
export {
  getAutomationQueue as getAutomationEventQueue,
  getAutomationEventQueueStats,
  initAutomationEventService,
  isAutomationEventServiceInitialized,
  shutdownAutomationEventService,
  type AutomationEventCallback,
} from "./automation/service";

// Event tracing
export {
  clearCausedBy,
  createChildContext,
  createTracingContext,
  getCausedBy,
  getCorrelationId,
  getTracingContext,
  runWithTracing,
  runWithTracingAsync,
  setCausedBy,
  type TracingContext,
} from "../lib/event-tracing";
