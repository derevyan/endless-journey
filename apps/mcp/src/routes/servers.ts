/**
 * Servers Routes
 *
 * Endpoints for listing configured MCP servers.
 *
 * @module routes/servers
 */

import { Hono } from "hono";
import { createLogger, serializeError } from "@journey/logger";
import { mcpManager } from "../services/mcp-manager";

const log = createLogger("mcp:routes:servers");

export const serversRoutes = new Hono();

/**
 * GET /servers - List configured MCP servers
 *
 * Returns server names and their connection status.
 */
serversRoutes.get("/", async (c) => {
  try {
    const servers = await mcpManager.getServerStatus();

    return c.json({
      servers,
      count: servers.length,
    });
  } catch (error) {
    log.error({ err: serializeError(error) }, "servers:statusFailed");
    return c.json(
      {
        servers: [],
        count: 0,
        error: {
          code: "MCP_NOT_INITIALIZED",
          message: "Failed to get server status",
        },
      },
      500
    );
  }
});
