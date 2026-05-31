/**
 * Workflow Set State Node Descriptor (Base)
 */

import { SetStateNodeConfigSchema, type SetStateNodeConfig } from "../../../../agents/workflow/nodes/data";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowSetStateNodeDescriptor: WorkflowNodeDescriptor<SetStateNodeConfig> = {
  system: "workflow",
  type: "set_state",
  version: 1,
  displayName: "Set State",
  description: "Store a variable for use in downstream nodes",
  category: "data",
  size: "compact",

  schema: SetStateNodeConfigSchema,
  handles: buildWorkflowHandles("set_state"),

  createDefaultData: () => ({
    key: "myVariable",
    value: "",
    isTemplate: false,
  }),

  isType: (data): data is SetStateNodeConfig => SetStateNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowSetStateNodeDescriptor);
