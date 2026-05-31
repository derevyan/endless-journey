/**
 * Type Definitions for @langchain/mcp-adapters
 *
 * The @langchain/mcp-adapters package doesn't export proper types,
 * so we define them here for type safety.
 *
 * @module types/langchain-mcp
 */

import type { MCPServersConfig } from "@journey/mcp";

/**
 * Options for MultiServerMCPClient constructor
 */
export interface MultiServerMCPClientOptions {
  throwOnLoadError?: boolean;
  prefixToolNameWithServerName?: boolean;
  mcpServers: MCPServersConfig;
}

/**
 * Raw tool as returned by LangChain MCP adapter
 */
export interface MCPRawTool {
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
  invoke(args: Record<string, unknown>): Promise<unknown>;
}

/**
 * Transport options for MCP operations
 */
export interface MCPTransportOptions {
  headers?: Record<string, string>;
}

/**
 * Server client for direct MCP server operations
 */
export interface MCPServerClient {
  listPrompts(): Promise<{ prompts?: unknown[] }>;
  getPrompt(params: { name: string; arguments?: unknown }): Promise<{
    description?: string;
    messages?: Array<{ role: "user" | "assistant"; content: unknown }>;
  }>;
}

/**
 * MultiServerMCPClient interface (based on @langchain/mcp-adapters)
 */
export interface MultiServerMCPClient {
  getTools(servers?: string[], options?: MCPTransportOptions): Promise<MCPRawTool[]>;
  listResources(
    servers?: string[],
    options?: MCPTransportOptions
  ): Promise<Record<string, unknown[]>>;
  listResourceTemplates(
    servers?: string[],
    options?: MCPTransportOptions
  ): Promise<Record<string, unknown[]>>;
  readResource(
    server: string,
    uri: string,
    options?: MCPTransportOptions
  ): Promise<unknown[]>;
  getClient(server: string, options?: MCPTransportOptions): Promise<MCPServerClient | null>;
  close(): Promise<void>;
}
