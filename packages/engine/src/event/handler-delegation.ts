/**
 * Handler Delegation Module
 *
 * Delegates event processing to node handlers that implement handleEvent().
 * Extracted from EventRouter to follow Single Responsibility Principle.
 *
 * Handlers like questionnaire and agent maintain internal state machines
 * and need to process events (user responses) before normal routing.
 */

import type { createLogger } from "@journey/logger";
import type { EnhancedUserJourney, JourneyEdgeData, JourneyNodeData, NodeType } from "@journey/schemas";
import type { SessionStateManager } from "../state/session-state-manager";
import type {
  ExecutionContext,
  JourneyEvent,
  MessengerService,
  NodeEventResult,
  NodeHandler,
  TimerService,
} from "../types";
import { createStateMethods } from "../utils";
import type { GuardContextClientData } from "./guard-context-builder";

// =============================================================================
// TYPES
// =============================================================================

export interface HandlerDelegationConfig {
  session: EnhancedUserJourney;
  timerService: TimerService;
  messengerService: MessengerService;
  stateManager: SessionStateManager;
  log: ReturnType<typeof createLogger>;
}

export interface HandlerDelegationCallbacks {
  getHandler?: (nodeType: NodeType) => NodeHandler | undefined;
  getServices?: () => ExecutionContext["services"];
  getOutgoingEdges: (nodeId: string) => JourneyEdgeData[];
  getClientData?: () => GuardContextClientData | undefined;
  onReExecuteNode?: () => Promise<void>;
  onTransition: (targetNodeId: string, trigger: string, buttonId?: string) => Promise<void>;
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Extract buttonId from event if it's a button_click event.
 * Used for precise edge matching when multiple edges connect the same nodes.
 */
function extractButtonId(event: JourneyEvent): string | undefined {
  return event.type === "button_click" ? event.payload.buttonId : undefined;
}

/**
 * Delegate event to handler if it implements handleEvent()
 *
 * Handlers like questionnaire and agent maintain internal state machines
 * and need to process events (user responses) before normal routing.
 *
 * @returns null if no handler or handler didn't consume the event
 * @returns NodeEventResult with instructions if event was handled
 */
export async function delegateToHandler(
  config: HandlerDelegationConfig,
  callbacks: HandlerDelegationCallbacks,
  event: JourneyEvent,
  currentNode: JourneyNodeData
): Promise<NodeEventResult | null> {
  const { session, timerService, messengerService, stateManager, log } = config;
  const { getHandler, getServices, getOutgoingEdges, getClientData, onReExecuteNode, onTransition } = callbacks;

  // No delegation if getHandler callback isn't provided
  if (!getHandler || !getServices) {
    return null;
  }

  // Get handler for this node type
  const handler = getHandler(currentNode.data.type);
  if (!handler?.handleEvent) {
    return null; // Handler doesn't implement handleEvent
  }

  // Build execution context for the handler
  const routerClientData = getClientData?.();
  const executionContext: ExecutionContext = {
    session,
    node: currentNode,
    journey: undefined, // Not needed for event handling contexts
    outgoingEdges: getOutgoingEdges(currentNode.id),
    services: getServices(),
    log,
    // Convert EventRouterClientData to ClientData (require id for ClientData)
    clientData: routerClientData?.id
      ? { ...routerClientData, id: routerClientData.id, platform: routerClientData.platform ?? "unknown" }
      : undefined,
    stateManager,
    ...createStateMethods(session, currentNode.id, currentNode.data.type, stateManager),
  };

  // Call handler's handleEvent method
  const result = await handler.handleEvent(event, executionContext);

  if (!result?.handled) {
    return null; // Handler didn't consume the event
  }

  log.debug(
    {
      nodeId: currentNode.id,
      nodeType: currentNode.data.type,
      action: result.action,
      reExecute: result.reExecute,
      timerAction: result.timerAction,
    },
    "router:handlerDelegation:handled"
  );

  // Handle timer actions
  if (result.timerAction === "all") {
    await timerService.cancelTimersForNode(currentNode.id);
  }

  // Cancel plugin follow-ups on valid user response handled by a node handler.
  if ((event.type === "button_click" || event.type === "message") && result.action !== "validation_failed") {
    if (timerService.shouldCancelPluginFollowUpsOnResponse(currentNode.id)) {
      await timerService.cancelPluginFollowUpsForNode(currentNode.id);
    } else {
      log.debug({ nodeId: currentNode.id }, "router:pluginFollowUps:notCancelled:cancelOnAnyResponseFalse");
    }
  }

  // Send validation error if present
  if (result.validationError) {
    await messengerService.sendMessage(result.validationError);
  }

  // Clear userResponse if validation failed (P0 fix: invalid responses shouldn't be stored)
  // Use stateManager for consistent mutation pattern (instead of direct session manipulation)
  if (result.action === "validation_failed") {
    stateManager.deleteContextKey("userResponse");
  }

  // Re-execute or transition based on handler's instructions
  if (result.action === "transition" && result.targetNodeId) {
    // Note: Plugin follow-ups already cancelled at line 130 for button_click/message events
    // No need to cancel again here - the check at line 128 handles cancelOnAnyResponse
    await onTransition(result.targetNodeId, result.trigger || event.type, extractButtonId(event));
  } else if (result.reExecute && onReExecuteNode) {
    // Check for per-step "exit" behavior before re-executing
    const responseBehavior = timerService.getPluginFollowUpResponseBehavior(currentNode.id);
    if (responseBehavior?.behavior === "exit" && responseBehavior.exitTargetNodeId) {
      await timerService.cancelPluginFollowUpsForNode(currentNode.id);
      log.info(
        { nodeId: currentNode.id, exitNodeId: responseBehavior.exitTargetNodeId },
        "router:pluginFollowUp:exitOnResponse"
      );
      await onTransition(responseBehavior.exitTargetNodeId, "followup_exit_response");
    } else {
      await onReExecuteNode();
    }
  }

  return result;
}
