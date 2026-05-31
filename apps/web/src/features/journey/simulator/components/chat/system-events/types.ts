/**
 * System Events Types
 *
 * Shared types for system event card components displayed in the Chat panel.
 *
 * @module features/simulator/components/chat/system-events/types
 */

import { EventTypes, type InteractionEvent } from "@journey/schemas";

/**
 * Props passed to each system event card component
 */
export interface SystemEventProps {
  /** The interaction event to display */
  event: InteractionEvent;
  /** Previous event for time delta calculation */
  prevEvent?: InteractionEvent;
  /** Node metadata from journey definition */
  nodeMetadata?: {
    type: string;
    label: string;
  };
}

/**
 * Event types that should be displayed as cards in enhanced view.
 * These are system events that aren't already shown as chat messages.
 */
export const DISPLAYABLE_EVENT_TYPES: Set<string> = new Set([
  EventTypes.ENGINE_TRANSITION,
  EventTypes.TIMER_EXPIRED,
  EventTypes.ENGINE_ERROR,
  EventTypes.SESSION_TAGS,
  EventTypes.SESSION_VARIABLES,
  EventTypes.JOURNEY_TELEPORT,
  EventTypes.MINDSTATE_UPDATED,
  EventTypes.JOURNEY_CRM,
  EventTypes.TIMER_FOLLOWUP, // Follow-up sequence events
]);

/**
 * Check if an event should be displayed as a card in the chat panel.
 * Events like user.message, user.click, and system.message are already
 * shown as chat bubbles, so we don't need cards for them.
 */
export function shouldShowEventCard(event: InteractionEvent): boolean {
  return DISPLAYABLE_EVENT_TYPES.has(event.type);
}
