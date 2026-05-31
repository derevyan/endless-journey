/**
 * Workflow Transform Node Descriptor (Base)
 */

import { TransformNodeConfigSchema, type TransformNodeConfig } from "../../../../agents/workflow/nodes/data";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowTransformNodeDescriptor: WorkflowNodeDescriptor<TransformNodeConfig> = {
  system: "workflow",
  type: "transform",
  version: 1,
  displayName: "Transform",
  description: "Transform data using extract, pick, template, or merge operations",
  category: "data",
  size: "compact",

  schema: TransformNodeConfigSchema,
  handles: buildWorkflowHandles("transform"),

  createDefaultData: () => ({
    operation: { type: "template", template: "{{input}}" },
    outputVariable: "transformed",
  }),

  isType: (data): data is TransformNodeConfig => TransformNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowTransformNodeDescriptor);
