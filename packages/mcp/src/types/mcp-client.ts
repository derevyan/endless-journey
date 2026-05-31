/**
 * MCP Service Client Types
 *
 * Types for communicating with the standalone MCP service via HTTP.
 *
 * @module @journey/mcp/types/mcp-client
 */

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Standard error codes for MCP operations
 *
 * Used for consistent error handling across the MCP client and service.
 */
export type MCPErrorCode =
  | "MCP_HTTP_ERROR" // HTTP request failed (4xx, 5xx)
  | "MCP_UNAVAILABLE" // Service unreachable or circuit breaker open
  | "MCP_TIMEOUT" // Request timed out
  | "MCP_NOT_INITIALIZED" // Client not initialized
  | "TOOL_NOT_FOUND" // Requested tool doesn't exist
  | "TOOL_EXECUTION_ERROR" // Tool execution failed
  | "RESOURCE_NOT_FOUND" // Requested resource doesn't exist
  | "RESOURCE_READ_ERROR" // Resource read failed
  | "PROMPT_NOT_FOUND" // Requested prompt doesn't exist
  | "PROMPT_GET_ERROR" // Prompt retrieval failed
  | "INVALID_REQUEST" // Malformed request
  | "INVALID_JSON"; // Invalid JSON in request body

/**
 * Structured error for MCP operations
 */
export interface MCPError {
  /** Error code for programmatic handling */
  code: MCPErrorCode;
  /** Human-readable error message */
  message: string;
}

/**
 * Optional request options for MCP calls
 */
export interface MCPRequestOptions {
  /** Custom headers for per-request authentication */
  headers?: Record<string, string>;
  /** Optional timeout for this request in milliseconds (overrides client default) */
  timeout?: number;
}

// =============================================================================
// TOOL TYPES
// =============================================================================

/**
 * Tool as returned by MCP service
 */
export interface MCPTool {
  /** Tool name (may include server prefix like "fetch_fetch") */
  name: string;
  /** Tool description for LLM context */
  description: string;
  /** JSON schema for tool arguments */
  schema: Record<string, unknown>;
  /** Server that provides this tool */
  serverName: string;
}

/**
 * Request to execute a tool
 */
export interface MCPToolCallRequest {
  /** Name of the tool to call */
  toolName: string;
  /** Arguments to pass to the tool */
  args: Record<string, unknown>;
  /** Optional per-request connection options */
  options?: MCPRequestOptions;
}

/**
 * Response from tool execution
 */
export interface MCPToolCallResponse {
  /** Whether the tool call succeeded */
  success: boolean;
  /** Tool result (if successful) */
  result?: unknown;
  /** Error information (if failed) */
  error?: MCPError;
  /** Execution time in milliseconds */
  executionTimeMs: number;
}

// =============================================================================
// RESOURCE TYPES
// =============================================================================

/**
 * Resource as returned by MCP service
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverName: string;
}

/**
 * Resource template as returned by MCP service
 */
export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverName: string;
}

/**
 * Resource content result
 */
export interface MCPResourceContent {
  uri: string;
  text?: string;
  blob?: string;
  mimeType?: string;
  serverName: string;
}

// =============================================================================
// PROMPT TYPES
// =============================================================================

/**
 * Prompt argument definition
 */
export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Prompt metadata returned in list calls
 */
export interface MCPPrompt {
  name: string;
  title?: string;
  description?: string;
  arguments?: MCPPromptArgument[];
  serverName: string;
}

export interface MCPPromptMessageContentText {
  type: "text";
  text: string;
}

export interface MCPPromptMessageContentImage {
  type: "image";
  data: string;
  mimeType: string;
}

export interface MCPPromptMessageContentAudio {
  type: "audio";
  data: string;
  mimeType: string;
}

export interface MCPPromptMessageContentResource {
  type: "resource";
  resource: {
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  };
}

export interface MCPPromptMessageContentResourceLink {
  type: "resource_link";
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export type MCPPromptMessageContent =
  | MCPPromptMessageContentText
  | MCPPromptMessageContentImage
  | MCPPromptMessageContentAudio
  | MCPPromptMessageContentResource
  | MCPPromptMessageContentResourceLink;

export interface MCPPromptMessage {
  role: "user" | "assistant";
  content: MCPPromptMessageContent[];
}

/**
 * Prompt execution result
 */
export interface MCPPromptResult {
  description?: string;
  messages: MCPPromptMessage[];
  serverName: string;
}

/**
 * Server status in health check
 */
export interface MCPServerStatus {
  /** Server name */
  name: string;
  /** Connection status */
  status: "connected" | "disconnected" | "error";
  /** Number of tools provided by this server */
  toolCount: number;
  /** Last error message (if any) */
  lastError?: string;
}

/**
 * Health status of MCP service
 */
export interface MCPHealthStatus {
  /** Overall service status */
  status: "healthy" | "degraded" | "unhealthy";
  /** Individual server statuses */
  servers: MCPServerStatus[];
  /** Timestamp of health check */
  timestamp: string;
}

// =============================================================================
// CLIENT OPTIONS
// =============================================================================

/**
 * Circuit breaker configuration
 */
export interface MCPCircuitBreakerConfig {
  /** Percentage of failures that triggers the circuit breaker (default: 50) */
  errorThresholdPercentage?: number;
  /** Time in ms before attempting to close the circuit (default: 30000) */
  resetTimeout?: number;
}

/**
 * Options for initializing MCPServiceClient
 */
export interface MCPServiceClientOptions {
  /** Base URL of the MCP service (e.g., "http://localhost:3002") */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable circuit breaker for fault tolerance (default: true) */
  circuitBreakerEnabled?: boolean;
  /** Circuit breaker configuration (optional) */
  circuitBreaker?: MCPCircuitBreakerConfig;
}
