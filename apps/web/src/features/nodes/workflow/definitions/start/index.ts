/**
 * Start Node Definition
 *
 * Workflow entry point - self-registers with the workflow node registry.
 *
 * @module features/nodes/workflow/definitions/start/index
 */

import { Play } from "lucide-react";
import { workflowStartNodeDescriptor } from "@journey/schemas";
import type { StartNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { StartNode } from "./start-node";

const startFrontendDescriptor: FrontendWorkflowNodeDescriptor<StartNodeConfig> = {
  ...workflowStartNodeDescriptor,
  icon: Play,
  color: getWorkflowNodeColor("start"),
  component: StartNode,
};

workflowNodeRegistry.register(startFrontendDescriptor);
