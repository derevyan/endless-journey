/**
 * Start Node Handler
 *
 * Handles the start node - the entry point of every journey.
 * Sends an initial message and checks for auto-transitions.
 */

import type { StartNodeData } from "@journey/schemas";
import type { ExecutionContext, HandlerResult } from "../../../types";
import { EdgeSelector } from "../../../services/edge-selector";
import { assertNodeData, validateMedia } from "../../../utils";
import { storeNodeOutput } from "../../../utils/node-outputs";
import { createMessageMetadata } from "../../../utils/output-helpers";
import { BaseNodeHandler } from "../../base-handler";

/**
 * Handler for start nodes
 *
 * Responsibilities:
 * - Send welcome message with optional media
 * - Auto-transition to next node (start nodes don't have buttons by design)
 */
export class StartNodeHandler extends BaseNodeHandler<StartNodeData> {
  readonly nodeType = "start" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { node, outgoingEdges, services, log } = context;
    const nodeData = assertNodeData<StartNodeData>(node, "start");

    // Build guard context with auto selection - only loads full context if guards need it
    // This caches for reuse in template substitution
    const selector = await EdgeSelector.from(context).withAutoContext(outgoingEdges);
    const { passableEdges } = selector.select(outgoingEdges);

    // Validate and normalize media format
    const validMedia = validateMedia(nodeData.media);

    // Send welcome message (pass cached context to avoid re-fetching variables)
    const sendResult = await services.messenger.sendMessage(
      nodeData.content,
      undefined,
      validMedia,
      context._cachedEvaluationContext
    );

    // Store journey entry metadata for observability
    storeNodeOutput(context.session, node, {
      ...createMessageMetadata(nodeData.content, sendResult, validMedia, "journeyStartedAt"),
    }, context.stateManager);

    // If message send failed (after retries), stay on start node
    // User can retry by sending /start again
    if (!sendResult.success) {
      log.error({ nodeId: node.id, error: sendResult.error }, "start:sendFailed");
      return { action: "wait" };
    }

    // Auto-transition through default edge
    // Start nodes don't have buttons by schema design, so they should always
    // auto-transition to the next node after displaying the welcome message
    const defaultEdge = passableEdges.find((edge) => edge.label === "Auto transition" || edge.label === "Immediate" || edge.edgeType === "default");

    if (defaultEdge) {
      log.debug({ nodeId: node.id, targetId: defaultEdge.target }, "start:autoTransition");
      return { action: "transition", targetNodeId: defaultEdge.target, trigger: "automatic" };
    }

    // Fallback: use first passable edge if no matching label/type found
    if (passableEdges.length > 0) {
      log.warn({ nodeId: node.id, edgeId: passableEdges[0].id }, "start:usingFirstEdgeFallback");
      return { action: "transition", targetNodeId: passableEdges[0].target, trigger: "automatic" };
    }

    // No edges at all - journey is misconfigured
    log.error({ nodeId: node.id }, "start:noOutgoingEdges");
    return { action: "wait" };
  }
}

export const startHandler = new StartNodeHandler();
