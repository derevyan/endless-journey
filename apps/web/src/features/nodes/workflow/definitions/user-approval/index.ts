/**
 * User Approval Node Definition
 * @module features/nodes/workflow/definitions/user-approval/index
 */

import { UserCheck } from "lucide-react";
import { workflowUserApprovalNodeDescriptor } from "@journey/schemas";
import type { UserApprovalNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { UserApprovalNode } from "./user-approval-node";
import { UserApprovalNodeConfig as UserApprovalNodeEditor } from "./user-approval-node-config";
import { userApprovalFormHandlers } from "./form";

const userApprovalFrontendDescriptor: FrontendWorkflowNodeDescriptor<UserApprovalNodeConfig> = {
  ...workflowUserApprovalNodeDescriptor,
  icon: UserCheck,
  color: getWorkflowNodeColor("user_approval"),
  component: UserApprovalNode,
  editor: UserApprovalNodeEditor,
  formHandlers: userApprovalFormHandlers,
};

workflowNodeRegistry.register(userApprovalFrontendDescriptor);
