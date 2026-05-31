/**
 * Workflow MCP Node Descriptor (Base)
 */

import { MCPNodeConfigSchema, type MCPNodeConfig } from "../../../../agents/workflow/nodes/tools";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowMcpNodeDescriptor: WorkflowNodeDescriptor<MCPNodeConfig> = {
  system: "workflow",
  type: "mcp",
  version: 1,
  displayName: "MCP",
  description: "Call external MCP server tool",
  category: "tools",
  size: "compact",

  schema: MCPNodeConfigSchema,
  handles: buildWorkflowHandles("mcp"),

  createDefaultData: () => ({
    server: "default",
    tool: "select_tool",
    params: {},
    timeout: 30000,
    onError: "fail",
    maxRetries: 1,
  }),

  isType: (data): data is MCPNodeConfig => MCPNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowMcpNodeDescriptor);
