/**
 * Agent Tools Routes
 *
 * REST API for retrieving available agent tools for the workflow builder.
 * Provides dynamic discovery of all tool types:
 * - System tools: Context-aware tools (memory, variables, messaging)
 * - Utility tools: In-process standalone tools (current_time, web_search)
 * - MCP tools: External server tools (fetch, filesystem)
 *
 * Endpoints:
 * - GET /api/llm/tools - List all available tools
 * - GET /api/llm/tools/categories - Get tools grouped by category
 * - GET /api/llm/tools/available - Get only available tools
 *
 * Auth: Protected (workflow:read)
 *
 * @module modules/llm/routes/tools
 */

import { unifiedToolRegistry } from "@journey/llm/tools/unified";
import { createLogger, serializeError } from "@journey/logger";
import { ServiceUnavailableError } from "@journey/schemas";

import { createProtectedRouter } from "../../../lib/protected-router";

const log = createLogger("api:llm:tools");

export const tools = createProtectedRouter({
  defaultPermission: { resource: "workflow", action: "read" },
});

// =============================================================================
// TOOL DISCOVERY ENDPOINTS
// =============================================================================

/**
 * GET /api/llm/tools - List all available tools
 *
 * Returns all agent tools with metadata for the workflow builder UI.
 * Includes system, utility, and MCP tools with availability status.
 *
 * Query params:
 * - refresh: Set to "true" to force refresh MCP tools cache
 *
 * Response:
 * {
 *   tools: UnifiedToolDefinition[],
 *   metadata: {
 *     count: { total, system, utility, mcp },
 *     timestamp: string
 *   }
 * }
 */
tools.get("/", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");

  try {
    const refreshMCP = c.req.query("refresh") === "true";

    const definitions = await unifiedToolRegistry.getAllDefinitions(refreshMCP);

    // Count by source
    const systemCount = definitions.filter((d) => d.source === "system").length;
    const utilityCount = definitions.filter((d) => d.source === "utility").length;
    const mcpCount = definitions.filter((d) => d.source === "mcp").length;

    log.debug(
      {
        userId: user.id,
        organizationId: organization.id,
        total: definitions.length,
        system: systemCount,
        utility: utilityCount,
        mcp: mcpCount,
        refreshed: refreshMCP,
      },
      "tools:list"
    );

    return c.json({
      tools: definitions,
      metadata: {
        count: {
          total: definitions.length,
          system: systemCount,
          utility: utilityCount,
          mcp: mcpCount,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error({ err: serializeError(error) }, "tools:list:error");
    throw new ServiceUnavailableError("Failed to fetch tools", error);
  }
});

/**
 * GET /api/llm/tools/categories - Get tools grouped by category
 *
 * Returns tools organized by category for the workflow builder UI.
 * Useful for displaying category-based tool selection.
 *
 * Response:
 * {
 *   categories: {
 *     memory: UnifiedToolDefinition[],
 *     variables: UnifiedToolDefinition[],
 *     search: UnifiedToolDefinition[],
 *     utility: UnifiedToolDefinition[],
 *     external: UnifiedToolDefinition[]
 *   }
 * }
 */
tools.get("/categories", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");

  try {
    const definitions = await unifiedToolRegistry.getAllDefinitions();

    // Group by category
    const categories: Record<string, typeof definitions> = {};
    for (const def of definitions) {
      if (!categories[def.category]) {
        categories[def.category] = [];
      }
      categories[def.category].push(def);
    }

    log.debug(
      {
        userId: user.id,
        organizationId: organization.id,
        categoryCount: Object.keys(categories).length,
        categories: Object.entries(categories).map(([cat, tools]) => ({
          category: cat,
          count: tools.length,
        })),
      },
      "tools:categories"
    );

    return c.json({ categories });
  } catch (error) {
    log.error({ err: serializeError(error) }, "tools:categories:error");
    throw new ServiceUnavailableError("Failed to fetch tools", error);
  }
});

/**
 * GET /api/llm/tools/available - Get only available tools
 *
 * Returns only tools that can be used right now (API keys configured, services available).
 * Useful for filtering out unconfigured tools in the UI.
 *
 * Response:
 * {
 *   tools: UnifiedToolDefinition[]
 * }
 */
tools.get("/available", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");

  try {
    const definitions = await unifiedToolRegistry.getAvailableDefinitions();

    log.debug(
      {
        userId: user.id,
        organizationId: organization.id,
        count: definitions.length,
      },
      "tools:available"
    );

    return c.json({ tools: definitions });
  } catch (error) {
    log.error({ err: serializeError(error) }, "tools:available:error");
    throw new ServiceUnavailableError("Failed to fetch available tools", error);
  }
});
