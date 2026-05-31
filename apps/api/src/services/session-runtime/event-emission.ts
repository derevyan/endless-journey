/**
 * Session Event Emission
 *
 * Centralized event emission for session lifecycle events.
 * Consolidates duplicated event publishing logic from various handlers.
 *
 * @module services/session-runtime/event-emission
 */

import { createLogger, serializeError } from "@journey/logger";
import { EventTypes } from "@journey/schemas";
import { createEvent, publishEvent } from "../../event-bus/event-bus";
import type { SessionEventContext } from "./types";

const log = createLogger("session-runtime:events");

// =============================================================================
// SESSION LIFECYCLE EVENTS
// =============================================================================

/**
 * Emit session started event
 *
 * Called when a new session is successfully started.
 */
export async function emitSessionStarted(context: SessionEventContext): Promise<void> {
  const { organizationId, clientId, sessionId, journeyId, channelId, source = "journey", journeyName, startNodeId } = context;

  // Map source to valid event source type
  const eventSource = mapToValidSource(source);

  try {
    const payload = {
      sessionId,
      ...(journeyName ? { journeyName } : {}),
      ...(startNodeId ? { startNodeId } : {}),
      ...(channelId ? { channelId } : {}),
    };

    const event = await createEvent(
      EventTypes.JOURNEY_SESSION_STARTED,
      organizationId,
      payload,
      { clientId, sessionId, journeyId, source: eventSource }
    );
    await publishEvent(event);

    log.debug({ sessionId, journeyId, source: eventSource }, "sessionRuntime:sessionStarted:emitted");
  } catch (error) {
    // Log but don't throw - event emission shouldn't break session flow
    log.warn({ err: serializeError(error), sessionId }, "sessionRuntime:sessionStarted:failed");
  }
}

/**
 * Emit session completed event
 *
 * Called when a session reaches a terminal state (completed).
 * Note: "dropped" status uses the same event type with status in payload.
 */
export async function emitSessionCompleted(
  context: SessionEventContext,
  status: "completed" | "dropped"
): Promise<void> {
  const { organizationId, clientId, sessionId, journeyId, channelId, source = "journey", journeyName, finalNodeId } = context;

  // Map source to valid event source type
  const eventSource = mapToValidSource(source);

  try {
    // Both completed and dropped use the same event type
    const payload = {
      sessionId,
      completionStatus: status,
      ...(journeyName ? { journeyName } : {}),
      ...(finalNodeId ? { finalNodeId } : {}),
      ...(channelId ? { channelId } : {}),
    };

    const event = await createEvent(
      EventTypes.JOURNEY_SESSION_COMPLETED,
      organizationId,
      payload,
      { clientId, sessionId, journeyId, source: eventSource }
    );
    await publishEvent(event);

    log.debug({ sessionId, journeyId, status, source: eventSource }, "sessionRuntime:sessionCompleted:emitted");
  } catch (error) {
    log.warn({ err: serializeError(error), sessionId, status }, "sessionRuntime:sessionCompleted:failed");
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map session source to valid event source type
 *
 * The event system has a specific set of allowed sources.
 * This maps runtime sources to valid event sources.
 */
function mapToValidSource(source: string): "journey" | "webhook" | "system" | "manual" | "crm" | "automation" {
  switch (source) {
    case "webhook":
      return "webhook";
    case "automation":
      return "automation";
    case "timer":
    case "teleport":
    case "simulator":
      return "system";
    case "journey":
    default:
      return "journey";
  }
}
