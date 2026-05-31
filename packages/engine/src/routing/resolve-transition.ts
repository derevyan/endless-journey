/**
 * Unified Transition Resolution
 *
 * Provides a single source of truth for routing logic used by EventRouter and handlers.
 * Consolidates button matching, message routing, and guard evaluation patterns.
 *
 * Key benefits:
 * - Single implementation prevents routing behavior divergence
 * - Auto context selection avoids unnecessary async operations
 * - Clear separation between event types while sharing guard logic
 */

import type { JourneyEdgeData, JourneyNodeData, ButtonConfig, ResponseType } from "@journey/schemas";
import type { ExecutionContext } from "../types";
import { EdgeSelector } from "../services/edge-selector";
import {
  getMatchingButtonEdges,
  getMatchingButtonEdgesFromConfig,
  checkButtonGuards,
  getEffectiveResponseType,
  getNodeResponseType,
} from "../utils/routing-utils";
import { isTimerEdge } from "../utils/edge-utils";
import type { GuardContext, GuardRequirements } from "../utils/guard-utils";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of transition resolution
 */
export interface TransitionResult {
  /** Target node ID (null if no route found) */
  targetNodeId: string | null;
  /** Reason for the routing decision */
  reason: TransitionReason;
  /** Edge ID that was matched (if applicable) */
  matchedEdgeId?: string;
  /** Button ID that was matched (if applicable) */
  matchedButtonId?: string;
}

/**
 * Reason for the routing decision
 */
export type TransitionReason =
  | "button_guard_pass"  // Button click with passing guard
  | "button_fallback"    // Button fallback edge used
  | "message_guard_pass" // Text message with passing guard
  | "message_fallback"   // Message fallback edge used
  | "timeout"            // Timer edge matched
  | "timeout_fallback"   // Timer fallback used
  | "guard_blocked"      // Explicit target blocked by guard
  | "no_match";          // No route found

/**
 * Active button info from session state
 */
export interface ActiveButtonInfo {
  id: string;
  text: string;
  targetNodeId: string;
  source: "node" | "plugin";
}

/**
 * Options for transition resolution
 */
export interface TransitionOptions {
  /** Pre-computed passable edge IDs (from guard evaluation) */
  passableEdgeIds: Set<string>;
  /** Pre-computed passable edges */
  passableEdges: JourneyEdgeData[];
  /** Guard context used for evaluation */
  guardContext: GuardContext;
  /** Active buttons from session (for button_click events) */
  activeButtons?: ActiveButtonInfo[];
  /** Timer-to-edge mapping (for timeout events) */
  timerEdgeMap?: Map<string, string>;
  /** Logger for debug output */
  log?: { debug: (obj?: Record<string, unknown> | string, msg?: string) => void };
}

// =============================================================================
// BUTTON ROUTING
// =============================================================================

/**
 * Resolve button click to target node
 *
 * Two-phase lookup:
 * 1. Check active buttons (dynamically set by handlers/plugins)
 * 2. Fall back to static buttons in node config
 *
 * @param buttonId - Clicked button ID
 * @param currentNode - Current node (for static button fallback)
 * @param outgoingEdges - All outgoing edges
 * @param options - Routing options with pre-computed guards
 * @returns Transition result
 */
