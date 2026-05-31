/**
 * Target Resolver Module
 *
 * Determines the target node for incoming events.
 * Extracted from EventRouter to follow Single Responsibility Principle.
 *
 * Handles routing for three event types:
 * - Button clicks: activeButtons lookup → node data lookup → fallback
 * - Timeouts: edgeId lookup → timer edge fallback
 * - Messages: guard evaluation → fallback
 */

import type { createLogger } from "@journey/logger";
import {
  type ButtonConfig,
  type EnhancedUserJourney,
  type JourneyEdgeData,
  type JourneyNodeData,
  type MessageNodeData,
} from "@journey/schemas";
import type { SessionStateManager } from "../state/session-state-manager";
import type { EngineServices, EventLogger, ExecutionContext, JourneyEvent, TimerService } from "../types";
import {
  checkButtonGuards,
  createStateMethods,
  evaluateGuard,
  getNodeResponseType,
  isTimerEdge,
  type GuardContext,
} from "../utils";
import { EdgeSelector } from "../services/edge-selector";
import type { GuardContextClientData } from "./guard-context-builder";

// =============================================================================
// TYPES
// =============================================================================

export interface TargetResolverConfig {
  session: EnhancedUserJourney;
  timerService: TimerService;
  stateManager: SessionStateManager;
  log: ReturnType<typeof createLogger>;
  eventLogger: EventLogger;
}

export interface TargetResolverCallbacks {
  getClientData?: () => GuardContextClientData | undefined;
  getServices?: () => EngineServices;
}

/**
 * Outcome of target node resolution for button clicks.
 * Used for debugging and AI reports.
 */
export type ButtonClickResolveOutcome =
  | "transition_success"    // Found target and will transition
  | "agent_reexecute"       // Agent will re-execute (no transition)
  | "button_not_found"      // Button ID not in activeButtons or node data
  | "edge_not_found"        // Button found but no edge for it
  | "guard_blocked"         // Guard blocked the transition
  | "error"                 // Error during resolution
  | "no_handler";           // No handler for this button type

/**
 * Detailed result from findTargetNode for button click events.
 * Provides debugging information about what happened.
 */
