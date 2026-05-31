/**
 * Event Utilities
 *
 * Shared utilities for working with InteractionEvents, including deduplication
 * and event log management.
 *
 * @module features/simulator/lib/event-utils
 */

import { createLogger } from "@journey/logger";
import type { InteractionEvent } from "@journey/schemas";

const log = createLogger("event-utils");

/** Maximum number of events to keep in memory to prevent unbounded growth */
export const MAX_EVENT_LOG_SIZE = 5000;

/**
 * Deduplicate events by their ID.
 * Keeps the first occurrence of each event ID.
 *
 * @param events - Array of events to deduplicate
 * @returns Deduplicated array of events
 */
export function deduplicateEvents(events: InteractionEvent[]): InteractionEvent[] {
  const seenIds = new Set<string>();
  return events.filter((e) => {
    // Handle null/undefined IDs - always include them (with warning in dev)
    if (!e.id) {
      if (import.meta.env.DEV) {
        log.warn({ event: e }, "eventUtils:missingId");
      }
      return true;
    }
    if (seenIds.has(e.id)) {
      return false;
    }
    seenIds.add(e.id);
    return true;
  });
}

/**
 * Merge two event logs, deduplicating by ID and applying max size limit.
 * Uses FIFO eviction if the combined log exceeds maxSize.
 *
 * @param existing - Current event log
 * @param incoming - New events to add
 * @param maxSize - Maximum number of events to keep (default: MAX_EVENT_LOG_SIZE)
 * @returns Merged and potentially trimmed event log
 */
export function mergeEventLogs(
  existing: InteractionEvent[],
  incoming: InteractionEvent[],
  maxSize: number = MAX_EVENT_LOG_SIZE
): InteractionEvent[] {
  // Build set of existing IDs for efficient lookup
  const existingIds = new Set(
    existing.map((e) => e.id).filter((id): id is string => Boolean(id))
  );

  // Filter incoming events to only include new ones
  const uniqueNew = incoming.filter((e) => e.id && !existingIds.has(e.id));

  // Merge arrays
  const merged = [...existing, ...uniqueNew];

  // Apply FIFO eviction if exceeding max size
  if (merged.length > maxSize) {
    return merged.slice(-maxSize);
  }

  return merged;
}

/**
 * Generate a unique event ID.
 * Uses UUID v4 format to match database constraints.
 *
 * @param prefix - Deprecated parameter, kept for API compatibility but not used
 * @returns Unique event ID string in UUID v4 format
 */
export function createEventId(_prefix?: string): string {
  // Generate UUID v4 format - matches database FK constraint on sent_messages.interaction_event_id
  return crypto.randomUUID();
}
