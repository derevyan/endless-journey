/**
 * End Node Handler
 *
 * Handles end nodes - the terminal state of a journey.
 * Marks the session as completed and sends a final message.
 */

import type { EndNodeData } from "@journey/schemas";
import type { ExecutionContext, HandlerResult, SendMessageResult } from "../../../types";
import { assertNodeData, getOrBuildEvaluationContext } from "../../../utils";
import { storeNodeOutput } from "../../../utils/node-outputs";
import { createMessageMetadata } from "../../../utils/output-helpers";
import { BaseNodeHandler } from "../../base-handler";

/**
 * Handler for end nodes
 *
 * Responsibilities:
 * - Mark session as completed
 * - Send final message with optional buttons
 * - Return complete result to stop execution
 */
export class EndNodeHandler extends BaseNodeHandler<EndNodeData> {
  readonly nodeType = "end" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { node, services, log, stateManager, session } = context;
    const nodeData = assertNodeData<EndNodeData>(node, "end");

    let sendResult: SendMessageResult = { success: false, messageIds: [] };

    // Send final message only if content exists (end nodes can be clean terminal states)
    if (nodeData.content) {
      // Build context for template substitution (cached for efficiency)
      const evalContext = await getOrBuildEvaluationContext(context);
      const result = await services.messenger.sendMessage(nodeData.content, nodeData.buttons, undefined, evalContext);
      sendResult = result;

      // If message send failed (after retries), stay on end node
      // Don't mark as completed - allow retry
      if (!sendResult.success) {
        log.error({ nodeId: node.id, error: sendResult.error }, "end:sendFailed");
        return { action: "wait" };
      }
    }

    // Store journey completion metadata for observability
    storeNodeOutput(session, node, {
      ...createMessageMetadata(nodeData.content, sendResult, undefined, "journeyCompletedAt"),
      sessionStatus: "completed",
    }, stateManager);

    // Mark session as completed via state manager (also sets completedAt)
    stateManager.setStatus("completed");

    log.info({ nodeId: node.id }, "journey:completed");

    return { action: "complete" };
  }
}

export const endHandler = new EndNodeHandler();
