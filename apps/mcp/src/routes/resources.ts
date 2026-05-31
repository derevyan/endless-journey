/**
 * Resources Routes
 *
 * Endpoints for listing and reading MCP resources.
 *
 * ## Endpoints
 *
 * - GET  /resources                - List all available resources
 * - POST /resources/list           - List resources with server filters and options
 * - POST /resources/read           - Read a resource by URI
 * - GET  /resource-templates       - List all available resource templates
 * - POST /resource-templates/list  - List resource templates with server filters and options
 *
 * @module routes/resources
 */

import { Hono } from "hono";
import { createLogger } from "@journey/logger";
import { mcpManager } from "../services/mcp-manager";
import {
  getHttpStatus,
  parseListRequest,
  parseJsonBody,
  validateRequiredString,
  validateRequestOptions,
} from "../utils";

const log = createLogger("mcp:routes:resources");

export const resourcesRoutes = new Hono();
export const resourceTemplatesRoutes = new Hono();

// =============================================================================
// ROUTES
// =============================================================================

resourcesRoutes.get("/", async (c) => {
  const resources = await mcpManager.listResources();

  log.debug({ resourceCount: resources.length }, "resources:list");

  return c.json({
    resources,
    count: resources.length,
  });
});

resourcesRoutes.post("/list", async (c) => {
  const body = await parseJsonBody<{ servers?: unknown; options?: unknown }>(c);

  if (!body) {
    return c.json(
      {
        resources: [],
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
        resources: [],
        count: 0,
        error: { code: "INVALID_REQUEST", message: parsed.error },
      },
      400
    );
  }

  const resources = await mcpManager.listResources(parsed.servers, parsed.options);

  log.debug({ resourceCount: resources.length }, "resources:list:options");

  return c.json({
    resources,
    count: resources.length,
  });
});

resourcesRoutes.post("/read", async (c) => {
  const body = await parseJsonBody<{ serverName?: unknown; uri?: unknown; options?: unknown }>(c);

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

  const { serverName, uri, options } = body;

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

  const uriResult = validateRequiredString(uri, "uri");
  if (!uriResult.ok) {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_REQUEST", message: uriResult.error },
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

  const result = await mcpManager.readResource(serverNameResult.value, uriResult.value, optionsResult.options);

  if (!result.success) {
    log.warn({ serverName: serverNameResult.value, error: result.error }, "resources:read:failed");
    return c.json(result, getHttpStatus(result.error?.code));
  }

  log.debug({ serverName: serverNameResult.value, executionTimeMs: result.executionTimeMs }, "resources:read:success");
  return c.json(result);
});

resourceTemplatesRoutes.get("/", async (c) => {
  const templates = await mcpManager.listResourceTemplates();

  log.debug({ templateCount: templates.length }, "resourceTemplates:list");

  return c.json({
    templates,
    count: templates.length,
  });
});

resourceTemplatesRoutes.post("/list", async (c) => {
  const body = await parseJsonBody<{ servers?: unknown; options?: unknown }>(c);

  if (!body) {
    return c.json(
      {
        templates: [],
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
        templates: [],
        count: 0,
        error: { code: "INVALID_REQUEST", message: parsed.error },
      },
      400
    );
  }

  const templates = await mcpManager.listResourceTemplates(parsed.servers, parsed.options);

  log.debug({ templateCount: templates.length }, "resourceTemplates:list:options");

  return c.json({
    templates,
    count: templates.length,
  });
});
