/**
 * Interaction Event Publishers
 *
 * Journey engine interaction event publishers using the factory pattern.
 *
 * @module events/publishers/interaction
 */

import { EventTypes } from "@journey/schemas";
import { createEventPublisher } from "../publisher-factory";

// =============================================================================
// USER INTERACTION EVENTS
// =============================================================================

export const publishUserMessage = createEventPublisher(EventTypes.USER_MESSAGE);
export const publishUserClick = createEventPublisher(EventTypes.USER_CLICK);

// =============================================================================
// ENGINE EVENTS (Journey engine operations)
// =============================================================================

export const publishEngineMessage = createEventPublisher(EventTypes.ENGINE_MESSAGE);
export const publishEngineTransition = createEventPublisher(EventTypes.ENGINE_TRANSITION);
export const publishEngineError = createEventPublisher(EventTypes.ENGINE_ERROR);

// =============================================================================
// SESSION EVENTS (Session state changes)
// =============================================================================

export const publishSessionTags = createEventPublisher(EventTypes.SESSION_TAGS);
export const publishSessionVariables = createEventPublisher(EventTypes.SESSION_VARIABLES);

// =============================================================================
// TIMER EVENTS
// =============================================================================

export const publishTimerExpired = createEventPublisher(EventTypes.TIMER_EXPIRED);
export const publishTimerFollowup = createEventPublisher(EventTypes.TIMER_FOLLOWUP);

// =============================================================================
// JOURNEY ENGINE EVENTS
// =============================================================================

export const publishJourneyTeleport = createEventPublisher(EventTypes.JOURNEY_TELEPORT);
export const publishJourneyCrm = createEventPublisher(EventTypes.JOURNEY_CRM);

// =============================================================================
// LLM EVENTS
// =============================================================================

export const publishMindstateUpdated = createEventPublisher(EventTypes.MINDSTATE_UPDATED);
export const publishLlmHitl = createEventPublisher(EventTypes.LLM_HITL);
export const publishLlmGuardBlocked = createEventPublisher(EventTypes.LLM_GUARD_BLOCKED);
export const publishLlmGuardFallback = createEventPublisher(EventTypes.LLM_GUARD_FALLBACK);

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

/**
 * All interaction publishers as a single object
 *
 * @example
 * import { interaction } from "./publishers";
 * await interaction.userMessage(ctx, data);
 */
export const interaction = {
  // User events
  userMessage: publishUserMessage,
  userClick: publishUserClick,

  // Engine events
  engineMessage: publishEngineMessage,
  engineTransition: publishEngineTransition,
  engineError: publishEngineError,

  // Session events
  sessionTags: publishSessionTags,
  sessionVariables: publishSessionVariables,

  // Timer events
  timerExpired: publishTimerExpired,
  timerFollowup: publishTimerFollowup,

  // Journey engine events
  journeyTeleport: publishJourneyTeleport,
  journeyCrm: publishJourneyCrm,

  // LLM events
  mindstateUpdated: publishMindstateUpdated,
  llmHitl: publishLlmHitl,
  llmGuardBlocked: publishLlmGuardBlocked,
  llmGuardFallback: publishLlmGuardFallback,
} as const;
