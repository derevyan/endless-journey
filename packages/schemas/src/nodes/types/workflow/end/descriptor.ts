/**
 * Workflow End Node Descriptor (Base)
 */

import { EndNodeConfigSchema, type EndNodeConfig } from "../../../../agents/workflow/nodes/core";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowEndNodeDescriptor: WorkflowNodeDescriptor<EndNodeConfig> = {
  system: "workflow",
  type: "end",
  version: 1,
  displayName: "End",
  description: "Workflow exit point - sends output and terminates",
  category: "core",
  size: "compact",

  schema: EndNodeConfigSchema,
  handles: buildWorkflowHandles("end"),

  createDefaultData: () => ({}),

  isType: (data): data is EndNodeConfig => EndNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowEndNodeDescriptor);
