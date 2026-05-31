/**
 * Tools Routes
 *
 * Endpoints for listing and executing MCP tools.
 *
 * ## Endpoints
 *
 * - GET  /tools      - List all available tools
 * - POST /tools/list - List tools with server filters and options
 * - POST /tools/call - Execute a tool by name
 *
 * ## Error Codes
 *
 * | HTTP | Code                  | Description                    |
 * |------|-----------------------|--------------------------------|
 * | 400  | INVALID_JSON          | Request body is not valid JSON |
 * | 400  | INVALID_REQUEST       | Missing or invalid toolName    |
 * | 404  | TOOL_NOT_FOUND        | Tool doesn't exist             |
 * | 500  | MCP_NOT_INITIALIZED   | MCP manager not ready          |
 * | 500  | TOOL_EXECUTION_ERROR  | Tool threw an error            |
 *
 * @module routes/tools
 */

import { Hono } from "hono";
import { createLogger } from "@journey/logger";
import { mcpManager } from "../services/mcp-manager";
import {
  getHttpStatus,
  parseListRequest,
  parseJsonBody,
  validateRequiredString,
  validateOptionalObject,
  validateRequestOptions,
} from "../utils";

const log = createLogger("mcp:routes:tools");

export const toolsRoutes = new Hono();

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /tools - List all available tools
 *
 * Returns array of tools with their schemas and server information.
 */
toolsRoutes.get("/", async (c) => {
  const tools = await mcpManager.getTools();

  log.debug({ toolCount: tools.length }, "tools:list");

  return c.json({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      schema: t.schema,
      serverName: t.serverName,
    })),
    count: tools.length,
  });
});

/**
 * POST /tools/list - List tools with per-request options
 *
 * Request body:
 * ```json
 * {
 *   "servers": ["fetch"],
 *   "options": { "headers": { "Authorization": "Bearer ..." } }
 * }
 * ```
 */
toolsRoutes.post("/list", async (c) => {
  const body = await parseJsonBody<{ servers?: unknown; options?: unknown }>(c);

  if (!body) {
    return c.json(
      {
        tools: [],
        count: 0,
        error: { code: "INVALID_JSON", message: "Request body must be valid JSON" },
      },
      400
    );
  }

  const parsed = parseListRequest(body);
  if (!parsed.ok) {
    return c.json(
      {
        tools: [],
        count: 0,
        error: { code: "INVALID_REQUEST", message: parsed.error },
      },
      400
    );
  }

  const tools = await mcpManager.getTools(parsed.servers, parsed.options);

  log.debug({ toolCount: tools.length }, "tools:list:options");

  return c.json({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      schema: t.schema,
      serverName: t.serverName,
    })),
    count: tools.length,
  });
});

/**
 * POST /tools/call - Execute a tool
 *
 * Request body:
 * ```json
 * {
 *   "toolName": "fetch_fetch",
 *   "args": { "url": "https://example.com" }
 * }
 * ```
 *
 * Response (success):
 * ```json
 * {
 *   "success": true,
 *   "result": "...",
 *   "executionTimeMs": 1234
 * }
 * ```
 *
 * Response (error):
 * ```json
 * {
 *   "success": false,
 *   "error": { "code": "TOOL_NOT_FOUND", "message": "..." },
 *   "executionTimeMs": 5
 * }
 * ```
 */
toolsRoutes.post("/call", async (c) => {
  const body = await parseJsonBody<{ toolName?: unknown; args?: unknown; options?: unknown }>(c);

  if (!body) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_JSON", message: "Request body must be valid JSON" },
        executionTimeMs: 0,
      },
      400
    );
  }

  const { toolName, args, options } = body;

  const toolNameResult = validateRequiredString(toolName, "toolName");
  if (!toolNameResult.ok) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_REQUEST", message: toolNameResult.error },
        executionTimeMs: 0,
      },
      400
    );
  }

  const argsResult = validateOptionalObject(args, "args");
  if (!argsResult.ok) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_REQUEST", message: argsResult.error },
        executionTimeMs: 0,
      },
      400
    );
  }

  const optionsResult = validateRequestOptions(options);
  if (!optionsResult.ok) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_REQUEST", message: optionsResult.error },
        executionTimeMs: 0,
      },
      400
    );
  }

  log.debug({ toolName: toolNameResult.value, hasArgs: !!args }, "tools:call:start");

  const result = await mcpManager.callTool(
    toolNameResult.value,
    (argsResult.value as Record<string, unknown>) || {},
    optionsResult.options
  );

  if (!result.success) {
    log.warn({ toolName: toolNameResult.value, error: result.error }, "tools:call:failed");
    return c.json(result, getHttpStatus(result.error?.code));
  }

  log.debug({ toolName: toolNameResult.value, executionTimeMs: result.executionTimeMs }, "tools:call:success");
  return c.json(result);
});
