/**
 * User Approval Node Executor - Human-in-the-loop approval
 *
 * Pauses workflow execution to wait for human approval.
 * Returns a "paused" result that signals the runner to persist state.
 *
 * Output handles:
 * - 'approved': Human approved the request (after resume)
 * - 'rejected': Human rejected the request (after resume)
 */

import type { UserApprovalNodeConfig } from "@journey/schemas";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { BaseNodeExecutor } from "../base-executor";

/**
 * User Approval node executor.
 *
 * When executed, this node immediately returns a "paused" result.
 * The runner captures this and returns workflow state for persistence.
 * After human approval/rejection, the workflow is resumed with the decision.
 */
export class UserApprovalNodeExecutor extends BaseNodeExecutor<UserApprovalNodeConfig> {
  readonly nodeType = "user_approval";

  protected async executeNode(
    _input: NodeInput,
    config: UserApprovalNodeConfig,
    context: WorkflowContext
  ): Promise<NodeOutput> {
    context.log.info(
      {
        nodeId: context.currentNodeId,
        message: config.message,
        timeoutSeconds: config.timeoutSeconds,
        timeoutAction: config.timeoutAction,
      },
      "workflow:user-approval:pause-requested"
    );

    // Return paused result - runner will handle state persistence
    return {
      paused: true,
      pauseReason: "user_approval",
      pauseState: {
        nodeId: context.currentNodeId || "unknown",
        approvalMessage: config.message,
        timeoutSeconds: config.timeoutSeconds,
        timeoutAction: config.timeoutAction,
        allowedRoles: config.allowedRoles,
      },
      executionTimeMs: 0,
      metadata: {
        message: config.message,
        timeoutSeconds: config.timeoutSeconds,
        timeoutAction: config.timeoutAction,
        allowedRoles: config.allowedRoles,
      },
    };
  }
}
