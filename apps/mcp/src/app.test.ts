/**
 * MCP Service Integration Tests
 *
 * Tests the HTTP endpoints of the MCP service.
 * These tests run against the Hono app directly (no server required).
 *
 * ## Test Categories
 *
 * 1. Endpoint tests - Basic functionality of each endpoint
 * 2. Error handling - Validation, 404s, tool not found
 * 3. Health status - Degraded state detection
 *
 * @module tests/app
 */

import { describe, it, expect } from "vitest";
import { app } from "./app";

// =============================================================================
// TYPE HELPERS
// =============================================================================

/**
 * Parse JSON response with type assertion
 */
async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

// Response types for type-safe testing
interface ServiceInfoResponse {
  name: string;
  version: string;
  description: string;
  endpoints: {
    health: string;
    tools: string;
    servers: string;
  };
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  servers: Array<{ name: string; status: string; toolCount: number }>;
  timestamp: string;
}

interface ToolsResponse {
  tools: Array<{ name: string; description: string; schema: unknown; serverName: string }>;
  count: number;
}

interface ServersResponse {
  servers: Array<{ name: string }>;
  count: number;
}

interface ToolCallResponse {
  success: boolean;
  result?: unknown;
  error?: { code: string; message: string };
  executionTimeMs: number;
}

interface ErrorResponse {
  error: { code: string; message: string };
}

// =============================================================================
// TESTS
// =============================================================================

describe("MCP Service", () => {
  // ---------------------------------------------------------------------------
  // Root Endpoint
  // ---------------------------------------------------------------------------

  describe("GET /", () => {
    it("returns service info", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);

      const data = await parseJson<ServiceInfoResponse>(res);
      expect(data.name).toBe("@journey/mcp-service");
      expect(data.endpoints).toHaveProperty("health");
      expect(data.endpoints).toHaveProperty("tools");
      expect(data.endpoints).toHaveProperty("servers");
    });
  });

  // ---------------------------------------------------------------------------
  // Health Endpoint
  // ---------------------------------------------------------------------------

  describe("GET /health", () => {
    it("returns health status structure", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);

      const data = await parseJson<HealthResponse>(res);
      expect(data).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy"]).toContain(data.status);
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("servers");
    });

    it("reports unhealthy when MCP not initialized", async () => {
      // Without MCP servers configured, status should be unhealthy
      const res = await app.request("/health");
      const data = await parseJson<HealthResponse>(res);

      // When mcpManager.isInitialized() is false, status is unhealthy
      // This is expected in test environment without real MCP servers
      expect(data.status).toBe("unhealthy");
    });
  });

  // ---------------------------------------------------------------------------
  // Tools Endpoint
  // ---------------------------------------------------------------------------

  describe("GET /tools", () => {
    it("returns tools array structure", async () => {
      const res = await app.request("/tools");
      expect(res.status).toBe(200);

      const data = await parseJson<ToolsResponse>(res);
      expect(data).toHaveProperty("tools");
      expect(data).toHaveProperty("count");
      expect(Array.isArray(data.tools)).toBe(true);
    });

    it("returns empty tools when no servers configured", async () => {
      const res = await app.request("/tools");
      const data = await parseJson<ToolsResponse>(res);

      // Without MCP servers configured, tools should be empty
      expect(data.count).toBe(0);
      expect(data.tools).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Servers Endpoint
  // ---------------------------------------------------------------------------

  describe("GET /servers", () => {
    it("returns servers list structure", async () => {
      const res = await app.request("/servers");
      expect(res.status).toBe(200);

      const data = await parseJson<ServersResponse>(res);
      expect(data).toHaveProperty("servers");
      expect(data).toHaveProperty("count");
      expect(Array.isArray(data.servers)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Tool Execution
  // ---------------------------------------------------------------------------

  describe("POST /tools/call", () => {
    it("returns 400 for invalid JSON body", async () => {
      const res = await app.request("/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });
      expect(res.status).toBe(400);

      const data = await parseJson<ToolCallResponse>(res);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe("INVALID_JSON");
    });

    it("returns 400 for missing toolName", async () => {
      const res = await app.request("/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: {} }),
      });
      expect(res.status).toBe(400);

      const data = await parseJson<ToolCallResponse>(res);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe("INVALID_REQUEST");
    });

    it("returns 400 for invalid args type", async () => {
      const res = await app.request("/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName: "test_tool", args: "not-an-object" }),
      });
      expect(res.status).toBe(400);

      const data = await parseJson<ToolCallResponse>(res);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe("INVALID_REQUEST");
    });

    it("returns error for non-existent tool", async () => {
      const res = await app.request("/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName: "nonexistent_tool", args: {} }),
      });

      const data = await parseJson<ToolCallResponse>(res);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      // Either TOOL_NOT_FOUND or MCP_NOT_INITIALIZED depending on state
      expect(["TOOL_NOT_FOUND", "MCP_NOT_INITIALIZED"]).toContain(data.error?.code);
    });

    it("includes executionTimeMs in response", async () => {
      const res = await app.request("/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName: "test_tool", args: {} }),
      });

      const data = await parseJson<ToolCallResponse>(res);
      expect(typeof data.executionTimeMs).toBe("number");
      expect(data.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  describe("404 handling", () => {
    it("returns 404 for unknown routes", async () => {
      const res = await app.request("/unknown/route");
      expect(res.status).toBe(404);

      const data = await parseJson<ErrorResponse>(res);
      expect(data.error.code).toBe("NOT_FOUND");
    });

    it("includes route info in 404 message", async () => {
      const res = await app.request("/some/random/path");
      const data = await parseJson<ErrorResponse>(res);

      expect(data.error.message).toContain("/some/random/path");
    });
  });

  // ---------------------------------------------------------------------------
  // CORS Headers
  // ---------------------------------------------------------------------------

  describe("CORS", () => {
    it("includes CORS headers in response", async () => {
      const res = await app.request("/", {
        headers: { Origin: "http://localhost:3000" },
      });

      // CORS middleware should add Access-Control-Allow-Origin header
      const corsHeader = res.headers.get("Access-Control-Allow-Origin");
      expect(corsHeader).toBe("http://localhost:3000");
    });
  });
});
