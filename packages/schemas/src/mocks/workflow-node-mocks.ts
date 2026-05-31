/**
 * Workflow Node Mock Generator
 *
 * Generates mock data for agent workflow node outputs.
 * Workflow nodes have different output schemas than journey nodes.
 *
 * @module mocks/workflow-node-mocks
 */

import type { MockDataResult } from "./index";

/**
 * Generate mock data for workflow node outputs.
 *
 * Workflow nodes (used in agent workflows) have simpler output schemas
 * compared to journey nodes. This generator creates appropriate mock
 * values for each workflow node type.
 *
 * @param nodeType - The workflow node type (e.g., "agent", "condition")
 * @param nodeData - Optional node data for context (e.g., name)
 * @returns MockDataResult with mock data, or null if node produces no output
 *
 * @example
 * ```ts
 * const mock = generateWorkflowNodeMock("agent", { name: "Sales Agent" });
 * // => { data: { response: "Sample response from ..." }, typeString: "object" }
 * ```
 */
export function generateWorkflowNodeMock(
  nodeType: string,
  nodeData?: Record<string, unknown>
): MockDataResult | null {
  const nodeName = typeof nodeData?.name === "string" ? nodeData.name : nodeType;

  switch (nodeType) {
    case "agent":
      // Workflow agent nodes output { response: string }
      return {
        data: {
          response: `Sample response from "${nodeName}" agent. This is mock data showing what the agent would output.`,
        },
        typeString: "object",
        description: `Output from "${nodeName}" agent node`,
      };

    case "condition":
      return {
        data: { result: true },
        typeString: "object",
        description: `Condition result from "${nodeName}"`,
      };

    case "voice_director":
      return {
        data: {
          response: `Voice-directed response from "${nodeName}".`,
          voiceId: "voice-sample-id",
        },
        typeString: "object",
        description: `Voice director output from "${nodeName}"`,
      };

    case "transform":
      return {
        data: {
          result: "transformed_value",
        },
        typeString: "object",
        description: `Transform output from "${nodeName}"`,
      };

    case "set_state":
      return null; // set_state doesn't produce output

    case "start":
      return null; // start nodes don't produce output

    default:
      // Generic workflow node output
      return {
        data: { value: `output_from_${nodeType}` },
        typeString: "object",
        description: `Output from ${nodeType} node`,
      };
  }
}
