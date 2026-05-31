/**
 * End Node Executor - Terminal node for workflow execution
 */

import type { EndNodeConfig } from "@journey/schemas";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { resolveTemplate } from "../../variable-resolver";
import { BaseNodeExecutor } from "../base-executor";

/**
 * End node executor.
 *
 * Terminal node - no outgoing edges.
 * Optionally formats final output using template.
 */
export class EndNodeExecutor extends BaseNodeExecutor<EndNodeConfig> {
  readonly nodeType = "end";

  protected async executeNode(
    input: NodeInput,
    config: EndNodeConfig,
    _context: WorkflowContext
  ): Promise<NodeOutput> {
    // Find the last agent response
    let finalResponse: string | undefined;
    for (const [_nodeId, output] of input.previousNodeOutputs) {
      if (output.response) {
        finalResponse = output.response;
      }
    }

    // Apply output template if provided
    if (config.outputTemplate && finalResponse) {
      const templateVars = {
        ...input.variables,
        lastAgent: { response: finalResponse },
      };
      finalResponse = resolveTemplate(config.outputTemplate, templateVars);
    }

    return {
      response: finalResponse,
      executionTimeMs: 0, // Will be overwritten by base class
    };
  }
}
