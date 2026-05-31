/**
 * MCP Node Definition
 * @module features/nodes/workflow/definitions/mcp/index
 */

import { Plug } from "lucide-react";
import { workflowMcpNodeDescriptor } from "@journey/schemas";
import type { MCPNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { MCPNode } from "./mcp-node";
import { MCPNodeConfig as MCPNodeEditor } from "./mcp-node-config";
import { mcpFormHandlers } from "./form";

const mcpFrontendDescriptor: FrontendWorkflowNodeDescriptor<MCPNodeConfig> = {
  ...workflowMcpNodeDescriptor,
  icon: Plug,
  color: getWorkflowNodeColor("mcp"),
  component: MCPNode,
  editor: MCPNodeEditor,
  formHandlers: mcpFormHandlers,
};

workflowNodeRegistry.register(mcpFrontendDescriptor);
