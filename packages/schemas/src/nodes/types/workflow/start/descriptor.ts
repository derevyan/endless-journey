/**
 * Workflow Start Node Descriptor (Base)
 */

import { StartNodeConfigSchema, type StartNodeConfig } from "../../../../agents/workflow/nodes/core";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowStartNodeDescriptor: WorkflowNodeDescriptor<StartNodeConfig> = {
  system: "workflow",
  type: "start",
  version: 1,
  displayName: "Start",
  description: "Workflow entry point - execution begins here",
  category: "core",
  size: "compact",

  schema: StartNodeConfigSchema,
  handles: buildWorkflowHandles("start"),

  createDefaultData: () => ({}),

  isType: (data): data is StartNodeConfig => StartNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowStartNodeDescriptor);
