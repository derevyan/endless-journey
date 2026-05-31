/**
 * Transform Node Executor - Data transformation
 *
 * Applies various transformations to workflow data.
 */

import type { TransformNodeConfig } from "@journey/schemas";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { resolveVariablePath } from "../../expression-evaluator";
import { resolveTemplate } from "../../variable-resolver";
import { extractJson } from "../../utilities";
import { BaseNodeExecutor } from "../base-executor";

/**
 * Transform node executor.
 *
 * Applies data transformations like extractJson, pick, template, merge.
 */
export class TransformNodeExecutor extends BaseNodeExecutor<TransformNodeConfig> {
  readonly nodeType = "transform";

  protected async executeNode(
    input: NodeInput,
    config: TransformNodeConfig,
    context: WorkflowContext
  ): Promise<NodeOutput> {
    context.log.info({ operationType: config.operation.type }, "workflow:transform:applying");

    let result: unknown;

    switch (config.operation.type) {
      case "extractJson": {
        const sourceValue = resolveVariablePath(config.operation.sourceVariable, input.variables);
        result = extractJson(sourceValue);
        break;
      }

      case "pick": {
        const sourceValue = resolveVariablePath(config.operation.sourceVariable, input.variables);
        result = this.pick(sourceValue, config.operation.fields);
        break;
      }

      case "template": {
        result = resolveTemplate(config.operation.template, input.variables);
        break;
      }

      case "merge": {
        const sources = config.operation.sources.map((source) =>
          resolveVariablePath(source, input.variables)
        );
        result = this.merge(sources);
        break;
      }

      default: {
        const _exhaustive: never = config.operation;
        throw new Error(`Unknown transform operation: ${(_exhaustive as { type: string }).type}`);
      }
    }

    return {
      outHandle: "default",
      data: {
        [config.outputVariable]: result,
      },
      executionTimeMs: 0,
      metadata: {
        operationType: config.operation.type,
      },
    };
  }

  /**
   * Pick specific fields from an object.
   */
  private pick(value: unknown, fields: string[]): Record<string, unknown> {
    if (typeof value !== "object" || value === null) {
      return {};
    }

    const result: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in (value as Record<string, unknown>)) {
        result[field] = (value as Record<string, unknown>)[field];
      }
    }

    return result;
  }

  /**
   * Merge multiple objects into one.
   */
  private merge(sources: unknown[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const source of sources) {
      if (typeof source === "object" && source !== null) {
        Object.assign(result, source);
      }
    }

    return result;
  }
}
