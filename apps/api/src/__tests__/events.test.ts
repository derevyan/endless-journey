/**
 * Events API Integration Tests
 *
 * Tests for /api/events endpoints:
 * - GET /api/events - List events with filters
 * - GET /api/events/stream - SSE streaming (basic connection test)
 * - GET /api/events/types - Available event types
 * - GET /api/events/stats - Event statistics
 *
 * Requires API server running on localhost:3001
 * Requires Redis running (for SSE tests)
 *
 * Run with: pnpm test:api
 */

import { describe, expect, it, beforeAll } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  TEST_USER_IDS,
  checkServerHealth,
} from "./helpers/test-app";

describe("Events API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  describe("GET /api/events", () => {
    it("should return 401 without authentication", async () => {
      const response = await fetch(`${API_BASE_URL}/api/events`);
      expect(response.status).toBe(401);
    });

    it("should return events list for authenticated user", async () => {
      const response = await authRequest("GET", "/api/events", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("events");
      expect(Array.isArray(data.events)).toBe(true);
      expect(data).toHaveProperty("pagination");
    });

    it("should filter events by type", async () => {
      const response = await authRequest(
        "GET",
        "/api/events?types=user.message",
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      if (data.events.length > 0) {
        data.events.forEach((event: any) => {
          expect(event.type).toBe("user.message");
        });
      }
    });

    it("should filter events by date range", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const response = await authRequest(
        "GET",
        `/api/events?startDate=${yesterday.toISOString()}`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.events).toBeDefined();
    });

    it("should respect limit parameter", async () => {
      const response = await authRequest(
        "GET",
        "/api/events?limit=5",
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.events.length).toBeLessThanOrEqual(5);
    });

    it("should include journey information in events", async () => {
      const response = await authRequest("GET", "/api/events", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as any;

      if (data.events.length > 0) {
        const firstEvent = data.events[0];
        expect(firstEvent).toHaveProperty("journeyId");
        expect(firstEvent).toHaveProperty("journeyName");
      }
    });
  });

  describe("GET /api/events/types", () => {
    it("should return 401 without authentication", async () => {
      const response = await fetch(`${API_BASE_URL}/api/events/types`);
      expect(response.status).toBe(401);
    });

    it("should return available event types", async () => {
      const response = await authRequest("GET", "/api/events/types", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("types");
      expect(Array.isArray(data.types)).toBe(true);

      if (data.types.length > 0) {
        expect(data.types[0]).toHaveProperty("type");
        expect(data.types[0]).toHaveProperty("label");
        expect(data.types[0]).toHaveProperty("level");
      }
    });
  });

  describe("GET /api/events/stats", () => {
    it("should return 401 without authentication", async () => {
      const response = await fetch(`${API_BASE_URL}/api/events/stats`);
      expect(response.status).toBe(401);
    });

    it("should return event statistics", async () => {
      const response = await authRequest("GET", "/api/events/stats", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("total");
      expect(data).toHaveProperty("last24h");
      expect(data).toHaveProperty("byType");
      expect(typeof data.total).toBe("number");
      expect(typeof data.last24h).toBe("number");
      expect(typeof data.byType).toBe("object");
    });
  });

  describe("GET /api/events/stream", () => {
    it("should return 401 without authentication", async () => {
      const response = await fetch(`${API_BASE_URL}/api/events/stream`);
      expect(response.status).toBe(401);
    });

    it("should establish SSE connection (basic)", async () => {
      // Note: Full SSE testing requires EventSource which is not available in Node
      // This test just verifies the endpoint is accessible
      const response = await fetch(`${API_BASE_URL}/api/events/stream`, {
        headers: {
          "X-Mock-User-Id": TEST_USER_IDS.DEMO,
        },
      });

      // SSE connections return 200 and keep connection open
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");

      // Close connection
      response.body?.cancel();
    });
  });

  describe("GET /api/events/replay", () => {
    it("should return 401 without authentication", async () => {
      const response = await fetch(`${API_BASE_URL}/api/events/replay`);
      expect(response.status).toBe(401);
    });

    it("should return events list for authenticated user", async () => {
      const response = await authRequest("GET", "/api/events/replay", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("events");
      expect(Array.isArray(data.events)).toBe(true);
      expect(data).toHaveProperty("pagination");
      expect(data.pagination).toHaveProperty("total");
      expect(data.pagination).toHaveProperty("limit");
      expect(data.pagination).toHaveProperty("offset");
    });

    it("should filter events by sinceSequence", async () => {
      const response = await authRequest(
        "GET",
        "/api/events/replay?sinceSequence=0",
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.events).toBeDefined();
      // All returned events should have sequence > 0
      if (data.events.length > 0) {
        data.events.forEach((event: any) => {
          expect(event.sequence).toBeGreaterThan(0);
        });
      }
    });

    it("should filter events by type with wildcards", async () => {
      const response = await authRequest(
        "GET",
        "/api/events/replay?types=session.*",
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      if (data.events.length > 0) {
        data.events.forEach((event: any) => {
          expect(event.type.startsWith("session.")).toBe(true);
        });
      }
    });

    it("should respect limit parameter", async () => {
      const response = await authRequest(
        "GET",
        "/api/events/replay?limit=5",
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.events.length).toBeLessThanOrEqual(5);
      expect(data.pagination.limit).toBe(5);
    });
  });

  describe("GET /api/events/replay/latest", () => {
    it("should return 401 without authentication", async () => {
      const response = await fetch(`${API_BASE_URL}/api/events/replay/latest`);
      expect(response.status).toBe(401);
    });

    it("should return latest sequence number", async () => {
      const response = await authRequest("GET", "/api/events/replay/latest", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("latestSequence");
      expect(typeof data.latestSequence).toBe("number");
    });
  });

  describe("GET /api/events/health", () => {
    it("should return event system health status", async () => {
      const response = await authRequest("GET", "/api/events/health", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy"]).toContain(data.status);
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("components");
      expect(data.components).toHaveProperty("redis");
      expect(data.components).toHaveProperty("eventBus");
      expect(data.components).toHaveProperty("queues");
    });

    it("should include latency metrics for redis", async () => {
      const response = await authRequest("GET", "/api/events/health", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      if (data.components.redis.status === "healthy") {
        expect(data.components.redis).toHaveProperty("latency");
        expect(typeof data.components.redis.latency).toBe("number");
      }
    });
  });
});
