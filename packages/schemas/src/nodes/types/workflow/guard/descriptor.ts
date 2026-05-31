/**
 * Workflow Guard Node Descriptor (Base)
 */

import { GuardNodeConfigSchema, type GuardNodeConfig } from "../../../../agents/workflow/nodes/tools";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowGuardNodeDescriptor: WorkflowNodeDescriptor<GuardNodeConfig> = {
  system: "workflow",
  type: "guard",
  version: 1,
  displayName: "Guard",
  description: "Safety check using LLM Guard workers",
  category: "tools",
  size: "compact",

  schema: GuardNodeConfigSchema,
  handles: buildWorkflowHandles("guard"),

  createDefaultData: () => ({
    workers: ["safety_guard"],
    blockedMessage: "I cannot help with that request.",
    terminateOnBlock: true,
  }),

  isType: (data): data is GuardNodeConfig => GuardNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowGuardNodeDescriptor);
