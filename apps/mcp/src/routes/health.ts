/**
 * Health Routes
 *
 * Health check endpoint for monitoring MCP service status.
 *
 * @module routes/health
 */

import { Hono } from "hono";
import { createLogger, serializeError } from "@journey/logger";
import { mcpManager } from "../services/mcp-manager";

const log = createLogger("mcp:routes:health");

export const healthRoutes = new Hono();

/**
 * GET /health - Health check with service status
 *
 * Returns:
 * - "healthy": MCP initialized and all servers connected
 * - "degraded": MCP initialized but some servers disconnected/error
 * - "unhealthy": MCP not initialized or error occurred
 */
healthRoutes.get("/", async (c) => {
  try {
    const servers = await mcpManager.getServerStatus();
    const isInitialized = mcpManager.isInitialized();

    // Determine overall status
    let status: "healthy" | "degraded" | "unhealthy";

    if (!isInitialized) {
      // Not initialized = unhealthy
      status = "unhealthy";
    } else if (servers.length === 0) {
      // No servers configured = healthy (nothing to fail)
      status = "healthy";
    } else if (servers.some((s) => s.status === "error" || s.status === "disconnected")) {
      // Any server with errors or disconnected = degraded
      status = "degraded";
    } else {
      // All servers connected = healthy
      status = "healthy";
    }

    return c.json({
      status,
      servers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ err: serializeError(error) }, "health:statusFailed");
    return c.json({
      status: "unhealthy",
      servers: [],
      timestamp: new Date().toISOString(),
    });
  }
});
