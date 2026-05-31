/**
 * MCP Types
 *
 * Re-exports all MCP type definitions.
 *
 * @module @journey/mcp/types
 */

// Server configuration types
export type {
  MCPTransport,
  MCPStdioServerConfig,
  MCPHttpServerConfig,
  MCPServerConfig,
  MCPServersConfig,
  MCPClientOptions,
} from "./mcp-server";

// Client types (for HTTP communication)
export type {
  // Error types
  MCPErrorCode,
  MCPError,
  MCPRequestOptions,
  // Tool types
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResponse,
  // Resource types
  MCPResource,
  MCPResourceTemplate,
  MCPResourceContent,
  // Prompt types
  MCPPromptArgument,
  MCPPrompt,
  MCPPromptMessageContent,
  MCPPromptMessage,
  MCPPromptResult,
  // Health types
  MCPServerStatus,
  MCPHealthStatus,
  // Client options
  MCPCircuitBreakerConfig,
  MCPServiceClientOptions,
} from "./mcp-client";
