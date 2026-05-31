/**
 * MCP Service Application
 *
 * Standalone Hono app that manages MCP servers and exposes tools via HTTP.
 *
 * @module app
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { createLogger, serializeError } from "@journey/logger";

import { healthRoutes } from "./routes/health";
import { toolsRoutes } from "./routes/tools";
import { serversRoutes } from "./routes/servers";
import { resourcesRoutes, resourceTemplatesRoutes } from "./routes/resources";
import { promptsRoutes } from "./routes/prompts";

const log = createLogger("mcp:app");

// =============================================================================
// CORS CONFIGURATION
// =============================================================================

/**
 * Get allowed CORS origins from environment
 * Default: API server and web app for local development
 */
function getCorsOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim());
  }
  return [
    process.env.API_URL || "http://localhost:3001",
    "http://localhost:3000", // Web app for debugging
  ];
}

// =============================================================================
// APPLICATION FACTORY
// =============================================================================

/**
 * Create the MCP service Hono application
 *
 * Middleware order (important for security and reliability):
 * 1. CORS - Handle preflight requests first
 * 2. Request logging - Log all requests
 * 3. Routes - Handle business logic
 * 4. Error/NotFound handlers - Catch-all for errors
 */
export function createApp() {
  const app = new Hono();

  // ---------------------------------------------------------------------------
  // MIDDLEWARE (order matters!)
  // ---------------------------------------------------------------------------

  // 1. CORS - Must be first to handle preflight requests
  app.use(
    "*",
    cors({
      origin: getCorsOrigins(),
    })
  );

  // 2. Body size limit - Security protection against large payloads
  app.use("*", bodyLimit({ maxSize: 1024 * 1024 })); // 1MB

  // 3. Request logging (development only)
  if (process.env.NODE_ENV !== "production") {
    app.use("*", async (c, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      log.debug({ method: c.req.method, path: c.req.path, status: c.res.status, ms }, "mcp:request");
    });
  }

  // ---------------------------------------------------------------------------
  // ROUTES
  // ---------------------------------------------------------------------------

  // Root endpoint
  app.get("/", (c) => {
    return c.json({
      name: "@journey/mcp-service",
      version: "0.1.0",
      description: "Standalone MCP service for AI agent tools",
      endpoints: {
        health: "/health",
        tools: "/tools",
        servers: "/servers",
        resources: "/resources",
        resourceTemplates: "/resource-templates",
        prompts: "/prompts",
      },
    });
  });

  // API routes
  app.route("/health", healthRoutes);
  app.route("/tools", toolsRoutes);
  app.route("/servers", serversRoutes);
  app.route("/resources", resourcesRoutes);
  app.route("/resource-templates", resourceTemplatesRoutes);
  app.route("/prompts", promptsRoutes);

  // ---------------------------------------------------------------------------
  // ERROR HANDLERS (catch-all)
  // ---------------------------------------------------------------------------

  // Global error handler
  app.onError((err, c) => {
    log.error({ err: serializeError(err), path: c.req.path }, "mcp:error");
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
        },
      },
      500
    );
  });

  // Not found handler
  app.notFound((c) => {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: `Route ${c.req.method} ${c.req.path} not found`,
        },
      },
      404
    );
  });

  return app;
}

export const app = createApp();
