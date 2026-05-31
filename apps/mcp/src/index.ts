/**
 * MCP Service Entry Point
 *
 * Standalone service that manages MCP (Model Context Protocol) servers
 * and exposes tools via HTTP for the Journey API.
 *
 * ## Endpoints
 *
 * - GET  /health    - Health check with server status
 * - GET  /tools     - List available tools
 * - POST /tools/call - Execute a tool
 * - GET  /servers   - List configured MCP servers
 *
 * ## Architecture
 *
 * This service runs independently from the API server, providing:
 * - Fault isolation: MCP crashes don't affect the API
 * - Independent lifecycle: Can restart without affecting the API
 * - Clean separation: Each service has single responsibility
 *
 * @module mcp-service
 */

// Load environment variables first
import "dotenv/config";

import { serve } from "@hono/node-server";
import { createLogger, serializeError } from "@journey/logger";

import { app } from "./app";
import { getMCPServersConfig } from "./config/mcp-servers";
import { mcpManager } from "./services/mcp-manager";
import { withTimeout } from "./utils";

const log = createLogger("mcp:service");

// =============================================================================
// SERVICE INITIALIZATION
// =============================================================================

async function initializeServices(): Promise<void> {
  log.info({ env: process.env.NODE_ENV }, "mcp:boot");

  // Initialize MCP manager with configured servers
  try {
    const config = getMCPServersConfig();
    const serverCount = Object.keys(config).length;

    if (serverCount > 0) {
      await mcpManager.init(config);
      log.info({ serverCount, servers: Object.keys(config) }, "mcp:mcpManager:initialized");
    } else {
      log.warn({}, "mcp:mcpManager:noServers");
    }
  } catch (error) {
    log.error({ err: serializeError(error) }, "mcp:mcpManager:initFailed");
    // Don't exit - service can still run, just without MCP tools
    log.warn({}, "mcp:mcpManager:degraded - MCP tools will not be available");
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum time to wait for graceful shutdown (10 seconds) */
const SHUTDOWN_TIMEOUT_MS = 10_000;

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

async function gracefulShutdown(signal: string): Promise<void> {
  log.info({ signal }, "mcp:shutdown:starting");

  try {
    // Close MCP manager with timeout protection
    await withTimeout(mcpManager.close(), SHUTDOWN_TIMEOUT_MS, "MCP shutdown");
    log.info({}, "mcp:shutdown:complete");
    process.exit(0);
  } catch (error) {
    log.error({ err: serializeError(error) }, "mcp:shutdown:error");
    // Force exit on timeout or error
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// =============================================================================
// SERVER START
// =============================================================================

const port = parseInt(process.env.PORT || "3002", 10);

// Initialize services then start server
initializeServices().then(() => {
  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      log.info({ port: info.port, url: `http://localhost:${info.port}` }, "mcp:server:started");
    }
  );
});

export default app;
