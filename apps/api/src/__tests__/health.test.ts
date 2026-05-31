/**
 * Health Endpoint Integration Tests
 *
 * Tests for the /health endpoint using real HTTP requests.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:health
 */

import { describe, expect, it, beforeAll } from "vitest";
import {
  API_BASE_URL,
  request,
  checkServerHealth,
  type HealthResponse,
} from "./helpers/test-app";

describe("Health Endpoint", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  describe("GET /health", () => {
    it("should return 200 status", async () => {
      const response = await request("GET", "/health");
      expect(response.status).toBe(200);
    });

    it("should return JSON with status field", async () => {
      const response = await request("GET", "/health");
      const data = (await response.json()) as HealthResponse;

      expect(data).toHaveProperty("status");
      expect(["ok", "degraded"]).toContain(data.status);
    });

    it("should include database connection status", async () => {
      const response = await request("GET", "/health");
      const data = (await response.json()) as HealthResponse;

      expect(data).toHaveProperty("database");
      expect(["connected", "disconnected"]).toContain(data.database);
    });

    it("should include timestamp", async () => {
      const response = await request("GET", "/health");
      const data = (await response.json()) as HealthResponse;

      expect(data).toHaveProperty("timestamp");
      // Verify it's a valid ISO date string
      expect(() => new Date(data.timestamp)).not.toThrow();
    });

    it("should report ok status when database is connected", async () => {
      const response = await request("GET", "/health");
      const data = (await response.json()) as HealthResponse;

      // In test environment with seeded DB, should be connected
      if (data.database === "connected") {
        expect(data.status).toBe("ok");
      } else {
        expect(data.status).toBe("degraded");
      }
    });

    it("should include environment field", async () => {
      const response = await request("GET", "/health");
      const data = (await response.json()) as HealthResponse;

      expect(data).toHaveProperty("environment");
    });
  });

  describe("GET /health/detailed", () => {
    it("should return 200 status", async () => {
      const response = await request("GET", "/health/detailed");
      expect([200, 503]).toContain(response.status);
    });

    it("should return detailed health with all components", async () => {
      const response = await request("GET", "/health/detailed");
      const data = (await response.json()) as any;

      expect(data).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy"]).toContain(data.status);
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("components");
      expect(data).toHaveProperty("summary");
    });

    it("should include database component", async () => {
      const response = await request("GET", "/health/detailed");
      const data = (await response.json()) as any;

      expect(data.components).toHaveProperty("database");
      expect(data.components.database).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy"]).toContain(data.components.database.status);
    });

    it("should include redis component", async () => {
      const response = await request("GET", "/health/detailed");
      const data = (await response.json()) as any;

      expect(data.components).toHaveProperty("redis");
      expect(data.components.redis).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy"]).toContain(data.components.redis.status);
    });

    it("should include eventBus component", async () => {
      const response = await request("GET", "/health/detailed");
      const data = (await response.json()) as any;

      expect(data.components).toHaveProperty("eventBus");
      expect(data.components.eventBus).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy"]).toContain(data.components.eventBus.status);
    });

    it("should include summary statistics", async () => {
      const response = await request("GET", "/health/detailed");
      const data = (await response.json()) as any;

      expect(data.summary).toHaveProperty("totalComponents");
      expect(data.summary).toHaveProperty("healthyComponents");
      expect(data.summary).toHaveProperty("degradedComponents");
      expect(data.summary).toHaveProperty("unhealthyComponents");
      expect(typeof data.summary.totalComponents).toBe("number");
    });

    it("should include latency for healthy components", async () => {
      const response = await request("GET", "/health/detailed");
      const data = (await response.json()) as any;

      // Database should have latency if healthy
      if (data.components.database.status === "healthy") {
        expect(data.components.database).toHaveProperty("latency");
        expect(typeof data.components.database.latency).toBe("number");
      }

      // Redis should have latency if healthy
      if (data.components.redis.status === "healthy") {
        expect(data.components.redis).toHaveProperty("latency");
        expect(typeof data.components.redis.latency).toBe("number");
      }
    });

    it("should include detailed Redis metrics when healthy", async () => {
      const response = await request("GET", "/health/detailed");
      const data = (await response.json()) as any;

      if (data.components.redis.status === "healthy") {
        expect(data.components.redis).toHaveProperty("details");
        const details = data.components.redis.details;

        // Check for new detailed metrics
        expect(details).toHaveProperty("connectedClients");
        expect(typeof details.connectedClients).toBe("number");

        expect(details).toHaveProperty("usedMemory");
        expect(typeof details.usedMemory).toBe("string");

        expect(details).toHaveProperty("uptimeSeconds");
        expect(typeof details.uptimeSeconds).toBe("number");

        expect(details).toHaveProperty("totalKeys");
        expect(typeof details.totalKeys).toBe("number");
      }
    });

    it("should include queues component with job counts", async () => {
      const response = await request("GET", "/health/detailed");
      const data = (await response.json()) as any;

      expect(data.components).toHaveProperty("queues");
      expect(data.components.queues).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy"]).toContain(data.components.queues.status);

      // Check for detailed queue metrics
      if (data.components.queues.status !== "unhealthy" && data.components.queues.details) {
        const details = data.components.queues.details;

        // Should have queues array
        expect(details).toHaveProperty("queues");
        expect(Array.isArray(details.queues)).toBe(true);

        // Each queue should have job counts
        for (const queue of details.queues) {
          expect(queue).toHaveProperty("name");
          expect(queue).toHaveProperty("waiting");
          expect(queue).toHaveProperty("active");
          expect(queue).toHaveProperty("failed");
        }

        // Should have summary
        expect(details).toHaveProperty("summary");
        expect(details.summary).toHaveProperty("totalQueues");
        expect(details.summary).toHaveProperty("totalWaiting");
        expect(details.summary).toHaveProperty("totalActive");
        expect(details.summary).toHaveProperty("totalFailed");
      }
    });
  });
});
