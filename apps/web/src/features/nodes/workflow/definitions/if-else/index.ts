/**
 * If/Else Node Definition
 * @module features/nodes/workflow/definitions/if-else/index
 */

import { GitBranch } from "lucide-react";
import { workflowIfElseNodeDescriptor } from "@journey/schemas";
import type { IfElseNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { IfElseNode } from "./if-else-node";
import { IfElseNodeConfig as IfElseNodeEditor } from "./if-else-node-config";
import { ifElseFormHandlers } from "./form";

const ifElseFrontendDescriptor: FrontendWorkflowNodeDescriptor<IfElseNodeConfig> = {
  ...workflowIfElseNodeDescriptor,
  icon: GitBranch,
  color: getWorkflowNodeColor("if_else"),
  component: IfElseNode,
  editor: IfElseNodeEditor,
  formHandlers: ifElseFormHandlers,
};

workflowNodeRegistry.register(ifElseFrontendDescriptor);
