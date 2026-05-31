/**
 * Timer Helpers Test Suite
 *
 * Tests for timer scheduling and metadata generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ExecutionContext } from "../types";
import { scheduleTimerWithMetadata } from "../utils/timer-helpers";

describe("Timer Helpers", () => {
  describe("scheduleTimerWithMetadata", () => {
    let mockContext: ExecutionContext;

    beforeEach(() => {
      // Mock ExecutionContext with necessary properties
      mockContext = {
        node: {
          id: "test-node",
          type: "message",
          data: {},
        },
        services: {
          timer: {
            scheduleTimer: vi.fn().mockResolvedValue("timer-123"),
          },
        },
        log: {
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
        },
      } as unknown as ExecutionContext;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should schedule timer and return complete metadata", async () => {
      const before = new Date();

      const result = await scheduleTimerWithMetadata(mockContext, 5, "edge-123", "message");

      const after = new Date();

      expect(result).not.toBeNull();
      expect(result).toEqual({
        timerId: "timer-123",
        delayMs: 5000,
        scheduledAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        expectedCompletionAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });

      // Verify timer scheduling was called
      expect(mockContext.services.timer.scheduleTimer).toHaveBeenCalledWith(5000, "edge-123");

      // Verify logging
      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: "test-node",
          delayMs: 5000,
          edgeId: "edge-123",
          timerId: "timer-123",
        }),
        "message:timerScheduled"
      );

      // Verify timestamp is recent
      const scheduledAt = new Date(result!.scheduledAt);
      expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(scheduledAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should return null for zero seconds", async () => {
      const result = await scheduleTimerWithMetadata(mockContext, 0, "edge-123", "message");

      expect(result).toBeNull();
      expect(mockContext.services.timer.scheduleTimer).not.toHaveBeenCalled();
    });

    it("should return null for negative seconds", async () => {
      const result = await scheduleTimerWithMetadata(mockContext, -5, "edge-123", "message");

      expect(result).toBeNull();
      expect(mockContext.services.timer.scheduleTimer).not.toHaveBeenCalled();
    });

    it("should calculate expected completion time correctly", async () => {
      const before = new Date();

      const result = await scheduleTimerWithMetadata(mockContext, 10, "edge-456", "wait");

      const after = new Date();

      expect(result).not.toBeNull();

      const scheduledAt = new Date(result!.scheduledAt);
      const expectedCompletion = new Date(result!.expectedCompletionAt);
      const timeDiff = expectedCompletion.getTime() - scheduledAt.getTime();

      // Should be approximately 10 seconds (10000 ms) +/- small margin for execution time
      expect(timeDiff).toBeGreaterThanOrEqual(9900);
      expect(timeDiff).toBeLessThanOrEqual(10100);
    });

    it("should use custom log prefix", async () => {
      await scheduleTimerWithMetadata(mockContext, 3, "edge-789", "custom-handler");

      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.any(Object),
        "custom-handler:timerScheduled"
      );
    });

    it("should handle default log prefix", async () => {
      await scheduleTimerWithMetadata(mockContext, 2, "edge-999");

      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.any(Object),
        "timer:timerScheduled"
      );
    });

    it("should handle fractional seconds", async () => {
      const result = await scheduleTimerWithMetadata(mockContext, 2.5, "edge-123", "test");

      expect(result).not.toBeNull();
      expect(result?.delayMs).toBe(2500);
    });

    it("should handle large durations", async () => {
      const result = await scheduleTimerWithMetadata(mockContext, 3600, "edge-123", "test");

      expect(result).not.toBeNull();
      expect(result?.delayMs).toBe(3600000); // 1 hour in ms
    });

    it("should log all required metadata fields", async () => {
      await scheduleTimerWithMetadata(mockContext, 5, "edge-123", "message");

      const callArgs = (mockContext.log.info as ReturnType<typeof vi.fn>).mock.calls[0];
      const logData = callArgs[0];

      expect(logData).toHaveProperty("nodeId");
      expect(logData).toHaveProperty("delayMs");
      expect(logData).toHaveProperty("edgeId");
      expect(logData).toHaveProperty("timerId");
      expect(logData).toHaveProperty("scheduledAt");
      expect(logData).toHaveProperty("expectedCompletionAt");
    });
  });
});
