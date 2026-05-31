/**
 * Workflow If/Else Node Descriptor (Base)
 */

import { IfElseNodeConfigSchema, type IfElseNodeConfig } from "../../../../agents/workflow/nodes/logic";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowIfElseNodeDescriptor: WorkflowNodeDescriptor<IfElseNodeConfig> = {
  system: "workflow",
  type: "if_else",
  version: 1,
  displayName: "If/Else",
  description: "Conditional branching based on expression or intent",
  category: "logic",
  size: "compact",

  schema: IfElseNodeConfigSchema,
  handles: buildWorkflowHandles("if_else"),

  createDefaultData: () => ({
    conditionType: "expression",
    condition: {
      left: "result.success",
      operator: "===",
      right: true,
    },
  }),

  isType: (data): data is IfElseNodeConfig => IfElseNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowIfElseNodeDescriptor);
