/**
 * Guard Node Definition
 * @module features/nodes/workflow/definitions/guard/index
 */

import { Shield } from "lucide-react";
import { workflowGuardNodeDescriptor } from "@journey/schemas";
import type { GuardNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { GuardNode } from "./guard-node";
import { GuardNodeConfig as GuardNodeEditor } from "./guard-node-config";
import { guardFormHandlers } from "./form";

const guardFrontendDescriptor: FrontendWorkflowNodeDescriptor<GuardNodeConfig> = {
  ...workflowGuardNodeDescriptor,
  icon: Shield,
  color: getWorkflowNodeColor("guard"),
  component: GuardNode,
  editor: GuardNodeEditor,
  formHandlers: guardFormHandlers,
};

workflowNodeRegistry.register(guardFrontendDescriptor);
