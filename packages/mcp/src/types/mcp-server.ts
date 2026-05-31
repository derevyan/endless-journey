/**
 * MCP Server Configuration Types
 *
 * Types for configuring MCP (Model Context Protocol) servers.
 * Servers can use stdio transport (local subprocess) or HTTP/SSE (remote).
 *
 * @module @journey/mcp/types/mcp-server
 */

/**
 * MCP server transport types
 */
export type MCPTransport = "stdio" | "http" | "sse" | "streamable_http";

/**
 * MCP server configuration for stdio transport
 * Used for servers running as local subprocesses
 */
export interface MCPStdioServerConfig {
  transport: "stdio";
  /** Command to run the server (e.g., "npx", "node", "python") */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables for the server */
  env?: Record<string, string>;
  /** Restart configuration */
  restart?: {
    enabled: boolean;
    maxAttempts?: number;
    delayMs?: number;
  };
}

/**
 * MCP server configuration for HTTP/SSE transport
 * Used for remote servers
 */
export interface MCPHttpServerConfig {
  transport: "http" | "sse" | "streamable_http";
  /** Server URL */
  url: string;
  /** Optional headers (e.g., authorization) */
  headers?: Record<string, string>;
}

/**
 * Union of MCP server configurations
 */
export type MCPServerConfig = MCPStdioServerConfig | MCPHttpServerConfig;

/**
 * MCP servers configuration map
 * Key is server name, value is server config
 */
export interface MCPServersConfig {
  [serverName: string]: MCPServerConfig;
}

/**
 * MCP client options for MultiServerMCPClient
 */
export interface MCPClientOptions {
  /** Server configurations */
  servers: MCPServersConfig;
  /** Whether to throw on connection errors */
  throwOnLoadError?: boolean;
  /** What to do when a connection fails: "throw" | "warn" | "ignore" */
  onConnectionError?: "throw" | "warn" | "ignore";
  /** Prefix tool names with server name for uniqueness */
  prefixToolNameWithServerName?: boolean;
}
