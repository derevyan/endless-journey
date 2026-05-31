/**
 * End Node Definition
 * @module features/nodes/workflow/definitions/end/index
 */

import { Square } from "lucide-react";
import { workflowEndNodeDescriptor } from "@journey/schemas";
import type { EndNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { EndNode } from "./end-node";
import { EndNodeConfig as EndNodeEditor } from "./end-node-config";
import { endFormHandlers } from "./form";

const endFrontendDescriptor: FrontendWorkflowNodeDescriptor<EndNodeConfig> = {
  ...workflowEndNodeDescriptor,
  icon: Square,
  color: getWorkflowNodeColor("end"),
  component: EndNode,
  editor: EndNodeEditor,
  formHandlers: endFormHandlers,
};

workflowNodeRegistry.register(endFrontendDescriptor);
