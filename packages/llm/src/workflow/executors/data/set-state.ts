/**
 * SetState Node Executor - Store workflow variables
 *
 * Sets a value in the workflow state.
 */

import type { SetStateNodeConfig } from "@journey/schemas";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { resolveTemplate } from "../../variable-resolver";
import { BaseNodeExecutor } from "../base-executor";

/**
 * SetState node executor.
 *
 * Stores a value in workflow state.
 */
export class SetStateNodeExecutor extends BaseNodeExecutor<SetStateNodeConfig> {
  readonly nodeType = "set_state";

  protected async executeNode(
    input: NodeInput,
    config: SetStateNodeConfig,
    context: WorkflowContext
  ): Promise<NodeOutput> {
    context.log.info({ key: config.key, isTemplate: config.isTemplate }, "workflow:set-state:setting");

    let value: unknown = config.value;

    // If isTemplate is true, resolve the value as a template
    if (config.isTemplate && typeof config.value === "string") {
      value = resolveTemplate(config.value, input.variables);
    }

    return {
      outHandle: "default",
      data: {
        [config.key]: value,
      },
      executionTimeMs: 0,
      metadata: {
        key: config.key,
        valueType: typeof value,
      },
    };
  }
}
