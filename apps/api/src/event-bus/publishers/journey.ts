/**
 * Journey Event Publishers
 *
 * All journey-related event publishers using the factory pattern.
 *
 * @module events/publishers/journey
 */

import { EventTypes } from "@journey/schemas";
import { createEventPublisher } from "../publisher-factory";

// =============================================================================
// LIFECYCLE EVENTS
// =============================================================================

export const publishJourneyCreated = createEventPublisher(EventTypes.JOURNEY_CREATED);
export const publishJourneyUpdated = createEventPublisher(EventTypes.JOURNEY_UPDATED);
export const publishJourneyDeleted = createEventPublisher(EventTypes.JOURNEY_DELETED);
export const publishJourneyActivated = createEventPublisher(EventTypes.JOURNEY_ACTIVATED);
export const publishJourneyDeactivated = createEventPublisher(EventTypes.JOURNEY_DEACTIVATED);

// =============================================================================
// SESSION EVENTS
// =============================================================================

export const publishSessionStarted = createEventPublisher(EventTypes.JOURNEY_SESSION_STARTED);
export const publishSessionCompleted = createEventPublisher(EventTypes.JOURNEY_SESSION_COMPLETED);
export const publishScheduleFired = createEventPublisher(EventTypes.JOURNEY_SCHEDULE_FIRED);
export const publishWebhookReceived = createEventPublisher(EventTypes.JOURNEY_WEBHOOK_RECEIVED);

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

/**
 * All journey publishers as a single object
 *
 * @example
 * import { journey } from "./publishers";
 * await journey.created(ctx, data);
 */
export const journey = {
  // Lifecycle
  created: publishJourneyCreated,
  updated: publishJourneyUpdated,
  deleted: publishJourneyDeleted,
  activated: publishJourneyActivated,
  deactivated: publishJourneyDeactivated,

  // Session
  sessionStarted: publishSessionStarted,
  sessionCompleted: publishSessionCompleted,
  scheduleFired: publishScheduleFired,
  webhookReceived: publishWebhookReceived,
} as const;
