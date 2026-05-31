/**
 * Agent Node Definition
 * @module features/nodes/workflow/definitions/agent/index
 */

import { Bot } from "lucide-react";
import { workflowAgentNodeDescriptor } from "@journey/schemas";
import type { AgentNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { AgentNode } from "./agent-node";
import { AgentNodeConfig as AgentNodeEditor } from "./agent-node-config";
import { agentFormHandlers } from "./form";

const agentFrontendDescriptor: FrontendWorkflowNodeDescriptor<AgentNodeConfig> = {
  ...workflowAgentNodeDescriptor,
  icon: Bot,
  color: getWorkflowNodeColor("agent"),
  component: AgentNode,
  editor: AgentNodeEditor,
  formHandlers: agentFormHandlers,
};

workflowNodeRegistry.register(agentFrontendDescriptor);
