import { describe, expect, it, vi, beforeEach } from "vitest";
import { createDlqService, type FailedEventRecord } from "../services/dlq-service";
import type { JourneyEvent } from "../types";

function createMockEvent(type: "message" | "button_click" | "timeout"): JourneyEvent {
  return {
    type,
    userId: "test-user",
    sessionId: "test-session",
    payload: { text: "test message" },
    timestamp: new Date().toISOString(),
  };
}

describe("DlqService", () => {
  let mockLog: ReturnType<typeof import("@journey/logger").createLogger>;

  beforeEach(() => {
    mockLog = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ReturnType<typeof import("@journey/logger").createLogger>;
  });

  describe("createDlqService", () => {
    it("should create a DLQ service instance", () => {
      const dlq = createDlqService();
      expect(dlq).toBeDefined();
      expect(dlq.recordFailure).toBeInstanceOf(Function);
    });
  });

  describe("recordFailure", () => {
    it("should log error with full context", async () => {
      const dlq = createDlqService({ logger: mockLog });
      const event = createMockEvent("message");
      const error = new Error("Test error");

      await dlq.recordFailure(event, error, {
        sessionId: "session-123",
        journeyId: "journey-456",
        currentNodeId: "node-789",
      });

      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "message",
          sessionId: "session-123",
          journeyId: "journey-456",
          nodeId: "node-789",
        }),
        "dlq:eventFailed"
      );
    });

    it("should call onPersist callback when provided", async () => {
      const onPersist = vi.fn().mockResolvedValue(undefined);
      const dlq = createDlqService({ onPersist, logger: mockLog });

      const event = createMockEvent("button_click");
      const error = new Error("Handler crashed");

      await dlq.recordFailure(event, error, {
        sessionId: "sess-1",
        journeyId: "j-1",
        organizationId: "org-1",
        currentNodeId: "n-1",
        sessionContext: { step: 3 },
      });

      expect(onPersist).toHaveBeenCalledTimes(1);
      const record = onPersist.mock.calls[0][0] as FailedEventRecord;

      expect(record.sessionId).toBe("sess-1");
      expect(record.journeyId).toBe("j-1");
      expect(record.organizationId).toBe("org-1");
      expect(record.eventType).toBe("button_click");
      expect(record.eventPayload).toBe(event);
      expect(record.currentNodeId).toBe("n-1");
      expect(record.sessionContext).toEqual({ step: 3 });
      expect(record.errorMessage).toBe("Handler crashed");
      expect(record.errorStack).toBeDefined();
    });

    it("should log success after persisting", async () => {
      const onPersist = vi.fn().mockResolvedValue(undefined);
      const dlq = createDlqService({ onPersist, logger: mockLog });

      await dlq.recordFailure(createMockEvent("timeout"), new Error("test"), {
        sessionId: "s-1",
      });

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "timeout", sessionId: "s-1" }),
        "dlq:eventPersisted"
      );
    });

    it("should not throw if onPersist fails", async () => {
      const onPersist = vi.fn().mockRejectedValue(new Error("DB unavailable"));
      const dlq = createDlqService({ onPersist, logger: mockLog });

      // Should not throw
      await expect(
        dlq.recordFailure(createMockEvent("message"), new Error("test"), {
          sessionId: "s-1",
        })
      ).resolves.toBeUndefined();

      // Should log persistence failure
      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Object) }),
        "dlq:persistFailed"
      );
    });

    it("should work without onPersist callback (log only)", async () => {
      const dlq = createDlqService({ logger: mockLog });

      await dlq.recordFailure(createMockEvent("message"), new Error("test"), {
        sessionId: "s-1",
      });

      // Should log but not throw
      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "s-1" }),
        "dlq:eventFailed"
      );

      // Should NOT log persistence (no onPersist)
      expect(mockLog.info).not.toHaveBeenCalled();
    });

    it("should handle missing optional context fields", async () => {
      const onPersist = vi.fn().mockResolvedValue(undefined);
      const dlq = createDlqService({ onPersist, logger: mockLog });

      await dlq.recordFailure(createMockEvent("message"), new Error("test"), {
        sessionId: "s-1",
        // No journeyId, organizationId, currentNodeId, sessionContext
      });

      const record = onPersist.mock.calls[0][0] as FailedEventRecord;
      expect(record.sessionId).toBe("s-1");
      expect(record.journeyId).toBeUndefined();
      expect(record.organizationId).toBeUndefined();
      expect(record.currentNodeId).toBeUndefined();
      expect(record.sessionContext).toBeUndefined();
    });
  });
});
