/**
 * Event Handlers
 *
 * Pure, testable functions for processing SSE events.
 * Returns state change commands instead of directly mutating state.
 * Enables comprehensive unit testing without store mocking.
 *
 * @module features/simulator/lib/event-handlers
 */

import { createLogger } from "@journey/logger";
import type { InteractionEvent, SimulatorDebugState } from "@journey/schemas";

import { parseStructuredOutput } from "@/shared/lib/utils/parse-structured-output";
import { createEventId } from "./event-utils";
import {
  isTimerScheduledPayload,
  isMessagePayload,
  getNodeIdFromPayload,
  extractTargetNodeId,
  type MessagePayload,
  type TimerScheduledPayload,
} from "./event-validators";
import { SimulatorEventType, SystemEventType } from "../types/event-types";

const log = createLogger("event-handlers");

// =============================================================================
// TYPES
// =============================================================================

/**
 * State change command (Command pattern)
 * Handlers return these instead of directly mutating state
 */
export interface StateChange {
  type: "set_timer" | "clear_timer" | "update_session" | "add_event" | "add_message";
  payload: unknown;
}

/**
 * Event handler function signature
 * Pure function: event -> StateChange[]
 */
export type EventHandler = (event: SimulatorEvent) => StateChange[];

/**
 * SSE event structure (minimal interface for handlers)
 */
export interface SimulatorEvent {
  type: string;
  sessionId: string;
  timestamp: string;
  payload: Record<string, unknown>;
  _debug?: SimulatorDebugState;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create an InteractionEvent from a SimulatorEvent
 * Pure function - no side effects
 */
export function createInteractionEvent(event: SimulatorEvent): InteractionEvent {
  return {
    id: createEventId("evt"),
    type: event.type as InteractionEvent["type"],
    nodeId: getNodeIdFromPayload(event.payload, event._debug?.currentNodeId ?? ""),
    timestamp: event.timestamp,
    payload: event.payload,
  };
}

// =============================================================================
// EVENT HANDLERS (Pure Functions)
// =============================================================================

/**
 * Handle timer scheduled event
 * Schedules an active timer in the UI
 */
export function handleTimerScheduled(event: SimulatorEvent): StateChange[] {
  if (!isTimerScheduledPayload(event.payload)) {
    log.warn({ payload: event.payload }, "eventHandlers:invalidTimerPayload");
    return [];
  }

  const payload = event.payload as TimerScheduledPayload;

  return [
    {
      type: "set_timer",
      payload: {
        id: payload.edgeId,
        durationMs: payload.durationMs,
        startTime: Date.now(),
      },
    },
  ];
}

/**
 * Handle timer fired event
 * Clears the active timer after it fires
 */
export function handleTimerFired(_event: SimulatorEvent): StateChange[] {
  // No validation needed - just clear the timer
  return [
    {
      type: "clear_timer",
      payload: null,
    },
  ];
}

/**
 * Handle timer cancelled event
 * Clears the active timer if it was cancelled
 */
export function handleTimerCancelled(_event: SimulatorEvent): StateChange[] {
  // No validation needed - just clear the timer
  return [
    {
      type: "clear_timer",
      payload: null,
    },
  ];
}

/**
 * Handle node transition event
 * Adds transition to event log AND syncs session.currentNodeId
 * This is the fix for the highlighting bug - keeps session state in sync
 */
export function handleTransition(event: SimulatorEvent): StateChange[] {
  const changes: StateChange[] = [];

  // Always add to event log
  changes.push({
    type: "add_event",
    payload: createInteractionEvent(event),
  });

  // Sync session.currentNodeId with backend (fixes highlighting bug ✅)
  const targetNodeId = extractTargetNodeId(event.payload);
  if (targetNodeId) {
    changes.push({
      type: "update_session",
      payload: {
        currentNodeId: targetNodeId,
        updatedAt: event.timestamp,
      },
    });
    log.debug(
      { from: event.payload?.from, to: targetNodeId },
      "eventHandlers:transitionSynced"
    );
  } else {
    log.warn({ payload: event.payload }, "eventHandlers:invalidTransitionPayload");
  }

  return changes;
}

/**
 * Handle bot message event
 * Adds to event log and to chat messages if there's content/buttons/media
 */
export function handleMessage(event: SimulatorEvent): StateChange[] {
  if (!isMessagePayload(event.payload)) {
    log.warn({ payload: event.payload }, "eventHandlers:invalidMessagePayload");
    return [];
  }

  const changes: StateChange[] = [];
  const msgPayload = event.payload as MessagePayload;

  // Always add to event log
  changes.push({
    type: "add_event",
    payload: createInteractionEvent(event),
  });

  // Add to chat messages if there's content
  const { content, buttons, media } = msgPayload;
  if (content || buttons || media) {
    // Parse structured output (e.g., {"response":"text","buttons":[...]})
    // to extract just the response text for display
    const parsed = parseStructuredOutput(content || "");
    const displayContent = parsed.text;
    // Merge buttons: prefer explicit buttons from payload, fallback to parsed buttons
    const displayButtons = buttons ?? parsed.buttons;

    changes.push({
      type: "add_message",
      payload: {
        message: {
          type: media ? "media" : displayButtons?.length ? "buttons" : "text",
          content: displayContent,
          buttons: displayButtons,
          media,
        },
        from: "bot",
      },
    });
  }

  return changes;
}

/**
 * Handle generic loggable events
 * For all events that should be logged to the event log but have no special handling
 */
export function handleGenericEvent(event: SimulatorEvent): StateChange[] {
  return [
    {
      type: "add_event",
      payload: createInteractionEvent(event),
    },
  ];
}

// =============================================================================
// HANDLER REGISTRY
// =============================================================================

/**
 * Event handler mapping
 * Maps event types to their handler functions
 * Used by event processor to route events
 */
export const EVENT_HANDLERS: Record<string, EventHandler> = {
  [SimulatorEventType.TIMER_SCHEDULED]: handleTimerScheduled,
  [SimulatorEventType.TIMER_FIRED]: handleTimerFired,
  [SimulatorEventType.TIMER_CANCELLED]: handleTimerCancelled,
  "engine.transition": handleTransition,
  [SystemEventType.MESSAGE]: handleMessage,
};
