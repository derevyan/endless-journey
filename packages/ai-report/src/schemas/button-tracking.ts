/**
 * Button Click Tracking Schema
 *
 * Track every button click with full outcome details.
 * Essential for debugging "click received but no transition" issues.
 *
 * @module @journey/ai-report/schemas/button-tracking
 */

import { z } from "zod";

/**
 * Active button snapshot at click time.
 */
export const ActiveButtonAtClickSchema = z.object({
  id: z.string(),
  text: z.string(),
  targetNodeId: z.string().optional(),
  source: z.enum(["node", "questionnaire", "plugin", "agent"]),
});

export type ActiveButtonAtClick = z.infer<typeof ActiveButtonAtClickSchema>;

/**
 * Button click outcome types.
 */
export const ButtonClickOutcomeSchema = z.enum([
  "transition_success",    // Normal - transitioned to target node
  "agent_reexecute",       // AI quick-reply - agent re-executed instead of transition
  "button_not_found",      // Button ID not in activeButtons
  "edge_not_found",        // Button found but no edge for it
  "guard_blocked",         // Transition attempted but guard blocked
  "error",                 // Error during processing
  "no_handler",            // No handler registered for this button
]);

export type ButtonClickOutcome = z.infer<typeof ButtonClickOutcomeSchema>;

/**
 * Track every button click with full outcome details.
 */
export const ButtonClickDetailSchema = z.object({
  timestamp: z.string().datetime(),
  clickId: z.string(), // From interaction event ID

  // What was clicked
  buttonId: z.string(),
  buttonLabel: z.string().optional(),

  // Context at time of click
  currentNodeId: z.string(),
  currentNodeType: z.string(),
  currentNodeLabel: z.string().optional(),

  // Was button valid?
  buttonFound: z.boolean(),
  activeButtonsAtClick: z.array(ActiveButtonAtClickSchema).optional(),

  // What happened after click?
  outcome: ButtonClickOutcomeSchema,

  // If transition happened
  transitionedToNodeId: z.string().optional(),
  transitionedToNodeLabel: z.string().optional(),

  // If failed - why?
  failureReason: z.string().optional(),
  failureDetails: z.record(z.string(), z.unknown()).optional(),
});

export type ButtonClickDetail = z.infer<typeof ButtonClickDetailSchema>;

/**
 * Unprocessed event outcome types.
 */
export const UnprocessedEventOutcomeSchema = z.enum([
  "ignored",           // Event was ignored (e.g., session paused)
  "handler_not_found", // No handler for this event type
  "invalid_state",     // Session in invalid state for this event
  "missing_edge",      // Expected edge doesn't exist
  "button_mismatch",   // Button ID doesn't match any active button
  "guard_blocked",     // Transition attempted but guard blocked it
  "error",             // Error during processing
  "unknown",           // Unknown reason
]);

export type UnprocessedEventOutcome = z.infer<typeof UnprocessedEventOutcomeSchema>;

/**
 * Track events that were received but didn't result in expected action.
 */
export const UnprocessedEventSchema = z.object({
  timestamp: z.string().datetime(),
  eventId: z.string(),
  eventType: z.string(), // user.click, user.message, timer.expired, etc.

  // Context
  currentNodeId: z.string(),
  sessionStatus: z.enum(["active", "completed", "dropped", "paused", "error"]),

  // What was expected vs what happened
  expectedAction: z.string(), // "transition to target node", "re-execute agent", etc.
  actualOutcome: UnprocessedEventOutcomeSchema,

  // Debug info
  reason: z.string(),
  debugContext: z.record(z.string(), z.unknown()).optional(),
});

export type UnprocessedEvent = z.infer<typeof UnprocessedEventSchema>;
