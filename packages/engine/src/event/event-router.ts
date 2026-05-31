/**
 * Event Router
 *
 * Orchestrates routing of incoming events (messages, button clicks, timeouts)
 * to appropriate node transitions during journey execution.
 *
 * This is a thin orchestrator that delegates to specialized modules:
 * - event-validation.ts: Session/stale validation
 * - user-response.ts: Response storage and logging
 * - handler-delegation.ts: Handler event delegation
 * - guard-context-builder.ts: Guard context construction
 * - target-resolver.ts: Target node resolution
 */

import type { createLogger } from "@journey/logger";
import { EventTypes, type EnhancedUserJourney, type JourneyEdgeData, type JourneyNodeData, type NodeType } from "@journey/schemas";
import type { SessionStateManager } from "../state/session-state-manager";
import type {
  EngineServices,
  EventLogger,
  ExecutionContext,
  JourneyEvent,
  MessengerService,
  NodeHandler,
  TimerService,
} from "../types";
import { getNodeResponseType } from "../utils";

// Import extracted modules
import { validateEvent, isStaleTimeout, handlePluginFollowUpTimeout, type PluginTimeoutCallbackResult } from "./event-validation";
import { buildFullGuardContext, type GuardContextClientData } from "./guard-context-builder";
import { delegateToHandler } from "./handler-delegation";
import { findTargetNode, findTargetNodeForButtonClick, type ButtonClickResolveResult } from "./target-resolver";
import { storeUserResponse, logUserAction, isResponseAccepted, type ClickOutcomeInfo } from "./user-response";

// =============================================================================
// TYPES
// =============================================================================

export interface EventRouterConfig {
  session: EnhancedUserJourney;
  stateManager: SessionStateManager;
  eventLogger: EventLogger;
  timerService: TimerService;
  messengerService: MessengerService;
  log: ReturnType<typeof createLogger>;
}

/** Client data for guard context (user namespace) */
export interface EventRouterClientData extends GuardContextClientData {}

// Re-export for convenience
export type { PluginTimeoutCallbackResult };

export interface EventRouterCallbacks {
  getNode: (id: string) => JourneyNodeData | undefined;
  getOutgoingEdges: (nodeId: string) => JourneyEdgeData[];
  onTransition: (targetNodeId: string, trigger: string, buttonId?: string) => Promise<void>;
  onMindstateAnalysis?: (message: string, nodeId: string) => Promise<void>;
  /** Re-execute current node (for questionnaire progress) */
  onReExecuteNode?: () => Promise<void>;
  /** Get client data for guard context (user namespace in expression guards) */
  getClientData?: () => EventRouterClientData | undefined;
  /**
   * Get handler for a node type (for delegation pattern)
   * Used to delegate event handling to node handlers that implement handleEvent()
   */
  getHandler?: (nodeType: NodeType) => NodeHandler | undefined;
  /**
   * Get engine services for building execution context
   * Required for handler delegation
   */
  getServices?: () => ExecutionContext["services"];
  /**
   * Handle plugin follow-up timeout
   * Called when a plugin timer fires (e.g., follow-up sequence step)
   * Returns action to take: continue (stay on node) or transition (go to exit path)
   */
  onPluginTimeout?: (timerId: string) => Promise<PluginTimeoutCallbackResult>;
}

// =============================================================================
// EVENT ROUTER
// =============================================================================

export class EventRouter {
  private config: EventRouterConfig;
  private callbacks: EventRouterCallbacks;