export function resolveButtonClick(
  buttonId: string,
  currentNode: JourneyNodeData,
  outgoingEdges: JourneyEdgeData[],
  options: TransitionOptions
): TransitionResult {
  const { passableEdgeIds, passableEdges, activeButtons, log } = options;

  // Phase 1: Check active buttons (source of truth for currently displayed buttons)
  const activeButton = activeButtons?.find((btn) => btn.id === buttonId);
  if (activeButton?.targetNodeId) {
    // Validate against guards
    if (checkButtonGuards(buttonId, activeButton.targetNodeId, outgoingEdges, passableEdgeIds)) {
      log?.debug({ buttonId, targetNodeId: activeButton.targetNodeId }, "routing:buttonActiveMatch");
      return {
        targetNodeId: activeButton.targetNodeId,
        reason: "button_guard_pass",
        matchedButtonId: buttonId,
      };
    }
    // Guard blocked - try fallback later
    log?.debug({ buttonId, targetNodeId: activeButton.targetNodeId }, "routing:buttonGuardBlocked");
  }

  // Phase 2: Check static buttons in node config
  const nodeData = currentNode.data as { buttons?: ButtonConfig[] };
  const staticButton = nodeData.buttons?.find((btn) => btn.id === buttonId);
  if (staticButton?.targetNodeId) {
    if (checkButtonGuards(buttonId, staticButton.targetNodeId, outgoingEdges, passableEdgeIds)) {
      log?.debug({ buttonId, targetNodeId: staticButton.targetNodeId }, "routing:buttonStaticMatch");
      return {
        targetNodeId: staticButton.targetNodeId,
        reason: "button_guard_pass",
        matchedButtonId: buttonId,
      };
    }
    log?.debug({ buttonId, targetNodeId: staticButton.targetNodeId }, "routing:buttonStaticGuardBlocked");
  }

  // Phase 3: Try fallback if exactly one non-timer passable edge exists
  const nonTimerPassable = passableEdges.filter((e) => !isTimerEdge(e));
  if (nonTimerPassable.length === 1) {
    const fallbackEdge = nonTimerPassable[0];
    log?.debug({ buttonId, fallbackEdgeId: fallbackEdge.id }, "routing:buttonFallback");
    return {
      targetNodeId: fallbackEdge.target,
      reason: "button_fallback",
      matchedEdgeId: fallbackEdge.id,
      matchedButtonId: buttonId,
    };
  }

  return { targetNodeId: null, reason: "no_match" };
}

// =============================================================================
// MESSAGE ROUTING
// =============================================================================

/**
 * Resolve text message to target node
 *
 * Only routes if node accepts text input (responseType: "text" or "any").
 * Uses first passable default edge.
 *
 * @param currentNode - Current node
 * @param outgoingEdges - All outgoing edges
 * @param options - Routing options with pre-computed guards
 * @returns Transition result
 */
export function resolveMessage(
  currentNode: JourneyNodeData,
  outgoingEdges: JourneyEdgeData[],
  options: TransitionOptions
): TransitionResult {
  const { passableEdges, log } = options;
  const responseType = getNodeResponseType(currentNode);

  // Only route text if node accepts text input
  if (responseType !== "text" && responseType !== "any") {
    log?.debug({ responseType }, "routing:messageNotAccepted");
    return { targetNodeId: null, reason: "no_match" };
  }

  // Find first passable default edge (non-timer)
  for (const edge of passableEdges) {
    if (!isTimerEdge(edge) && edge.edgeType === "default") {
      log?.debug({ edgeId: edge.id, target: edge.target }, "routing:messageMatch");
      return {
        targetNodeId: edge.target,
        reason: "message_guard_pass",
        matchedEdgeId: edge.id,
      };
    }
  }

  // Try fallback
  const nonTimerPassable = passableEdges.filter((e) => !isTimerEdge(e));
  if (nonTimerPassable.length === 1) {
    const fallbackEdge = nonTimerPassable[0];
    log?.debug({ fallbackEdgeId: fallbackEdge.id }, "routing:messageFallback");
    return {
      targetNodeId: fallbackEdge.target,
      reason: "message_fallback",
      matchedEdgeId: fallbackEdge.id,
    };
  }

  return { targetNodeId: null, reason: "no_match" };
}

// =============================================================================
// TIMEOUT ROUTING
// =============================================================================

/**
 * Resolve timeout to target node
 *
 * Uses timer-to-edge mapping if available, otherwise finds first passable timer edge.
 *
 * @param timerId - Timer ID that fired
 * @param outgoingEdges - All outgoing edges
 * @param options - Routing options with pre-computed guards
 * @returns Transition result
 */
