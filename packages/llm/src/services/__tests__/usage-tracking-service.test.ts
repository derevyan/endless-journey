/**
 * Usage Tracking Service Tests
 *
 * Verifies buffering, flushing, and skip behavior for missing org IDs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TokenUsage } from "@journey/schemas";
import { LLM_SERVICE_NAMES } from "@journey/schemas";

vi.mock("@journey/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  serializeError: (err: Error) => ({ message: err.message }),
}));

const insertValues = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn(() => ({ values: insertValues })));

vi.mock("@journey/db", () => ({
  db: {
    insert,
  },
  llmUsageEvents: {},
}));

import { db } from "@journey/db";
import { usageTrackingService } from "../usage-tracking-service";

const usage: TokenUsage = { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUSD: 0.01 };

function resetServiceState() {
  const service = usageTrackingService as unknown as {
    buffer: unknown[];
    flushing: boolean;
    initialized: boolean;
    flushInterval: NodeJS.Timeout | null;
    config: { bufferSize: number; enabled: boolean };
  };
  service.buffer = [];
  service.flushing = false;
  service.initialized = false;
  if (service.flushInterval) {
    clearInterval(service.flushInterval);
    service.flushInterval = null;
  }
  service.config.enabled = true;
  service.config.bufferSize = 100;
}

describe("Usage Tracking Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetServiceState();
    insertValues.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetServiceState();
  });

  it("skips tracking when organizationId is missing", () => {
    usageTrackingService.recordUsage(usage, {
      organizationId: undefined,
      service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
      model: "gpt-4o",
      provider: "openai",
    });

    const buffer = (usageTrackingService as any).buffer as unknown[];
    expect(buffer).toHaveLength(0);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("flushes when buffer size is reached", async () => {
    const service = usageTrackingService as unknown as {
      config: { bufferSize: number };
      buffer: unknown[];
    };
    service.config.bufferSize = 2;

    usageTrackingService.recordUsage(usage, {
      organizationId: "org-1",
      service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
      model: "gpt-4o",
      provider: "openai", // Explicit provider (no longer auto-detected from model name)
    });
    usageTrackingService.recordUsage(usage, {
      organizationId: "org-1",
      service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
      model: "gpt-4o",
      provider: "openai",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);
    const events = insertValues.mock.calls[0]?.[0] as Array<{ provider?: string }>;
    expect(events[0]?.provider).toBe("openai");
    expect(service.buffer).toHaveLength(0);
  });

  it("re-buffers events when flush fails", async () => {
    const service = usageTrackingService as unknown as {
      config: { bufferSize: number };
      buffer: unknown[];
    };
    service.config.bufferSize = 1;

    insertValues.mockRejectedValueOnce(new Error("db down"));

    usageTrackingService.recordUsage(usage, {
      organizationId: "org-1",
      service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
      model: "gpt-4o",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(service.buffer).toHaveLength(1);
  });

  // =========================================================================
  // resolveJourneySessionId Behavior Tests
  // =========================================================================

  it("includes journeySessionId when journeyId is present (real journey)", async () => {
    const service = usageTrackingService as unknown as {
      config: { bufferSize: number };
      buffer: unknown[];
    };
    service.config.bufferSize = 1;

    // Use valid UUIDs - validateUuidOrNull requires proper UUID format
    const validJourneyId = "550e8400-e29b-41d4-a716-446655440000";
    const validSessionId = "660e8400-e29b-41d4-a716-446655440001";

    usageTrackingService.recordUsage(usage, {
      organizationId: "org-1",
      journeyId: validJourneyId,
      journeySessionId: validSessionId,
      service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
      model: "gpt-4o",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const events = insertValues.mock.calls[0]?.[0] as Array<{ journeySessionId: string | null }>;
    expect(events[0]?.journeySessionId).toBe(validSessionId);
  });

  it("excludes journeySessionId when journeyId is missing (workflow test)", async () => {
    const service = usageTrackingService as unknown as {
      config: { bufferSize: number };
      buffer: unknown[];
    };
    service.config.bufferSize = 1;

    usageTrackingService.recordUsage(usage, {
      organizationId: "org-1",
      journeySessionId: "session-456", // Provided but no journeyId = workflow test
      service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
      model: "gpt-4o",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const events = insertValues.mock.calls[0]?.[0] as Array<{ journeySessionId: string | null }>;
    expect(events[0]?.journeySessionId).toBeNull();
  });

  it("excludes journeySessionId when sessionId is undefined", async () => {
    const service = usageTrackingService as unknown as {
      config: { bufferSize: number };
      buffer: unknown[];
    };
    service.config.bufferSize = 1;

    // Use valid UUID for journeyId
    const validJourneyId = "550e8400-e29b-41d4-a716-446655440000";

    usageTrackingService.recordUsage(usage, {
      organizationId: "org-1",
      journeyId: validJourneyId,
      // No journeySessionId provided
      service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
      model: "gpt-4o",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const events = insertValues.mock.calls[0]?.[0] as Array<{ journeySessionId: string | null }>;
    expect(events[0]?.journeySessionId).toBeNull();
  });

  it("excludes journeySessionId when both journeyId and sessionId are missing", async () => {
    const service = usageTrackingService as unknown as {
      config: { bufferSize: number };
      buffer: unknown[];
    };
    service.config.bufferSize = 1;

    usageTrackingService.recordUsage(usage, {
      organizationId: "org-1",
      service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
      model: "gpt-4o",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const events = insertValues.mock.calls[0]?.[0] as Array<{ journeySessionId: string | null }>;
    expect(events[0]?.journeySessionId).toBeNull();
  });

  // =========================================================================
  // Error Handling Tests (FK Violations, Transient Errors)
  // =========================================================================

  describe("Error Handling - Permanent vs Transient", () => {
    it("drops events with FK constraint violations (permanent error)", async () => {
      const service = usageTrackingService as unknown as {
        config: { bufferSize: number };
        buffer: unknown[];
      };
      service.config.bufferSize = 1;

      // Simulate FK violation (code 23503)
      insertValues.mockRejectedValueOnce({
        code: "23503",
        constraint: "llm_usage_events_organization_id_organization_id_fk",
        message: "insert violates foreign key constraint",
      });

      usageTrackingService.recordUsage(usage, {
        organizationId: "org_stale_id",
        service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
        model: "gpt-4o",
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should drop events, not retry
      expect(service.buffer).toHaveLength(0);
      expect(db.insert).toHaveBeenCalledTimes(1); // No retry
    });

    it("retries events with transient errors", async () => {
      const service = usageTrackingService as unknown as {
        config: { bufferSize: number };
        buffer: unknown[];
      };
      service.config.bufferSize = 1;

      // Simulate transient error (connection timeout)
      insertValues
        .mockRejectedValueOnce(new Error("Connection timeout"))
        .mockResolvedValueOnce(undefined); // Success on retry

      usageTrackingService.recordUsage(usage, {
        organizationId: "org_valid",
        service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
        model: "gpt-4o",
      });

      await new Promise((resolve) => setTimeout(resolve, 0)); // First flush fails

      // Events should still be in buffer (retry)
      expect(service.buffer).toHaveLength(1);

      // Manually trigger second flush
      const flushMethod = (usageTrackingService as any).flush.bind(usageTrackingService);
      await flushMethod();

      // After successful retry, buffer should be empty
      expect(service.buffer).toHaveLength(0);
      expect(db.insert).toHaveBeenCalledTimes(2); // First failed, second succeeded
    });

    it("drops events with unique constraint violations", async () => {
      const service = usageTrackingService as unknown as {
        config: { bufferSize: number };
        buffer: unknown[];
      };
      service.config.bufferSize = 1;

      // Simulate unique constraint violation (code 23505)
      insertValues.mockRejectedValueOnce({
        code: "23505",
        constraint: "llm_usage_events_pkey",
        message: "violates unique constraint",
      });

      usageTrackingService.recordUsage(usage, {
        organizationId: "org-1",
        service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
        model: "gpt-4o",
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should drop events, not retry
      expect(service.buffer).toHaveLength(0);
    });

    it("prevents buffer overflow during retry storms", async () => {
      const service = usageTrackingService as unknown as {
        config: { bufferSize: number };
        buffer: unknown[];
      };
      service.config.bufferSize = 10;

      // Simulate continuous transient errors
      insertValues.mockRejectedValue(new Error("Transient error"));

      // Fill buffer to trigger flush
      for (let i = 0; i < 10; i++) {
        usageTrackingService.recordUsage(usage, {
          organizationId: "org-1",
          service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
          model: "gpt-4o",
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Buffer should have been flushed (and re-added on error)
      // With bufferSize=10, the max buffer is 10 * 3 = 30
      // But since flush failed, events were re-added, so buffer has 10
      expect(service.buffer.length).toBeGreaterThan(0);
      expect(service.buffer.length).toBeLessThanOrEqual(10);
    });
  });
});
