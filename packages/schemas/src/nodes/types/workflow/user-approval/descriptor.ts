/**
 * Workflow User Approval Node Descriptor (Base)
 */

import { UserApprovalNodeConfigSchema, type UserApprovalNodeConfig } from "../../../../agents/workflow/nodes/logic";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowUserApprovalNodeDescriptor: WorkflowNodeDescriptor<UserApprovalNodeConfig> = {
  system: "workflow",
  type: "user_approval",
  version: 1,
  displayName: "User Approval",
  description: "Human-in-the-loop approval gate with timeout",
  category: "logic",
  size: "compact",

  schema: UserApprovalNodeConfigSchema,
  handles: buildWorkflowHandles("user_approval"),

  createDefaultData: () => ({
    message: "Please review and approve this action.",
    timeoutSeconds: 300,
    timeoutAction: "skip",
  }),

  isType: (data): data is UserApprovalNodeConfig => UserApprovalNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowUserApprovalNodeDescriptor);
