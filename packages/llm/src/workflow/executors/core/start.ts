/**
 * Start Node Executor - Entry point for workflow execution
 */

import type { StartNodeConfig } from "@journey/schemas";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { BaseNodeExecutor } from "../base-executor";

/**
 * Start node executor.
 *
 * Simply passes through to the next node.
 */
export class StartNodeExecutor extends BaseNodeExecutor<StartNodeConfig> {
  readonly nodeType = "start";

  protected async executeNode(
    _input: NodeInput,
    _config: StartNodeConfig,
    _context: WorkflowContext
  ): Promise<NodeOutput> {
    return {
      outHandle: "default",
      executionTimeMs: 0, // Will be overwritten by base class
    };
  }
}
