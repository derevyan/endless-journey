/**
 * Frontend Event System Types
 *
 * Type definitions for the frontend event dispatch system.
 * Imports core types from @journey/schemas for type safety.
 *
 * @module lib/events/types
 */

import { EVENT_REGISTRY, type EnrichedEvent, type EventType } from "@journey/schemas";

// =============================================================================
// FRONTEND EVENT
// =============================================================================

/**
 * Frontend event extends EnrichedEvent with additional context
 * This is what handlers receive when processing events
 */
export interface FrontendEvent extends EnrichedEvent {
  /** Type-safe event type from registry */
  type: EventType | string;
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Event handler function type
 */
export type EventHandler<T extends FrontendEvent = FrontendEvent> = (
  event: T
) => void | Promise<void>;

/**
 * Configuration for registering an event handler
 */
export interface EventHandlerConfig {
  /** Handler function to execute */
  handler: EventHandler;
  /** Priority (higher runs first, default: 0) */
  priority?: number;
  /** Optional filter to selectively handle events */
  filter?: (event: FrontendEvent) => boolean;
}

// =============================================================================
// REGISTRY TYPES
// =============================================================================

/**
 * Query key type - can be an array of strings or any other array type
 * TanStack Query supports arrays with mixed types
 */
export type QueryKey = readonly unknown[];

/**
 * Configuration for an event type in the frontend registry
 */
export interface FrontendEventConfig {
  /** Query keys to invalidate when this event is received */
  invalidates?: readonly QueryKey[];
  /** Whether to show a notification */
  notify?: boolean;
  /** Custom notification message (uses event description if not provided) */
  notifyMessage?: string;
  /** Notification variant */
  notifyVariant?: "success" | "info" | "warning" | "error";
}

/**
 * Handler priority levels
 */
export const HANDLER_PRIORITY = {
  /** Critical handlers run first (e.g., query invalidation) */
  CRITICAL: 100,
  /** High priority handlers */
  HIGH: 50,
  /** Normal priority (default) */
  NORMAL: 0,
  /** Low priority handlers run last */
  LOW: -50,
} as const;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if an event type matches a pattern
 *
 * Supports:
 * - Exact match: "crm.stage.changed"
 * - Namespace wildcard: "crm.*" (matches any event starting with "crm.")
 *
 * @param eventType - The actual event type
 * @param pattern - Pattern to match against
 * @returns True if the event type matches the pattern
 *
 * @example
 * ```ts
 * matchesEventPattern("crm.stage.changed", "crm.*") // true
 * matchesEventPattern("crm.stage.changed", "crm.stage.changed") // true
 * matchesEventPattern("journey.created", "crm.*") // false
 * ```
 */
export function matchesEventPattern(eventType: string, pattern: string): boolean {
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return eventType.startsWith(prefix + ".");
  }
  return eventType === pattern;
}

/**
 * Type guard to check if a string is a valid EventType
 *
 * Use this at boundaries (e.g., SSE parsing) to validate event types
 * before processing them with type-safe handlers.
 *
 * @param type - String to check
 * @returns True if the type is a known EventType
 *
 * @example
 * ```ts
 * const eventType = sseEvent.type; // string
 *
 * if (isValidEventType(eventType)) {
 *   // eventType is now narrowed to EventType
 *   const config = EVENT_REGISTRY[eventType];
 * }
 * ```
 */
export function isValidEventType(type: string): type is EventType {
  return type in EVENT_REGISTRY;
}
