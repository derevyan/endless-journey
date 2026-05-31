/**
 * User Response Module
 *
 * Handles storage and logging of user responses (messages, button clicks).
 * Extracted from EventRouter to follow Single Responsibility Principle.
 *
 * Responsibilities:
 * - Store user responses in session context
 * - Log user actions for audit trail
 * - Validate if event type is accepted by node's response type
 */

import type { createLogger } from "@journey/logger";
import { createLogger as createLog } from "@journey/logger";
import {
  EventTypes,
  type ActiveButtonSnapshot,
  type ButtonClickOutcome,
  type ButtonConfig,
  type EnhancedUserJourney,
  type JourneyNodeData,
  type MessageNodeData,
} from "@journey/schemas";
import type { SessionStateManager } from "../state/session-state-manager";
import type { EventLogger, JourneyEvent } from "../types";

// Module-level logger for debugging button click issues
const moduleLog = createLog("engine:user-response");

// =============================================================================
// TYPES
// =============================================================================

export interface UserResponseConfig {
  stateManager: SessionStateManager;
  log: ReturnType<typeof createLogger>;
}

/**
 * Click outcome information for logging.
 * Passed from event-router after resolving button click target.
 */
export interface ClickOutcomeInfo {
  /** Outcome of the click resolution */
  outcome: ButtonClickOutcome;
  /** Snapshot of active buttons at click time */
  activeButtonsAtClick?: ActiveButtonSnapshot[];
  /** Reason for outcome (especially if failed) */
  failureReason?: string;
  /** Target node ID if transition will happen */
  transitionedToNodeId?: string;
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Store user response in session context
 * - Always stores in context.userResponse
 * - Also stores in custom variable if node has storeResponseAs configured
 */
export function storeUserResponse(
  config: UserResponseConfig,
  event: JourneyEvent,
  currentNode: JourneyNodeData
): void {
  const { stateManager, log } = config;

  // Only store for user actions (message or button click)
  if (event.type !== "message" && event.type !== "button_click") return;

  // Build the response object (includes inputType for voice/text detection in conditions)
  const userResponse =
    event.type === "message"
      ? { type: "text" as const, value: event.payload.text || "", inputType: event.payload.inputType || "text" }
      : { type: "button" as const, value: event.payload.buttonId || "" };

  // Store in context.userResponse (always)
  stateManager.updateContext({ userResponse });

  // Check if node has storeResponseAs configured (for message nodes)
  const nodeData = currentNode.data;
  if ("storeResponseAs" in nodeData && nodeData.storeResponseAs && typeof nodeData.storeResponseAs === "string") {
    // Store in custom variable as well
    stateManager.updateContext({ [nodeData.storeResponseAs]: userResponse.value });
    log.debug(
      { nodeId: currentNode.id, storeAs: nodeData.storeResponseAs, value: userResponse.value },
      "engine:storedUserResponse"
    );
  }

  // NOTE: activeButtons is cleared in handle() after findTargetNode() completes
  // This ensures button routing works before clearing

  log.debug({ nodeId: currentNode.id, responseType: userResponse.type, value: userResponse.value }, "engine:userResponse");
}

/**
 * Log user action event for audit trail
 *
 * @param eventLogger - Event logger instance
 * @param event - The journey event
 * @param currentNode - Current node data
 * @param session - Enhanced user journey session
 * @param clickOutcomeInfo - Optional click outcome info (for button clicks, after resolution)
 */
export function logUserAction(
  eventLogger: EventLogger,
  event: JourneyEvent,
  currentNode: JourneyNodeData,
  session: EnhancedUserJourney,
  clickOutcomeInfo?: ClickOutcomeInfo
): void {
  const nodeId = currentNode.id;

  if (event.type === "message") {
    eventLogger.logEvent({
      type: EventTypes.USER_MESSAGE,
      nodeId,
      payload: {
        text: event.payload.text || "",
        inputType: event.payload.inputType, // Preserve voice vs text origin
      },
    });
  } else if (event.type === "button_click") {
    const buttonId = event.payload.buttonId || "";

    // Look up button label - prefer activeButtons, fallback to node data
    const activeButton = session.activeButtons?.find((btn) => btn.id === buttonId);
    const nodeData = currentNode.data as MessageNodeData;
    const buttons = nodeData.buttons as ButtonConfig[] | undefined;
    const clickedButton = buttons?.find((btn) => btn.id === buttonId);
    const buttonLabel = activeButton?.text ?? clickedButton?.text ?? buttonId;

    // Debug: Trace button label lookup for diagnosing "ai-reply-X" filter issues
    moduleLog.info(
      {
        buttonId,
        hasActiveButtons: !!session.activeButtons,
        activeButtonCount: session.activeButtons?.length,
        activeButtonIds: session.activeButtons?.map((b) => b.id),
        foundActiveButton: !!activeButton,
        activeButtonText: activeButton?.text,
        foundNodeButton: !!clickedButton,
        nodeButtonText: clickedButton?.text,
        resolvedLabel: buttonLabel,
      },
      "userResponse:buttonClick:labelLookup"
    );

    // Build payload with optional click outcome info for debugging
    const payload: Record<string, unknown> = { buttonId, buttonLabel };

    if (clickOutcomeInfo) {
      payload.outcome = clickOutcomeInfo.outcome;
      if (clickOutcomeInfo.activeButtonsAtClick) {
        payload.activeButtonsAtClick = clickOutcomeInfo.activeButtonsAtClick;
      }
      if (clickOutcomeInfo.failureReason) {
        payload.failureReason = clickOutcomeInfo.failureReason;
      }
      if (clickOutcomeInfo.transitionedToNodeId) {
        payload.transitionedToNodeId = clickOutcomeInfo.transitionedToNodeId;
      }
    }

    eventLogger.logEvent({
      type: EventTypes.USER_CLICK,
      nodeId,
      payload,
    });
  } else if (event.type === "timeout") {
    eventLogger.logEvent({
      type: EventTypes.TIMER_EXPIRED,
      nodeId,
      payload: {
        timerId: event.payload.timerId || "",
        durationMs: event.payload.durationMs,
      },
    });
  }
}

/**
 * Check if an event type is accepted by a node's response type
 *
 * @param eventType - The type of event (message, button_click, timeout)
 * @param responseType - The node's expected response type
 * @returns true if the response should be stored, false otherwise
 */
export function isResponseAccepted(eventType: JourneyEvent["type"], responseType: string): boolean {
  // Timeouts are not user responses, don't store
  if (eventType === "timeout") return false;

  // Button clicks are always accepted (for routing)
  if (eventType === "button_click") return true;

  // Text messages:
  // - "text" or "any" accepts messages
  // - "buttons" only accepts button clicks, reject text
  // - "auto" doesn't wait for input, but we still store if received
  if (eventType === "message") {
    return responseType !== "buttons";
  }

  return false;
}
