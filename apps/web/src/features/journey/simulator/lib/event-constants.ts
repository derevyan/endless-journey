/**
 * Event Constants
 *
 * Single source of truth for event-related constants.
 * Eliminates duplication between SSE event filtering and event processing.
 *
 * @module features/simulator/lib/event-constants
 */

/**
 * Event type prefixes that should be logged to the event log
 * These are events we want to track for debugging and analysis
 */
export const LOGGABLE_EVENT_PREFIXES = [
  "engine.",
  "session.",
  "timer.",
  "journey.",
  "mindstate.",
  "user.",
] as const;

export type LoggableEventPrefix = (typeof LOGGABLE_EVENT_PREFIXES)[number];

/**
 * Maximum number of events to buffer before dropping oldest
 * Prevents unbounded memory growth when SSE connects before session creation
 */
export const MAX_PENDING_EVENTS = 100;

/**
 * Check if an event type should be logged
 * @param eventType - The event type to check
 * @returns true if the event type matches a loggable prefix
 */
export function isLoggableEvent(eventType: string): boolean {
  return LOGGABLE_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix));
}

/**
 * Check if an event should be routed to SSE connection
 * All loggable events plus simulator.* events
 */
export function shouldConnectEvent(eventType: string): boolean {
  return isLoggableEvent(eventType) || eventType.startsWith("simulator.");
}
