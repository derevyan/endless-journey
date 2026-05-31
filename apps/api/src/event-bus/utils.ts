/**
 * Event Utilities
 *
 * Shared utilities for event publishing across different event publishers.
 *
 * @module events/utils
 */

import { createLogger, serializeError } from "@journey/logger";
import type { EventSource } from "@journey/schemas";

const log = createLogger("event-utils");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Common trigger types for all event contexts
 */
export type EventTrigger = "journey" | "manual" | "automation" | "webhook";

/**
 * Base context for all event publishing
 */
export interface BaseEventContext {
  organizationId: string;
  performedBy?: string;
  triggeredBy?: EventTrigger;
}

/**
 * Context for client-specific events
 */
export interface ClientEventContext extends BaseEventContext {
  clientId: string;
  sessionId?: string;
  journeyId?: string;
  triggeredBy: EventTrigger;
}

/**
 * Context for organization-level events (not client-specific)
 */
export interface OrgEventContext extends BaseEventContext {
  performedBy: string; // Required for org-level events
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map trigger type to EventSource
 *
 * Converts the trigger type (what initiated the action) to the event source
 * format expected by the event bus.
 *
 * @param triggeredBy - The trigger type
 * @returns The corresponding EventSource value
 */
export function mapTriggerToSource(triggeredBy: EventTrigger): EventSource {
  switch (triggeredBy) {
    case "journey":
      return "journey";
    case "manual":
      return "manual";
    case "webhook":
      return "webhook";
    case "automation":
      return "automation";
    default:
      return "system";
  }
}

/**
 * Safely publish an event with error handling
 *
 * Logs errors but doesn't throw to avoid breaking API responses.
 * This ensures that event publishing failures don't cascade to break
 * the main business logic.
 *
 * @param eventType - The event type being published (for logging)
 * @param publishFn - The async function that publishes the event
 * @param logContext - The logging context prefix (e.g., "crmEventPublisher")
 */
export async function safePublishEvent(
  eventType: string,
  publishFn: () => Promise<void>,
  logContext: string
): Promise<void> {
  try {
    await publishFn();
  } catch (error) {
    log.warn(
      { eventType, err: serializeError(error) },
      `${logContext}:publishFailed`
    );
  }
}
