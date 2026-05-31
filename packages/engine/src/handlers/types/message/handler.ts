/**
 * Message Node Handler
 *
 * Handles message nodes - the primary content delivery mechanism.
 * Supports different response types:
 * - auto: Display message and auto-continue (informational)
 * - buttons: Wait for button click only
 * - text: Wait for free-text message from user
 * - any: Accept both buttons and text input
 */

import { EngineError, type MessageNodeData } from "@journey/schemas";
import type { ExecutionContext, HandlerResult } from "../../../types";
import { EdgeSelector } from "../../../services/edge-selector";
import { assertNodeData, getEffectiveResponseType, getMatchingButtonEdgesFromConfig, isTimerEdge, sleep, validateMedia } from "../../../utils";
import { storeNodeOutput } from "../../../utils/node-outputs";
import { createMessageMetadata, serializeButtons } from "../../../utils/output-helpers";
import { BaseNodeHandler } from "../../base-handler";

/**
 * Handler for message nodes
 *
 * Responsibilities:
 * - Send message with optional buttons and media
 * - Handle different response types (auto, buttons, text, any)
 * - Check for auto-transition edges when responseType is "auto"
 * - Schedule timers for timeout edges
 * - Return wait result if user interaction is needed
 */
export class MessageNodeHandler extends BaseNodeHandler<MessageNodeData> {
  readonly nodeType = "message" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { node, outgoingEdges, services, log } = context;
    const nodeData = assertNodeData<MessageNodeData>(node, "message");
    const responseType = getEffectiveResponseType(nodeData);

    // Filter edges by guards (Smart Edges feature) using two-phase selection
    // Use auto context selection - only loads full context if guards need it
    const selector = await EdgeSelector.from(context).withAutoContext(outgoingEdges);
    const { passableEdges, guardPassableEdges, passableEdgeIds } = selector.selectTwoPhase(outgoingEdges);

    // Validate and normalize media format
    const validMedia = validateMedia(nodeData.media);

    // Handle delay if configured (wait before sending for natural pacing)
    const delaySeconds = nodeData.delay && typeof nodeData.delay === "number" && nodeData.delay > 0 ? nodeData.delay : 0;
    if (delaySeconds > 0) {
      log.debug({ nodeId: node.id, delaySeconds }, "message:waitingDelay");
      await sleep(delaySeconds * 1000);
    }

    // Send message with buttons and media
    // Only send buttons if responseType expects them
    const buttonsToSend = responseType === "buttons" || responseType === "any"
      ? nodeData.buttons?.filter((button) => {
        const matches = getMatchingButtonEdgesFromConfig(outgoingEdges, button);
        if (matches.length === 0) {
          return true;
        }
        return matches.some((edge) => passableEdgeIds.has(edge.id));
      })
      : undefined;
    // Pass cached evaluation context to avoid re-fetching variables
    // The context was already built by EdgeSelector.withFullContext() above
    // Note: voiceMode is only supported on agent nodes, not message nodes
    // (message nodes display static content, voice output is for AI responses)
    const sendResult = await services.messenger.sendMessage(
      nodeData.content,
      buttonsToSend,
      validMedia,
      context._cachedEvaluationContext
    );

    // Set activeButtons in session for unified button routing
    // This tracks "currently displayed buttons" for O(1) lookup
    if (buttonsToSend && buttonsToSend.length > 0) {
      const activeButtons = buttonsToSend
        .filter((btn) => btn.targetNodeId) // Only buttons with routing
        .map((btn) => ({
          id: btn.id,
          text: btn.text,
          targetNodeId: btn.targetNodeId!,
          source: "node" as const,
        }));
      context.stateManager.setActiveButtons(activeButtons);
      log.debug({ nodeId: node.id, buttonCount: activeButtons.length }, "message:activeButtonsSet");
    } else {
      // Clear if no buttons sent
      context.stateManager.clearActiveButtons();
    }

    // If message send failed (after retries), handle error for ALL response types
    if (!sendResult.success) {
      log.error({ nodeId: node.id, error: sendResult.error, responseType }, "message:sendFailed");

      // Check for explicit error edge for ANY response type (not just auto)
      const errorEdge = passableEdges.find((edge) => edge.label?.toLowerCase() === "error");
      if (errorEdge) {
        log.info({ nodeId: node.id, targetId: errorEdge.target, responseType }, "message:sendFailed:transitionToError");
        return { action: "transition", targetNodeId: errorEdge.target, trigger: "send_error" };
      }

      // No error edge configured - throw to prevent zombie state
      // This surfaces the error properly instead of silently waiting
      throw new EngineError(
        `Message send failed (${responseType} mode): ${sendResult.error || "unknown error"}`,
        undefined,
        node.id
      );
    }

    // Check if timer is configured (must check BEFORE auto-transition to respect timers)
    // Validate timer seconds is a valid positive finite number
    const timerSeconds =
      nodeData.timer &&
      typeof nodeData.timer === "object" &&
      "seconds" in nodeData.timer &&
      typeof nodeData.timer.seconds === "number" &&
      Number.isFinite(nodeData.timer.seconds)
        ? nodeData.timer.seconds
        : 0;
    const hasTimer = timerSeconds > 0;
    const timerEdge = hasTimer ? passableEdges.find(isTimerEdge) : null;

    // For "auto" response type WITHOUT timer, auto-transition immediately
    // If timer is configured, we wait for it instead of auto-transitioning
    if (responseType === "auto" && !timerEdge) {
      // Check for explicit auto-transition edges (using passable edges)
      const autoEdge = passableEdges.find((edge) => edge.label === "Auto transition" || edge.label === "Immediate");

      if (autoEdge) {
        log.debug({ nodeId: node.id, targetId: autoEdge.target }, "message:autoTransition");
        return { action: "transition", targetNodeId: autoEdge.target, trigger: "automatic" };
      }

      // If no explicit auto edge but we're in auto mode, take the first non-timer passable edge
      const defaultEdge = passableEdges.find((edge) => !isTimerEdge(edge));
      if (defaultEdge) {
        log.debug({ nodeId: node.id, targetId: defaultEdge.target }, "message:autoTransitionDefault");
        return { action: "transition", targetNodeId: defaultEdge.target, trigger: "automatic" };
      }
    }

    // Schedule timer if configured (works with all response types including auto)
    if (timerEdge && hasTimer) {
      const delayMs = timerSeconds * 1000;
      await services.timer.scheduleTimer(delayMs, timerEdge.id);
      log.info({ nodeId: node.id, delayMs, edgeId: timerEdge.id, responseType }, "message:timerScheduled");
    }

    // Store message execution metadata for observability and templates
    storeNodeOutput(context.session, node, {
      ...createMessageMetadata(nodeData.content, sendResult, validMedia, "sentAt"),
      responseType: responseType,
      buttonsDisplayed: serializeButtons(buttonsToSend),
      delayApplied: delaySeconds > 0 ? delaySeconds : null,
      timerScheduled: hasTimer,
    }, context.stateManager);

    // Wait for user interaction (button click, text message, or timer)
    log.debug({ nodeId: node.id, responseType }, "message:waitingForInput");
    return { action: "wait" };
  }
}

export const messageHandler = new MessageNodeHandler();
