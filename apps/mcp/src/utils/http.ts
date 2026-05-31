/**
 * HTTP Utilities
 *
 * Shared HTTP helpers for route handlers.
 *
 * @module utils/http
 */

import type { MCPErrorCode } from "@journey/mcp";

type HTTPErrorStatus = 400 | 404 | 500 | 504;

/**
 * Map MCP error codes to HTTP status codes
 */
export function getHttpStatus(code: MCPErrorCode | undefined): HTTPErrorStatus {
  switch (code) {
    case "INVALID_JSON":
    case "INVALID_REQUEST":
      return 400;
    case "TOOL_NOT_FOUND":
    case "RESOURCE_NOT_FOUND":
    case "PROMPT_NOT_FOUND":
      return 404;
    case "MCP_TIMEOUT":
      return 504;
    case "MCP_NOT_INITIALIZED":
    case "TOOL_EXECUTION_ERROR":
    case "RESOURCE_READ_ERROR":
    case "PROMPT_GET_ERROR":
    default:
      return 500;
  }
}
