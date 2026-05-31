/**
 * Event Validation Module
 *
 * Validates incoming events before processing.
 * Extracted from EventRouter to follow Single Responsibility Principle.
 *
 * Responsibilities:
 * - Session ID/User ID validation
 * - Active session status check
 * - Stale timeout detection
 * - Plugin follow-up timeout handling
 */

import type { createLogger } from "@journey/logger";
import type { EnhancedUserJourney } from "@journey/schemas";
import type { JourneyEvent, TimerService } from "../types";

// =============================================================================
// TYPES
// =============================================================================

export type ValidationFailureReason =
  | "session_mismatch"
  | "user_mismatch"
  | "inactive_session"
  | "stale_timeout"
  | "plugin_followup_handled";

export interface EventValidationResult {
  valid: boolean;
  reason?: ValidationFailureReason;
}

/** Result from plugin timeout handler */
export type PluginTimeoutCallbackResult =
  | { action: "continue" }
  | { action: "transition"; targetNodeId: string; trigger: string };

export interface PluginTimeoutCallbacks {
  onPluginTimeout?: (timerId: string) => Promise<PluginTimeoutCallbackResult>;
  onTransition: (targetNodeId: string, trigger: string, buttonId?: string) => Promise<void>;
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Validate event against session before processing
 *
 * Checks:
 * - Event sessionId matches engine session
 * - Event userId matches session user
 * - Session is active
 */
export function validateEvent(
  event: JourneyEvent,
  session: EnhancedUserJourney,
  log: ReturnType<typeof createLogger>
): EventValidationResult {
  // SESSION VALIDATION: Verify event matches the engine session
  // Prevents misrouted events from mutating wrong session in multi-session adapters
  if (!event.sessionId || event.sessionId !== session.sessionId) {
    log.warn(
      { eventSessionId: event.sessionId, engineSessionId: session.sessionId, eventType: event.type },
      "router:sessionMismatch:eventRejected"
    );
    return { valid: false, reason: "session_mismatch" };
  }

  if (!event.userId || event.userId !== session.userId) {
    log.warn(
      { eventUserId: event.userId, sessionUserId: session.userId, eventType: event.type },
      "router:userMismatch:eventRejected"
    );
    return { valid: false, reason: "user_mismatch" };
  }

  // GUARD: Only process journey events for active sessions
  if (session.status !== "active") {
    log.warn({ status: session.status, eventType: event.type }, "router:inactiveSession:eventIgnored");
    return { valid: false, reason: "inactive_session" };
  }

  return { valid: true };
}

/**
 * Check if a timeout event is stale (timer was already cancelled)
 *
 * This prevents race conditions where a user message cancels a timer,
 * but the timeout event was already dispatched before cancellation completed.
 */
export function isStaleTimeout(
  event: JourneyEvent,
  timerService: TimerService,
  log: ReturnType<typeof createLogger>,
  sessionId: string,
  currentNodeId: string
): boolean {
  if (event.type !== "timeout") return false;

  const timerId = event.payload.timerId;
  // Skip staleness check if edgeId is provided in payload (from BullMQ job data)
  const payloadEdgeId = event.payload.edgeId;

  if (timerId && !timerService.getEdgeForTimer(timerId) && !payloadEdgeId) {
    log.debug({ timerId, sessionId, currentNodeId }, "router:staleTimeoutIgnored");
    return true;
  }

  return false;
}

/**
 * Check if timeout is a plugin follow-up and handle it
 *
 * Plugin follow-ups use edgeId format: "followup-plugin:{pluginId}:{stepIndex}"
 * Returns true if the event was handled (should stop further processing)
 */
export async function handlePluginFollowUpTimeout(
  event: JourneyEvent,
  timerService: TimerService,
  callbacks: PluginTimeoutCallbacks,
  log: ReturnType<typeof createLogger>
): Promise<{ handled: boolean }> {
  if (event.type !== "timeout") {
    return { handled: false };
  }

  const timerId = event.payload.timerId;
  if (!timerId || !timerService.hasPluginFollowUp(timerId)) {
    return { handled: false };
  }

  const context = timerService.getPluginFollowUpContext(timerId);
  if (!context) {
    return { handled: false };
  }

  log.debug(
    { timerId, pluginId: context.pluginId, parentNodeId: context.parentNodeId, stepIndex: context.stepIndex },
    "router:pluginFollowUpTimeout:detected"
  );

  // Delegate to plugin handler via callback
  if (callbacks.onPluginTimeout) {
    const result = await callbacks.onPluginTimeout(timerId);

    // Handle transition if plugin wants to exit sequence
    if (result.action === "transition") {
      log.info(
        { timerId, targetNodeId: result.targetNodeId, trigger: result.trigger },
        "router:pluginFollowUpTimeout:transition"
      );
      // Cancel remaining follow-ups from the source node before transitioning
      // This ensures follow-ups don't fire after user has moved to exit path
      if (timerService.shouldCancelPluginFollowUpsOnResponse(context.parentNodeId)) {
        await timerService.cancelPluginFollowUpsForNode(context.parentNodeId);
      }
      await callbacks.onTransition(result.targetNodeId, result.trigger);
    }
  }

  // Mark timer as fired to prevent stale detection
  timerService.markPluginFollowUpFired(timerId);

  return { handled: true };
}
