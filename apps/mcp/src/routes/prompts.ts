/**
 * Prompts Routes
 *
 * Endpoints for listing and retrieving MCP prompts.
 *
 * ## Endpoints
 *
 * - GET  /prompts      - List all available prompts
 * - POST /prompts/list - List prompts with server filters and options
 * - POST /prompts/get  - Get a prompt by name
 *
 * @module routes/prompts
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

const log = createLogger("mcp:routes:prompts");

export const promptsRoutes = new Hono();

// =============================================================================
// ROUTES
// =============================================================================

promptsRoutes.get("/", async (c) => {
  const prompts = await mcpManager.listPrompts();

  log.debug({ promptCount: prompts.length }, "prompts:list");

  return c.json({
    prompts,
    count: prompts.length,
  });
});

promptsRoutes.post("/list", async (c) => {
  const body = await parseJsonBody<{ servers?: unknown; options?: unknown }>(c);

  if (!body) {
    return c.json(
      {
        prompts: [],
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
        prompts: [],
        count: 0,
        error: { code: "INVALID_REQUEST", message: parsed.error },
      },
      400
    );
  }

  const prompts = await mcpManager.listPrompts(parsed.servers, parsed.options);

  log.debug({ promptCount: prompts.length }, "prompts:list:options");

  return c.json({
    prompts,
    count: prompts.length,
  });
});

promptsRoutes.post("/get", async (c) => {
  const body = await parseJsonBody<{ serverName?: unknown; name?: unknown; args?: unknown; options?: unknown }>(c);

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

  const { serverName, name, args, options } = body;

  const serverNameResult = validateRequiredString(serverName, "serverName");
  if (!serverNameResult.ok) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_REQUEST", message: serverNameResult.error },
        executionTimeMs: 0,
      },
      400
    );
  }

  const nameResult = validateRequiredString(name, "name");
  if (!nameResult.ok) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_REQUEST", message: nameResult.error },
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

  const result = await mcpManager.getPrompt(
    serverNameResult.value,
    nameResult.value,
    (argsResult.value as Record<string, unknown>) || undefined,
    optionsResult.options
  );

  if (!result.success) {
    log.warn({ serverName: serverNameResult.value, error: result.error }, "prompts:get:failed");
    return c.json(result, getHttpStatus(result.error?.code));
  }

  log.debug({ serverName: serverNameResult.value, executionTimeMs: result.executionTimeMs }, "prompts:get:success");
  return c.json(result);
});