  constructor(config: EventRouterConfig, callbacks: EventRouterCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  /**
   * Extract buttonId from event if it's a button_click event.
   */
  private extractButtonId(event: JourneyEvent): string | undefined {
    return event.type === "button_click" ? event.payload.buttonId : undefined;
  }

  /**
   * Handle incoming event (message, button click, timeout)
   */
  async handle(event: JourneyEvent): Promise<void> {
    const { session, eventLogger, timerService, log, stateManager } = this.config;
    const { getNode, getOutgoingEdges, onTransition, onMindstateAnalysis } = this.callbacks;

    // 1. VALIDATE EVENT
    const validation = validateEvent(event, session, log);
    if (!validation.valid) {
      return;
    }

    // 2. HANDLE STALE TIMEOUTS AND PLUGIN FOLLOW-UPS
    if (event.type === "timeout") {
      // Check for plugin follow-up first
      const pluginResult = await handlePluginFollowUpTimeout(event, timerService, {
        onPluginTimeout: this.callbacks.onPluginTimeout,
        onTransition,
      }, log);
      if (pluginResult.handled) {
        return;
      }

      // Check for stale regular timer
      if (isStaleTimeout(event, timerService, log, session.sessionId, session.currentNodeId)) {
        return;
      }
    }

    // 3. GET CURRENT NODE
    const currentNode = getNode(session.currentNodeId);
    if (!currentNode) return;

    // Trace: Log full event details
    log.trace(
      {
        eventType: event.type,
        eventPayload: event.payload,
        currentNodeId: currentNode.id,
        currentNodeType: currentNode.data.type,
        currentNodeLabel: currentNode.data.label,
        sessionContext: session.context,
      },
      "router:trace:eventReceived"
    );

    log.debug({ nodeId: currentNode.id, eventType: event.type, payload: event.payload }, "engine:eventReceived");

    // 4. LOG USER ACTION (for non-button-click events, log immediately)
    // For button clicks, we defer logging until we have the outcome
    if (event.type !== "button_click") {
      logUserAction(eventLogger, event, currentNode, session);
    }

    // 5. CHECK RESPONSE ACCEPTANCE AND STORE
    const responseType = getNodeResponseType(currentNode);
    const isAcceptedResponse = isResponseAccepted(event.type, responseType);

    // Log when text message is ignored on button-only node
    if (!isAcceptedResponse && event.type === "message" && responseType === "buttons") {
      log.debug(
        { nodeId: currentNode.id, responseType, text: event.payload.text },
        "engine:responseNotStored:buttonNodeExpected"
      );
    }

    // 6. TRIGGER MINDSTATE ANALYSIS (before finding target node)
    if (event.type === "message" && event.payload.text && onMindstateAnalysis) {
      await onMindstateAnalysis(event.payload.text, currentNode.id);
    }

    // 7. STORE USER RESPONSE (before handler delegation)
    if (isAcceptedResponse) {
      storeUserResponse({ stateManager, log }, event, currentNode);
    }

    // 8. DELEGATE TO HANDLER
    const delegationResult = await delegateToHandler(
      {
        session,
        timerService,
        messengerService: this.config.messengerService,
        stateManager,
        log,
      },
      {
        getHandler: this.callbacks.getHandler,
        getServices: this.callbacks.getServices,
        getOutgoingEdges,
        getClientData: this.callbacks.getClientData,
        onReExecuteNode: this.callbacks.onReExecuteNode,
        onTransition,
      },
      event,
      currentNode
    );
    if (delegationResult?.handled) {
      // Log button clicks that were handled by delegation (e.g., questionnaire)
      if (event.type === "button_click") {
        const clickOutcomeInfo: ClickOutcomeInfo = {
          // Handler took care of it - either re-executed or transitioned
          outcome: delegationResult.action === "transition" ? "transition_success" : "agent_reexecute",
          activeButtonsAtClick: session.activeButtons?.map((btn) => ({
            id: btn.id,
            text: btn.text,
            targetNodeId: btn.targetNodeId,
            source: btn.source,
          })),
          transitionedToNodeId: delegationResult.targetNodeId,
        };
        logUserAction(eventLogger, event, currentNode, session, clickOutcomeInfo);
      }
      return;
    }

    // 9. BUILD GUARD CONTEXT
    const guardContext = await buildFullGuardContext(
      { session, stateManager, log },
      {
        getClientData: this.callbacks.getClientData,
        getOutgoingEdges,
        getServices: this.callbacks.getServices,
      },
      currentNode
    );

    // 10. FIND TARGET NODE
    const outgoingEdges = getOutgoingEdges(currentNode.id);

    // For button clicks, use detailed resolution to capture outcome
    let targetNodeId: string | null = null;
    let buttonClickResult: ButtonClickResolveResult | undefined;

    if (event.type === "button_click") {
      const buttonId = event.payload.buttonId || "";

      // Get detailed click result with outcome
      buttonClickResult = findTargetNodeForButtonClick(
        { session, timerService, stateManager, log, eventLogger },
        {
          getClientData: this.callbacks.getClientData,
          getServices: this.callbacks.getServices as (() => EngineServices) | undefined,
        },
        buttonId,
        currentNode,
        outgoingEdges,
        guardContext
      );

      targetNodeId = buttonClickResult.targetNodeId;

      // Build click outcome info for logging
      const clickOutcomeInfo: ClickOutcomeInfo = {
        outcome: buttonClickResult.outcome,
        activeButtonsAtClick: session.activeButtons?.map((btn) => ({
          id: btn.id,
          text: btn.text,
          targetNodeId: btn.targetNodeId,
          source: btn.source,
        })),
        failureReason: buttonClickResult.reason,
        transitionedToNodeId: targetNodeId ?? undefined,
      };

      // Now log the button click with outcome info
      logUserAction(eventLogger, event, currentNode, session, clickOutcomeInfo);
    } else {
      // For non-button events, use standard resolution
      targetNodeId = findTargetNode(
        { session, timerService, stateManager, log, eventLogger },
        {
          getClientData: this.callbacks.getClientData,
          getServices: this.callbacks.getServices as (() => EngineServices) | undefined,
        },
        event,
        currentNode,
        outgoingEdges,
        guardContext
      );
    }

    // 11. EXECUTE TRANSITION OR HANDLE NO-MATCH
    if (targetNodeId) {
      await this.executeTransition(event, currentNode, targetNodeId);
    } else {
      await this.handleNoMatchingEdge(event, currentNode);
    }
  }

  /**
   * Execute transition to target node
   */
  private async executeTransition(
    event: JourneyEvent,
    currentNode: JourneyNodeData,
    targetNodeId: string
  ): Promise<void> {
    const { session, timerService, stateManager, log } = this.config;
    const { onTransition } = this.callbacks;

    // Cancel timers and plugin follow-ups on valid user action (button click or message)
    // Only cancel when input results in a transition - invalid input should NOT cancel timers
    // IMPORTANT: Must await to prevent race conditions where timeout fires after user input
    if (event.type === "button_click" || event.type === "message") {
      await timerService.cancelTimersForNode(currentNode.id);
      // Cancel plugin follow-ups attached to this node
      if (timerService.shouldCancelPluginFollowUpsOnResponse(currentNode.id)) {
        await timerService.cancelPluginFollowUpsForNode(currentNode.id);
      } else {
        log.debug({ nodeId: currentNode.id }, "router:pluginFollowUps:notCancelled:cancelOnAnyResponseFalse");
      }
    }

    // Execute transition first - if it fails, buttons should remain visible
    await onTransition(targetNodeId, event.type, this.extractButtonId(event));

    // Clear activeButtons AFTER successful transition
    // This prevents UI inconsistency if transition fails
    if (session.activeButtons) {
      log.debug({ nodeId: currentNode.id, clearedCount: session.activeButtons.length }, "engine:activeButtonsCleared");
      stateManager.clearActiveButtons();
    }
  }

  /**
   * Handle case when no matching edge was found
   */
  private async handleNoMatchingEdge(event: JourneyEvent, currentNode: JourneyNodeData): Promise<void> {
    const { timerService, eventLogger, log } = this.config;
    const { onTransition } = this.callbacks;

    // Check for per-step "exit" behavior
    const responseBehavior = timerService.getPluginFollowUpResponseBehavior(currentNode.id);
    if (responseBehavior?.behavior === "exit" && responseBehavior.exitTargetNodeId) {
      await timerService.cancelPluginFollowUpsForNode(currentNode.id);
      log.info(
        { nodeId: currentNode.id, exitNodeId: responseBehavior.exitTargetNodeId },
        "router:pluginFollowUp:exitOnResponse:noMatchingEdge"
      );
      await onTransition(responseBehavior.exitTargetNodeId, "followup_exit_response");
    } else {
      log.warn({ eventType: event.type, nodeId: currentNode.id, payload: event.payload }, "engine:noMatchingEdge");
      eventLogger.logEvent({
        type: EventTypes.ENGINE_ERROR,
        nodeId: currentNode.id,
        payload: {
          message: `No matching edge for ${event.type} at node ${currentNode.id}`,
          code: "no_matching_edge",
          nodeId: currentNode.id,
        },
      });
    }
  }
}
