/**
 * Agent Workflow Node Definition
 *
 * Delegates to Agent Workflows for all agent logic.
 * Self-registers with the node registry.
 *
 * Execution Modes:
 * - welcome_first: Send welcome message, wait for user input, then execute (default for new nodes)
 * - immediate: Execute workflow immediately
 * - wait_for_input: Wait for user message before any execution
 */

import { Bot } from "lucide-react";
import { agentNodeDescriptor, type AgentNodeData, type AgentState } from "@journey/schemas";

import { getNodeTheme } from "../../config/node-theme";
import { frontendNodeRegistry as nodeRegistry, type FrontendNodeDescriptor } from "../../registry/frontend-descriptor";
import { AgentNode } from "./component";
import { AgentNodeEditor } from "./editor";
import { agentFormHandlers } from "./form";

const agentFrontendDescriptor: FrontendNodeDescriptor<AgentNodeData, AgentState> = {
  ...agentNodeDescriptor,
  icon: Bot,
  colors: getNodeTheme("agent"),
  formHandlers: agentFormHandlers,
  component: AgentNode,
  editor: AgentNodeEditor,
};

nodeRegistry.register(agentFrontendDescriptor);