export interface ButtonClickResolveResult {
  /** Target node ID if found, null otherwise */
  targetNodeId: string | null;
  /** Outcome of the resolution */
  outcome: ButtonClickResolveOutcome;
  /** Human-readable reason for the outcome */
  reason?: string;
  /** Whether the button was found in activeButtons or node data */
  buttonFound: boolean;
  /** Source of the button if found */
  buttonSource?: "activeButtons" | "nodeData";
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Build execution context for EdgeSelector
 */
function buildExecutionContext(
  config: TargetResolverConfig,
  callbacks: TargetResolverCallbacks,
  currentNode: JourneyNodeData,
  outgoingEdges: JourneyEdgeData[]
): ExecutionContext {
  const { session, stateManager, log, eventLogger } = config;
  const { getClientData, getServices } = callbacks;

  const routerClientData = getClientData?.();
  const services = getServices?.() ?? ({
    eventLogger,
  } as unknown as EngineServices);

  return {
    session,
    node: currentNode,
    journey: undefined,
    outgoingEdges,
    services,
    log,
    clientData: routerClientData?.id
      ? { ...routerClientData, id: routerClientData.id, platform: routerClientData.platform ?? "unknown" }
      : undefined,
    stateManager,
    ...createStateMethods(session, currentNode.id, currentNode.data.type, stateManager),
  };
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Find target node for an event
 *
 * @param config - Resolver configuration with session, services
 * @param callbacks - Callbacks for external data
 * @param event - The incoming event
 * @param currentNode - The current node
 * @param outgoingEdges - Edges leaving the current node
 * @param prebuiltGuardContext - Pre-built guard context with full namespaces (vars.*, nodes.*)
 * @returns Target node ID or null if no match
 */
export function findTargetNode(
  config: TargetResolverConfig,
  callbacks: TargetResolverCallbacks,
  event: JourneyEvent,
  currentNode: JourneyNodeData,
  outgoingEdges: JourneyEdgeData[],
  prebuiltGuardContext?: GuardContext
): string | null {
  const { session, timerService, log, stateManager } = config;
  let targetNodeId: string | null = null;
  // Track when a button's explicit target was blocked - prevents fallback to different path
  let explicitTargetBlocked = false;

  // Use EdgeSelector with prebuilt or build limited guard context
  const guardContext = prebuiltGuardContext ?? buildBasicGuardContextFallback(config, callbacks);

  // Build execution context for EdgeSelector
  const executionContext = buildExecutionContext(config, callbacks, currentNode, outgoingEdges);

  // Use EdgeSelector to consolidate two-phase guard filtering (guards → fallback)
  const selector = EdgeSelector.from(executionContext).withPrebuiltContext(guardContext);
  const { passableEdges, passableEdgeIds } = selector.selectTwoPhase(outgoingEdges);

  // Get the node's response type to determine what events it accepts
  const responseType = getNodeResponseType(currentNode);

  // Trace: Log edge matching start
  log.trace(
    {
      eventType: event.type,
      currentNodeId: currentNode.id,
      nodeType: currentNode.data.type,
      responseType,
      outgoingEdgeCount: outgoingEdges.length,
      outgoingEdges: outgoingEdges.map((e) => ({
        id: e.id,
        label: e.label,
        target: e.target,
        edgeType: e.edgeType,
      })),
      buttonId: event.type === "button_click" ? event.payload.buttonId : undefined,
    },
    "router:trace:findTargetStart"
  );

  for (const edge of outgoingEdges) {
    if (event.type === "button_click") {
      const buttonId = event.payload.buttonId || "";

      // === UNIFIED ACTIVE BUTTONS LOOKUP (O(1)) ===
      // Check session.activeButtons - this tracks "currently displayed buttons"
      // Set by message-handler when sending node buttons, or by event-router when sending follow-up buttons
      // Both regular and follow-up buttons use the same routing mechanism
      const activeButton = session.activeButtons?.find((btn) => btn.id === buttonId);
      if (activeButton?.targetNodeId) {
        if (!checkButtonGuards(buttonId, activeButton.targetNodeId, outgoingEdges, passableEdgeIds)) {
          log.debug({ buttonId, targetNodeId: activeButton.targetNodeId }, "router:buttonGuardBlocked");
          explicitTargetBlocked = true;
          break;
        }
        targetNodeId = activeButton.targetNodeId;
        log.debug(
          { buttonId, targetNodeId, source: activeButton.source },
          "router:activeButtonRouted"
        );
        break;
      }

      // === FALLBACK: Direct node data lookup ===
      // This fallback handles cases where activeButtons wasn't populated

      // Get buttons from node data (ButtonConfig[] format)
      const nodeData = currentNode.data as MessageNodeData;
      const buttons = nodeData.buttons as ButtonConfig[] | undefined;

      // Find the button by its ID and use its targetNodeId for routing
      const clickedButton = buttons?.find((btn) => btn.id === buttonId);

      // Trace: Log button click routing
      log.trace(
        {
          buttonId,
          clickedButton: clickedButton
            ? { id: clickedButton.id, text: clickedButton.text, targetNodeId: clickedButton.targetNodeId }
            : null,
          buttonsCount: buttons?.length ?? 0,
          activeButtonsCount: session.activeButtons?.length ?? 0,
        },
        "router:trace:buttonClickRouting"
      );

      // Direct target routing - button routes directly to target node
      if (clickedButton?.targetNodeId) {
        if (!checkButtonGuards(buttonId, clickedButton.targetNodeId, outgoingEdges, passableEdgeIds)) {
          log.debug({ buttonId, targetNodeId: clickedButton.targetNodeId }, "router:buttonGuardBlocked");
          explicitTargetBlocked = true;
          break;
        }
        targetNodeId = clickedButton.targetNodeId;
        log.trace({ targetNodeId, buttonId }, "router:trace:directTargetNodeId");
        break;
      }

      // No match found - will fall through to fallback logic below
    } else if (event.type === "timeout") {
      const timerId = event.payload.timerId || "";
      // Prefer edgeId from payload (BullMQ job data) over timerMap lookup
      // This handles the case where timerMap is empty after fresh engine creation
      const edgeId = event.payload.edgeId || timerService.getEdgeForTimer(timerId);

      // Clean up timer map entry to prevent memory leak
      if (timerId) {
        timerService.markTimerFired(timerId);
      }

      if (edgeId) {
        const matchingEdge = outgoingEdges.find((e) => e.id === edgeId);
        if (matchingEdge) {
          targetNodeId = matchingEdge.target;
          break;
        }
        // Edge ID found but no matching edge - log warning
        log.warn({ timerId, edgeId, nodeId: currentNode.id }, "engine:timeout:edgeNotFound");
      }

      // Fallback: if no mapping, take first passable timer edge (not any edge)
      if (!targetNodeId) {
        const timerEdge = passableEdges.find(isTimerEdge);
        if (timerEdge) {
          targetNodeId = timerEdge.target;
          log.warn({ timerId, edgeId: timerEdge.id, nodeId: currentNode.id }, "engine:timeout:usingFallbackTimerEdge");
        }
      }
    } else if (event.type === "message") {
      // Only accept text messages if the node expects text input
      // responseType: "text" or "any" accepts messages
      // responseType: "buttons" only accepts button clicks (ignore text)
      // responseType: "auto" doesn't wait for input at all
      if (responseType === "text" || responseType === "any") {
        // Check if edge passes guard (Smart Edges feature)
        const edgePassesGuard = !edge.guard || evaluateGuard(edge.guard, guardContext);
        if (edge.edgeType === "default" && edgePassesGuard) {
          targetNodeId = edge.target;
          break;
        }
      } else {
        // For "buttons" responseType, ignore text messages
        log.debug({ nodeId: currentNode.id, responseType, text: event.payload.text }, "engine:textMessageIgnored:buttonNodeExpected");
        return null;
      }
    }
  }

  // Fallback for button clicks - find first passable non-timer edge
  // Skip fallback if button had explicit target that was blocked (no edge exists)
  if (!targetNodeId && event.type === "button_click" && !explicitTargetBlocked) {
    const nodeType = currentNode.data.type;
    // Use passable edges for fallback (already filtered by guards)
    const nonTimerEdges = passableEdges.filter((e) => !isTimerEdge(e));

    // Trace: Log fallback attempt
    log.trace(
      {
        nodeType,
        willUseFallback: nodeType === "message" || nodeType === "start",
        nonTimerEdges: nonTimerEdges.map((e) => ({
          id: e.id,
          label: e.label,
          target: e.target,
        })),
      },
      "router:trace:buttonFallbackAttempt"
    );

    if (nodeType === "message" || nodeType === "start") {
      // STRICTER FALLBACK: Only use fallback if there is exactly one outgoing path.
      // If there are multiple buttons, we must match the label.
      if (nonTimerEdges.length === 1) {
        const actionEdge = nonTimerEdges[0];
        targetNodeId = actionEdge.target;
        log.trace({ edgeId: actionEdge.id, targetNodeId }, "router:trace:buttonFallbackUsed");
        log.debug({ nodeId: currentNode.id, edgeId: actionEdge.id, buttonId: event.payload.buttonId }, "engine:buttonClickFallback");
      } else if (nonTimerEdges.length > 1) {
        log.warn(
          {
            nodeId: currentNode.id,
            buttonId: event.payload.buttonId,
            availableEdges: nonTimerEdges.map((e) => e.label),
          },
          "engine:buttonClickFallback:ambiguous"
        );
      }
    }
  }

  // Fallback for text messages - only for nodes that accept text
  if (!targetNodeId && event.type === "message") {
    if (responseType === "text" || responseType === "any") {
      const nodeType = currentNode.data.type;
      if (nodeType === "message") {
        // Use passable edges for fallback (already filtered by guards)
        const nonTimerEdges = passableEdges.filter((e) => !isTimerEdge(e));

        // STRICTER FALLBACK: Only use fallback if there is exactly one outgoing path.
        if (nonTimerEdges.length === 1) {
          const responseEdge = nonTimerEdges[0];
          targetNodeId = responseEdge.target;
          log.trace({ edgeId: responseEdge.id, targetNodeId }, "router:trace:textFallbackUsed");
          log.debug({ nodeId: currentNode.id, edgeId: responseEdge.id, text: event.payload.text }, "engine:textMessageFallback");
        }
      }
    }
  }

  // Trace: Log final result
  log.trace(
    {
      eventType: event.type,
      currentNodeId: currentNode.id,
      targetNodeId,
      found: !!targetNodeId,
    },
    "router:trace:findTargetResult"
  );

  return targetNodeId;
}

/**
 * Build basic guard context as fallback (when prebuilt context not provided)
 * This is a simplified version that only uses session data
 */
function buildBasicGuardContextFallback(
  config: TargetResolverConfig,
  callbacks: TargetResolverCallbacks
): GuardContext {
  const { session } = config;
  const { getClientData } = callbacks;

  const clientData = getClientData?.();

  // Import the shared utility dynamically to avoid circular dependencies
  const { buildGuardContextFromExecution } = require("../utils");

  return buildGuardContextFromExecution({
    session,
    clientData: clientData
      ? { ...clientData, id: clientData.id ?? session.userId }
      : session.userId
        ? { id: session.userId }
        : undefined,
  });
}

// =============================================================================
// BUTTON CLICK DETAILED RESOLUTION
// =============================================================================

/**
 * Find target node for a button click with detailed outcome information.
 * Returns both the target node ID and debugging information about what happened.
 *
 * This is used for AI execution reports to track button click outcomes.
 */
export function findTargetNodeForButtonClick(
  config: TargetResolverConfig,
  callbacks: TargetResolverCallbacks,
  buttonId: string,
  currentNode: JourneyNodeData,
  outgoingEdges: JourneyEdgeData[],
  prebuiltGuardContext?: GuardContext
): ButtonClickResolveResult {
  const { session, log } = config;

  // Use EdgeSelector with prebuilt or build limited guard context
  const guardContext = prebuiltGuardContext ?? buildBasicGuardContextFallback(config, callbacks);

  // Build execution context for EdgeSelector
  const executionContext = buildExecutionContext(config, callbacks, currentNode, outgoingEdges);

  // Use EdgeSelector to get passable edges
  const selector = EdgeSelector.from(executionContext).withPrebuiltContext(guardContext);
  const { passableEdges, passableEdgeIds } = selector.selectTwoPhase(outgoingEdges);

  // === UNIFIED ACTIVE BUTTONS LOOKUP ===
  const activeButton = session.activeButtons?.find((btn) => btn.id === buttonId);
  if (activeButton?.targetNodeId) {
    // Button found in activeButtons with explicit target
    if (!checkButtonGuards(buttonId, activeButton.targetNodeId, outgoingEdges, passableEdgeIds)) {
      return {
        targetNodeId: null,
        outcome: "guard_blocked",
        reason: `Guard blocked transition from button '${buttonId}' to node '${activeButton.targetNodeId}'`,
        buttonFound: true,
        buttonSource: "activeButtons",
      };
    }
    return {
      targetNodeId: activeButton.targetNodeId,
      outcome: "transition_success",
      buttonFound: true,
      buttonSource: "activeButtons",
    };
  }

  // Check if button is in activeButtons but without targetNodeId (AI quick-reply)
  if (activeButton && !activeButton.targetNodeId) {
    return {
      targetNodeId: null,
      outcome: "agent_reexecute",
      reason: `Button '${buttonId}' is an AI quick-reply button (no targetNodeId) - agent will re-execute`,
      buttonFound: true,
      buttonSource: "activeButtons",
    };
  }

  // === FALLBACK: Direct node data lookup ===
  const nodeData = currentNode.data as MessageNodeData;
  const buttons = nodeData.buttons as ButtonConfig[] | undefined;
  const clickedButton = buttons?.find((btn) => btn.id === buttonId);

  if (clickedButton?.targetNodeId) {
    // Button found in node data with explicit target
    if (!checkButtonGuards(buttonId, clickedButton.targetNodeId, outgoingEdges, passableEdgeIds)) {
      return {
        targetNodeId: null,
        outcome: "guard_blocked",
        reason: `Guard blocked transition from button '${buttonId}' to node '${clickedButton.targetNodeId}'`,
        buttonFound: true,
        buttonSource: "nodeData",
      };
    }
    return {
      targetNodeId: clickedButton.targetNodeId,
      outcome: "transition_success",
      buttonFound: true,
      buttonSource: "nodeData",
    };
  }

  // Button found in node data but no targetNodeId - check for fallback
  if (clickedButton && !clickedButton.targetNodeId) {
    // Try fallback for single-edge case
    const nodeType = currentNode.data.type;
    if (nodeType === "message" || nodeType === "start") {
      const nonTimerEdges = passableEdges.filter((e) => !isTimerEdge(e));
      if (nonTimerEdges.length === 1) {
        return {
          targetNodeId: nonTimerEdges[0].target,
          outcome: "transition_success",
          reason: `Button '${buttonId}' has no explicit target, using single-edge fallback`,
          buttonFound: true,
          buttonSource: "nodeData",
        };
      }
      return {
        targetNodeId: null,
        outcome: "edge_not_found",
        reason: `Button '${buttonId}' found but no targetNodeId and ${nonTimerEdges.length} non-timer edges (ambiguous)`,
        buttonFound: true,
        buttonSource: "nodeData",
      };
    }
    return {
      targetNodeId: null,
      outcome: "edge_not_found",
      reason: `Button '${buttonId}' found in node data but no targetNodeId configured`,
      buttonFound: true,
      buttonSource: "nodeData",
    };
  }

  // Button not found anywhere
  return {
    targetNodeId: null,
    outcome: "button_not_found",
    reason: `Button '${buttonId}' not found in activeButtons or node data`,
    buttonFound: false,
  };
}
