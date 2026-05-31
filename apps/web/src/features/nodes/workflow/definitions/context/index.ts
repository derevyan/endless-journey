/**
 * Context Node Definition
 * @module features/nodes/workflow/definitions/context/index
 */

import { BookOpen } from "lucide-react";
import { workflowContextNodeDescriptor } from "@journey/schemas";
import type { ContextNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { ContextNode } from "./context-node";
import { ContextNodeConfig as ContextNodeEditor } from "./context-node-config";
import { contextFormHandlers } from "./form";

const contextFrontendDescriptor: FrontendWorkflowNodeDescriptor<ContextNodeConfig> = {
  ...workflowContextNodeDescriptor,
  icon: BookOpen,
  color: getWorkflowNodeColor("context"),
  component: ContextNode,
  editor: ContextNodeEditor,
  formHandlers: contextFormHandlers,
};

workflowNodeRegistry.register(contextFrontendDescriptor);