export function resolveTimeout(
  timerId: string,
  outgoingEdges: JourneyEdgeData[],
  options: TransitionOptions
): TransitionResult {
  const { passableEdges, timerEdgeMap, log } = options;

  // Try mapped edge first
  const mappedEdgeId = timerEdgeMap?.get(timerId);
  if (mappedEdgeId) {
    const mappedEdge = outgoingEdges.find((e) => e.id === mappedEdgeId);
    if (mappedEdge) {
      log?.debug({ timerId, edgeId: mappedEdgeId, target: mappedEdge.target }, "routing:timeoutMapped");
      return {
        targetNodeId: mappedEdge.target,
        reason: "timeout",
        matchedEdgeId: mappedEdgeId,
      };
    }
  }

  // Find first passable timer edge
  for (const edge of passableEdges) {
    if (isTimerEdge(edge)) {
      log?.debug({ timerId, edgeId: edge.id, target: edge.target }, "routing:timeoutMatch");
      return {
        targetNodeId: edge.target,
        reason: "timeout",
        matchedEdgeId: edge.id,
      };
    }
  }

  // Timer fallback - use any passable timer edge from original edges
  const timerEdges = outgoingEdges.filter(isTimerEdge);
  if (timerEdges.length === 1) {
    const fallbackEdge = timerEdges[0];
    log?.debug({ timerId, fallbackEdgeId: fallbackEdge.id }, "routing:timeoutFallback");
    return {
      targetNodeId: fallbackEdge.target,
      reason: "timeout_fallback",
      matchedEdgeId: fallbackEdge.id,
    };
  }

  return { targetNodeId: null, reason: "no_match" };
}

// =============================================================================
// BUTTON FILTERING (for handlers)
// =============================================================================

/**
 * Filter buttons that can be displayed based on guard evaluation
 *
 * Used by MessageHandler to only show buttons whose edges pass guards.
 * This prevents showing buttons that would lead to blocked routes.
 *
 * @param buttons - Button configs from node
 * @param outgoingEdges - All outgoing edges
 * @param passableEdgeIds - Set of edge IDs that passed guards
 * @returns Buttons that can be routed
 */
export function filterRoutableButtons(
  buttons: ButtonConfig[],
  outgoingEdges: JourneyEdgeData[],
  passableEdgeIds: Set<string>
): ButtonConfig[] {
  return buttons.filter((button) => {
    const matches = getMatchingButtonEdgesFromConfig(outgoingEdges, button);
    // Include button if no edges found (defensive) or if any edge passes guards
    if (matches.length === 0) return true;
    return matches.some((edge) => passableEdgeIds.has(edge.id));
  });
}

// =============================================================================
// CONVENIENCE HELPERS
// =============================================================================

/**
 * Build transition options with auto context selection
 *
 * Analyzes guards to determine if basic or full context is needed,
 * then builds the EdgeSelector and returns ready-to-use options.
 *
 * @param context - Execution context
 * @param outgoingEdges - Edges to analyze and filter
 * @param activeButtons - Optional active buttons from session
 * @returns Promise resolving to transition options
 */
export async function buildTransitionOptions(
  context: ExecutionContext,
  outgoingEdges: JourneyEdgeData[],
  activeButtons?: ActiveButtonInfo[]
): Promise<TransitionOptions> {
  // Use auto context selection for optimal performance
  const selector = await EdgeSelector.from(context).withAutoContext(outgoingEdges);
  const { passableEdges, passableEdgeIds, guardContext } = selector.selectTwoPhase(outgoingEdges);

  return {
    passableEdgeIds,
    passableEdges,
    guardContext,
    activeButtons,
    log: context.log,
  };
}

// Re-export response type helpers for convenience
export { getEffectiveResponseType, getNodeResponseType };
