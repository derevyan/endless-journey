/**
 * Activity Event Filters
 *
 * Client-side filters for user activity timeline.
 * Filters are applied via React Query's `select` option for memoized transformation.
 */

import { EventTypes, type UserActivityEntry } from "@journey/schemas";

/**
 * Event types to exclude from activity timeline.
 * These are backend events that duplicate user-facing consolidated events.
 *
 * - tag.added/tag.removed: API logs per-tag for automations,
 *   but session.tags shows consolidated "Tags updated" view
 * - journey.session.completed: Internal system event, session completion
 *   is already shown via session_completed activity type
 */
const EXCLUDED_RAW_TYPES: string[] = [
  EventTypes.TAG_ADDED,
  EventTypes.TAG_REMOVED,
  EventTypes.JOURNEY_SESSION_COMPLETED,
  EventTypes.JOURNEY_SESSION_STARTED,
  EventTypes.ENGINE_MESSAGE,
  "ENGINE_MESSAGE", // Legacy: some DB entries have uppercase variant
];

/**
 * Filter activity entries to remove duplicate/internal events
 */
export function filterActivityEvents(entries: UserActivityEntry[]): UserActivityEntry[] {
  return entries.filter((entry) => !EXCLUDED_RAW_TYPES.includes(entry.rawType ?? ""));
}
