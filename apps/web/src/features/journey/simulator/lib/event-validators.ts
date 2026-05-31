/**
 * Event Validators
 *
 * Type guards for validating SSE event payloads at the network boundary.
 * Ensures type safety when processing events from the backend.
 *
 * @module features/simulator/lib/event-validators
 */

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

/**
 * Payload for simulator.timer_scheduled events.
 * Contains information about a newly scheduled timer edge.
 */
export interface TimerScheduledPayload {
  edgeId: string;
  durationMs: number;
}

/**
 * Payload for simulator.timer_fired events.
 * Contains information about a timer that has completed.
 */
export interface TimerFiredPayload {
  edgeId: string;
  scheduledAt: string;
}

/**
 * Payload for simulator.timer_cancelled events.
 * Contains information about a cancelled timer.
 */
export interface TimerCancelledPayload {
  timerId: string;
  edgeId: string;
}

/**
 * Payload for system.message events.
 * Contains bot message content to display in chat.
 */
export interface MessagePayload {
  content: string;
  buttons?: Array<{ id: string; label: string }>;
  media?: { type: "image" | "video"; url: string };
}

/**
 * Payload for engine.transition events.
 * Contains information about node transitions.
 *
 * Note: buttonId is only present when trigger is "button_click".
 * For message/timeout triggers, buttonId will be undefined.
 */
export interface TransitionPayload {
  from: string;
  to: string;
  trigger?: string;
  /** Button ID (only present for button_click triggers, undefined otherwise) */
  buttonId?: string;
}

/**
 * Generic event payload for interaction events.
 * Contains optional nodeId for context.
 */
export interface InteractionPayload {
  nodeId?: string;
  [key: string]: unknown;
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Base check that payload is a non-null object.
 * DRYs up the common null/object type checking in validators.
 */
function isPayloadObject(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null;
}

/**
 * Base validation utility for payload type guards.
 *
 * Handles the common pattern:
 * 1. Check payload is non-null object
 * 2. Cast to Record<string, unknown>
 * 3. Run custom field validation
 *
 * @param payload - Unknown payload to validate
 * @param validator - Function to validate specific fields
 * @returns Type predicate for the target type
 */
function validatePayload<T>(
  payload: unknown,
  validator: (p: Record<string, unknown>) => boolean
): payload is T {
  return isPayloadObject(payload) && validator(payload);
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for TimerScheduledPayload.
 * Validates that payload contains required edgeId (string) and durationMs (number).
 */
export function isTimerScheduledPayload(payload: unknown): payload is TimerScheduledPayload {
  return validatePayload<TimerScheduledPayload>(payload, (p) =>
    typeof p.edgeId === "string" &&
    p.edgeId.length > 0 &&
    typeof p.durationMs === "number" &&
    p.durationMs >= 0
  );
}

/**
 * Type guard for TimerFiredPayload.
 * Validates that payload contains required edgeId (string) and scheduledAt (string).
 */
export function isTimerFiredPayload(payload: unknown): payload is TimerFiredPayload {
  return validatePayload<TimerFiredPayload>(payload, (p) =>
    typeof p.edgeId === "string" &&
    p.edgeId.length > 0 &&
    typeof p.scheduledAt === "string" &&
    p.scheduledAt.length > 0
  );
}

/**
 * Type guard for TimerCancelledPayload.
 * Validates that payload contains required timerId (string) and edgeId (string).
 */
export function isTimerCancelledPayload(payload: unknown): payload is TimerCancelledPayload {
  return validatePayload<TimerCancelledPayload>(payload, (p) =>
    typeof p.timerId === "string" &&
    p.timerId.length > 0 &&
    typeof p.edgeId === "string" &&
    p.edgeId.length > 0
  );
}

/**
 * Type guard for MessagePayload.
 * Validates that payload is an object with at least one message-related field:
 * content (string), buttons (array), or media (object with type and url).
 */
export function isMessagePayload(payload: unknown): payload is MessagePayload {
  if (!isPayloadObject(payload)) {
    return false;
  }

  const hasContent = typeof payload.content === "string";
  if (!hasContent) {
    return false;
  }

  const hasButtons = payload.buttons === undefined || Array.isArray(payload.buttons);
  const hasMedia =
    payload.media === undefined ||
    (isPayloadObject(payload.media) &&
      typeof (payload.media as Record<string, unknown>).type === "string" &&
      typeof (payload.media as Record<string, unknown>).url === "string");

  return hasButtons && hasMedia;
}

/**
 * Type guard for TransitionPayload.
 * Validates that payload contains required from and to strings.
 */
export function isTransitionPayload(payload: unknown): payload is TransitionPayload {
  return validatePayload<TransitionPayload>(payload, (p) =>
    typeof p.from === "string" &&
    p.from.length > 0 &&
    typeof p.to === "string" &&
    p.to.length > 0
  );
}

/**
 * Type guard for InteractionPayload.
 * Validates that payload is an object with optional nodeId.
 */
export function isInteractionPayload(payload: unknown): payload is InteractionPayload {
  return isPayloadObject(payload);
}

/**
 * Extract nodeId from payload safely.
 * Returns the nodeId if it's a valid string, otherwise returns fallback.
 */
export function getNodeIdFromPayload(payload: unknown, fallback: string = ""): string {
  if (!isPayloadObject(payload)) {
    return fallback;
  }
  return typeof payload.nodeId === "string" ? payload.nodeId : fallback;
}

/**
 * Extract target node ID from transition payload safely.
 * Returns the "to" field if it's a valid string, otherwise returns null.
 * Used by event handlers to avoid `as` type assertions.
 */
export function extractTargetNodeId(payload: unknown): string | null {
  if (!isPayloadObject(payload)) {
    return null;
  }
  const to = payload.to;
  return typeof to === "string" ? to : null;
}

/**
 * Type guard for a valid SimulatorEvent structure.
 * Validates that the object has all required event fields.
 */
export interface SimulatorEvent {
  type: string;
  sessionId: string;
  timestamp: string;
  payload: Record<string, unknown>;
  _debug?: Record<string, unknown>;
}

export function isValidSimulatorEvent(event: unknown): event is SimulatorEvent {
  return (
    isPayloadObject(event) &&
    typeof (event as Record<string, unknown>).type === "string" &&
    typeof (event as Record<string, unknown>).sessionId === "string" &&
    typeof (event as Record<string, unknown>).timestamp === "string" &&
    isPayloadObject((event as Record<string, unknown>).payload)
  );
}
