/**
 * Frontend Event System
 *
 * Re-exports all event system components for easy importing.
 *
 * @module lib/events
 */

// Types
export type {
  FrontendEvent,
  EventHandler,
  EventHandlerConfig,
  FrontendEventConfig,
} from "./types";
export { HANDLER_PRIORITY, matchesEventPattern, isValidEventType } from "./types";

// Registry
export { FRONTEND_EVENT_REGISTRY, getEventConfig } from "./registry";

// Dispatcher
export { eventDispatcher } from "./dispatcher";
export type { GlobalEventFilter, DispatcherMetrics } from "./dispatcher";

// Handlers
export {
  createQueryInvalidationHandler,
  QUERY_INVALIDATION_CONFIG,
} from "./handlers/query-invalidation";
export {
  createNotificationHandler,
  NOTIFICATION_CONFIG,
} from "./handlers/notifications";
