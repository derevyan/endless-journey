/**
 * @journey/mcp - Model Context Protocol Package
 *
 * Shared library for MCP functionality:
 * - Type definitions for MCP server configuration
 * - HTTP client for communicating with MCP service
 *
 * ## Architecture
 *
 * This package provides the shared types and client code used by:
 * - `apps/mcp` - Standalone MCP service (uses server config types)
 * - `apps/api` - API server (uses client to connect to MCP service)
 * - `packages/llm` - LLM package (uses client for tool loading)
 *
 * @example
 * ```typescript
 * import { initMCPServiceClient, getMCPServiceClient } from "@journey/mcp";
 * import type { MCPServersConfig } from "@journey/mcp";
 *
 * // Initialize client (typically in app startup)
 * initMCPServiceClient({
 *   baseUrl: "http://localhost:3002",
 *   timeout: 30000,
 *   circuitBreakerEnabled: true,
 * });
 *
 * // Use client to get tools
 * const client = getMCPServiceClient();
 * const tools = await client?.getTools() ?? [];
 * ```
 *
 * @module @journey/mcp
 */

// =============================================================================
// CLIENT EXPORTS
// =============================================================================

export {
  MCPServiceClient,
  getMCPServiceClient,
  initMCPServiceClient,
  resetMCPServiceClient,
} from "./client";

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Server configuration types (used by apps/mcp)
export type {
  MCPTransport,
  MCPStdioServerConfig,
  MCPHttpServerConfig,
  MCPServerConfig,
  MCPServersConfig,
  MCPClientOptions,
} from "./types";

// Client types (used by apps/api, packages/llm)
export type {
  MCPErrorCode,
  MCPError,
  MCPRequestOptions,
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPResource,
  MCPResourceTemplate,
  MCPResourceContent,
  MCPPromptArgument,
  MCPPrompt,
  MCPPromptMessageContent,
  MCPPromptMessage,
  MCPPromptResult,
  MCPServerStatus,
  MCPHealthStatus,
  MCPCircuitBreakerConfig,
  MCPServiceClientOptions,
} from "./types";
