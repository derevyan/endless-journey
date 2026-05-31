/**
 * Wait Node Handler
 *
 * Handles wait nodes - pauses the journey for a specified duration.
 * After the timer expires, the journey continues to the next node.
 */

import { durationToMs, type WaitNodeData } from "@journey/schemas";
import type { ExecutionContext, HandlerResult } from "../../../types";
import { EdgeSelector } from "../../../services/edge-selector";
import { assertNodeData } from "../../../utils";
import { storeNodeOutput } from "../../../utils/node-outputs";
import { createTimestamp } from "../../../utils/output-helpers";
import { BaseNodeHandler } from "../../base-handler";

/**
 * Handler for wait nodes
 *
 * Responsibilities:
 * - Schedule a timer for the wait duration
 * - Return wait result (timer will trigger transition)
 */
export class WaitNodeHandler extends BaseNodeHandler<WaitNodeData> {
  readonly nodeType = "wait" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { node, outgoingEdges, services, log } = context;
    const nodeData = assertNodeData<WaitNodeData>(node, "wait");

    // Filter edges by guards (Smart Edges feature)
    // Use full context (async) for guards referencing vars.*, nodes.*, etc.
    const selector = await EdgeSelector.from(context).withFullContext();
    const { passableEdges } = selector.select(outgoingEdges);

    // Validate outgoing edges exist (after guard filtering)
    if (passableEdges.length === 0) {
      log.error({ nodeId: node.id }, "wait:noOutgoingEdges");
      // Can't proceed - return wait but log the error for debugging
      return { action: "wait" };
    }

    // Validate duration is configured
    if (!nodeData.duration) {
      log.error({ nodeId: node.id }, "wait:noDurationConfigured");
      // Skip wait and immediately transition to prevent deadlock
      return {
        action: "transition",
        targetNodeId: passableEdges[0].target,
        trigger: "wait_no_duration",
      };
    }

    // Convert duration to milliseconds (supports seconds, minutes, hours, days)
    const delayMs = durationToMs(nodeData.duration);

    // Validate duration is a valid positive number
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
      log.error({ nodeId: node.id, duration: nodeData.duration, delayMs }, "wait:invalidDuration");
      // Skip wait and immediately transition
      return {
        action: "transition",
        targetNodeId: passableEdges[0].target,
        trigger: "wait_invalid_duration",
      };
    }
    await services.timer.scheduleTimer(delayMs, passableEdges[0].id);
    log.info({ nodeId: node.id, delayMs, edgeId: passableEdges[0].id }, "wait:timerScheduled");

    // Store wait timing metadata for observability and analytics
    const now = new Date();
    const expectedCompletion = new Date(now.getTime() + delayMs);
    storeNodeOutput(context.session, node, {
      duration: nodeData.duration,
      delayMs: delayMs,
      ...createTimestamp("timerScheduledAt"),
      expectedCompletionAt: expectedCompletion.toISOString(),
    }, context.stateManager);

    // Wait for timer to expire
    return { action: "wait" };
  }
}

export const waitHandler = new WaitNodeHandler();
