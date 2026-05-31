/**
 * Workflow Node Descriptor Helpers
 */

import type { NodeHandleConfig } from "../../handles";
import type { WorkflowNodeType } from "../../../agents/workflow/node-type";
import { NODE_OUTPUT_HANDLES } from "../../../agents/workflow/node-type";

const OUTPUT_LABELS: Partial<Record<WorkflowNodeType, Record<string, string>>> = {
  guard: {
    passed: "pass",
    blocked: "block",
  },
  if_else: {
    yes: "yes",
    no: "no",
  },
  user_approval: {
    approved: "approve",
    rejected: "reject",
  },
};

export function buildWorkflowHandles(nodeType: WorkflowNodeType): NodeHandleConfig {
  const outputs = NODE_OUTPUT_HANDLES[nodeType].map((id) => ({
    id,
    label: OUTPUT_LABELS[nodeType]?.[id],
  }));

  const inputs = nodeType === "start" ? [] : [{ id: "default", label: "In" }];

  return {
    inputs,
    outputs,
  };
}
