import { describe, expect, it, vi, beforeEach } from "vitest";
import { EventQueue } from "../event/event-queue";
import type { JourneyEvent } from "../types";

/**
 * Creates a mock JourneyEvent for testing
 */
function createMockEvent(type: "message" | "button_click" | "timeout", payload: JourneyEvent["payload"] = {}): JourneyEvent {
  return {
    type,
    userId: "test-user",
    sessionId: "test-session",
    payload,
    timestamp: new Date().toISOString(),
  };
}

describe("EventQueue", () => {
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

  describe("enqueue", () => {
    it("should process a single event immediately", async () => {
      const processedEvents: JourneyEvent[] = [];
      const processEvent = vi.fn().mockImplementation(async (event: JourneyEvent) => {
        processedEvents.push(event);
      });

      const queue = new EventQueue(processEvent);
      const event = createMockEvent("message", { text: "hello" });

      await queue.enqueue(event);

      expect(processEvent).toHaveBeenCalledTimes(1);
      expect(processEvent).toHaveBeenCalledWith(event);
      expect(processedEvents).toHaveLength(1);
    });

    it("should process multiple events in FIFO order", async () => {
      const processedEvents: JourneyEvent[] = [];
      const processEvent = vi.fn().mockImplementation(async (event: JourneyEvent) => {
        processedEvents.push(event);
      });

      const queue = new EventQueue(processEvent);

      const event1 = createMockEvent("message", { text: "first" });
      const event2 = createMockEvent("button_click", { buttonId: "btn-1" });
      const event3 = createMockEvent("timeout", { timerId: "timer-1" });

      await queue.enqueue(event1);
      await queue.enqueue(event2);
      await queue.enqueue(event3);

      expect(processedEvents).toHaveLength(3);
      expect(processedEvents[0].payload.text).toBe("first");
      expect(processedEvents[1].payload.buttonId).toBe("btn-1");
      expect(processedEvents[2].payload.timerId).toBe("timer-1");
    });

    it("should serialize concurrent event processing", async () => {
      const processingOrder: string[] = [];
      const processEvent = vi.fn().mockImplementation(async (event: JourneyEvent) => {
        processingOrder.push(`start:${event.type}`);
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));
        processingOrder.push(`end:${event.type}`);
      });

      const queue = new EventQueue(processEvent);

      // Enqueue multiple events concurrently
      const event1 = createMockEvent("message", { text: "msg" });
      const event2 = createMockEvent("timeout", { timerId: "t1" });

      // Start both enqueues at nearly the same time
      const p1 = queue.enqueue(event1);
      const p2 = queue.enqueue(event2);

      await Promise.all([p1, p2]);

      // Events should be processed serially, not interleaved
      expect(processingOrder).toEqual([
        "start:message",
        "end:message",
        "start:timeout",
        "end:timeout",
      ]);
    });
  });

  describe("race condition prevention", () => {
    it("should process timeout after message completes even when queued nearly simultaneously", async () => {
      const transitions: string[] = [];
      const processEvent = vi.fn().mockImplementation(async (event: JourneyEvent) => {
        if (event.type === "message") {
          transitions.push("message:processing");
          await new Promise((resolve) => setTimeout(resolve, 5));
          transitions.push("message:complete");
        } else if (event.type === "timeout") {
          transitions.push("timeout:processing");
          transitions.push("timeout:complete");
        }
      });

      const queue = new EventQueue(processEvent);

      // Simulate race: message comes in, then timeout fires
      const messageEvent = createMockEvent("message", { text: "user replied" });
      const timeoutEvent = createMockEvent("timeout", { timerId: "timer-1" });

      // Enqueue both nearly simultaneously
      const p1 = queue.enqueue(messageEvent);
      const p2 = queue.enqueue(timeoutEvent);

      await Promise.all([p1, p2]);

      // Message should complete before timeout starts
      expect(transitions).toEqual([
        "message:processing",
        "message:complete",
        "timeout:processing",
        "timeout:complete",
      ]);
    });

    it("should allow message handler to cancel timer before timeout processes", async () => {
      const cancelledTimers = new Set<string>();
      let timeoutProcessed = false;

      const processEvent = vi.fn().mockImplementation(async (event: JourneyEvent) => {
        if (event.type === "message") {
          // Simulate: message handler cancels the timer
          cancelledTimers.add("timer-1");
          await new Promise((resolve) => setTimeout(resolve, 5));
        } else if (event.type === "timeout") {
          // Check if timer was cancelled (simulates stale event detection)
          if (!cancelledTimers.has(event.payload.timerId!)) {
            timeoutProcessed = true;
          }
        }
      });

      const queue = new EventQueue(processEvent);

      const messageEvent = createMockEvent("message", { text: "quick reply" });
      const timeoutEvent = createMockEvent("timeout", { timerId: "timer-1" });

      await Promise.all([
        queue.enqueue(messageEvent),
        queue.enqueue(timeoutEvent),
      ]);

      // Timer was cancelled by message handler, so timeout should be skipped
      expect(cancelledTimers.has("timer-1")).toBe(true);
      expect(timeoutProcessed).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all pending events from queue", async () => {
      const processedEvents: JourneyEvent[] = [];
      const processEvent = vi.fn().mockImplementation(async (event: JourneyEvent) => {
        processedEvents.push(event);
        // Long processing time to allow clear to be called
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const queue = new EventQueue(processEvent, { log: mockLog });

      // Queue multiple events (first will start processing)
      const event1 = createMockEvent("message", { text: "first" });
      const event2 = createMockEvent("message", { text: "second" });
      const event3 = createMockEvent("message", { text: "third" });

      queue.enqueue(event1);
      // Don't await - let events queue up
      queue.enqueue(event2);
      queue.enqueue(event3);

      // Clear while first event is processing
      await new Promise((resolve) => setTimeout(resolve, 10));
      queue.clear();

      // Wait for current event to finish
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Only the first event (already processing) should complete
      expect(processedEvents).toHaveLength(1);
      expect(processedEvents[0].payload.text).toBe("first");
    });

    it("should set pending count to zero", () => {
      const processEvent = vi.fn();
      const queue = new EventQueue(processEvent);

      // Manually add to queue without processing
      queue.clear();

      expect(queue.pendingCount).toBe(0);
    });
  });

  describe("pendingCount", () => {
    it("should return correct count of pending events", async () => {
      let resolveFirst: () => void;
      const firstProcessing = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      const processEvent = vi.fn().mockImplementation(async () => {
        await firstProcessing;
      });

      const queue = new EventQueue(processEvent);

      expect(queue.pendingCount).toBe(0);

      // Start processing first event (will block)
      queue.enqueue(createMockEvent("message"));

      // Queue more events while first is blocked
      queue.enqueue(createMockEvent("message"));
      queue.enqueue(createMockEvent("message"));

      // First event is processing, 2 more in queue
      expect(queue.pendingCount).toBe(2);

      // Unblock processing
      resolveFirst!();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(queue.pendingCount).toBe(0);
    });
  });

  describe("isProcessing", () => {
    it("should return true while processing events", async () => {
      let resolveFirst: () => void;
      const firstProcessing = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      const processEvent = vi.fn().mockImplementation(async () => {
        await firstProcessing;
      });

      const queue = new EventQueue(processEvent);

      expect(queue.isProcessing).toBe(false);

      // Start processing
      const enqueuePromise = queue.enqueue(createMockEvent("message"));

      // Should be processing
      expect(queue.isProcessing).toBe(true);

      // Unblock and complete
      resolveFirst!();
      await enqueuePromise;

      expect(queue.isProcessing).toBe(false);
    });
  });

  describe("error handling (catch-and-continue)", () => {
    it("should continue processing after handler error (catch-and-continue)", async () => {
      const processedEvents: string[] = [];
      const processEvent = vi.fn()
        .mockRejectedValueOnce(new Error("First fails"))
        .mockImplementation(async (event: JourneyEvent) => {
          processedEvents.push(event.type);
        });

      const queue = new EventQueue(processEvent, { log: mockLog });

      // Enqueue multiple events
      const event1 = createMockEvent("message", { text: "first" });
      const event2 = createMockEvent("message", { text: "second" });
      const event3 = createMockEvent("message", { text: "third" });

      await queue.enqueue(event1);
      await queue.enqueue(event2);
      await queue.enqueue(event3);

      // All events should be attempted despite first failing
      expect(processEvent).toHaveBeenCalledTimes(3);

      // Second and third should have succeeded
      expect(processedEvents).toEqual(["message", "message"]);

      // Error should be logged
      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "message" }),
        "eventQueue:processError"
      );
    });

    it("should not throw error to caller", async () => {
      const processEvent = vi.fn().mockRejectedValue(new Error("Handler failed"));
      const queue = new EventQueue(processEvent, { log: mockLog });

      // Should NOT throw - catch-and-continue pattern
      await expect(queue.enqueue(createMockEvent("message"))).resolves.toBeUndefined();
      expect(mockLog.error).toHaveBeenCalled();
    });

    it("should reset processing state after error", async () => {
      const processEvent = vi.fn().mockRejectedValue(new Error("Fails"));
      const queue = new EventQueue(processEvent, { log: mockLog });

      await queue.enqueue(createMockEvent("message"));
      expect(queue.isProcessing).toBe(false);
    });

    it("should record failure to DLQ when provided", async () => {
      const dlqRecords: Array<{ event: JourneyEvent; error: Error }> = [];
      const mockDlq = {
        recordFailure: vi.fn().mockImplementation(async (event: JourneyEvent, error: Error) => {
          dlqRecords.push({ event, error });
        }),
      };

      const processEvent = vi.fn().mockRejectedValue(new Error("Handler failed"));

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        dlq: mockDlq,
        dlqContext: {
          sessionId: "test-session-id",
          journeyId: "test-journey-id",
          organizationId: "test-org-id",
        },
      });

      const event = createMockEvent("message", { text: "test" });
      await queue.enqueue(event);

      // DLQ should have recorded the failure
      expect(dlqRecords).toHaveLength(1);
      expect(dlqRecords[0].event).toBe(event);
      expect(dlqRecords[0].error.message).toBe("Handler failed");
      expect(mockDlq.recordFailure).toHaveBeenCalledWith(
        event,
        expect.any(Error),
        expect.objectContaining({
          sessionId: "test-session-id",
          journeyId: "test-journey-id",
          organizationId: "test-org-id",
        })
      );
    });

    it("should use context getters for DLQ when provided", async () => {
      const mockDlq = {
        recordFailure: vi.fn().mockResolvedValue(undefined),
      };

      const processEvent = vi.fn().mockRejectedValue(new Error("Failed"));

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        dlq: mockDlq,
        dlqContext: {
          sessionId: "test-session",
          getCurrentNodeId: () => "node-123",
          getSessionContext: () => ({ step: 5, completed: true }),
        },
      });

      await queue.enqueue(createMockEvent("message"));

      expect(mockDlq.recordFailure).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Error),
        expect.objectContaining({
          sessionId: "test-session",
          currentNodeId: "node-123",
          sessionContext: { step: 5, completed: true },
        })
      );
    });

    it("should continue processing even if DLQ recording fails", async () => {
      const processedEvents: string[] = [];
      const mockDlq = {
        recordFailure: vi.fn().mockRejectedValue(new Error("DLQ unavailable")),
      };

      const processEvent = vi.fn()
        .mockRejectedValueOnce(new Error("First fails"))
        .mockImplementation(async (event: JourneyEvent) => {
          processedEvents.push(event.type);
        });

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        dlq: mockDlq,
        dlqContext: { sessionId: "test" },
      });

      await queue.enqueue(createMockEvent("message", { text: "first" }));
      await queue.enqueue(createMockEvent("message", { text: "second" }));

      // Should still process second event even though DLQ recording failed
      expect(processedEvents).toEqual(["message"]);
    });

    it("should handle getCurrentNodeId getter throwing", async () => {
      const mockDlq = {
        recordFailure: vi.fn().mockResolvedValue(undefined),
      };

      const processEvent = vi.fn().mockRejectedValue(new Error("Failed"));

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        dlq: mockDlq,
        dlqContext: {
          sessionId: "test-session",
          getCurrentNodeId: () => {
            throw new Error("Node ID getter failed");
          },
          getSessionContext: () => ({ key: "value" }),
        },
      });

      await queue.enqueue(createMockEvent("message"));

      // Should still record to DLQ even though getter threw
      expect(mockDlq.recordFailure).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Error),
        expect.objectContaining({
          sessionId: "test-session",
          currentNodeId: undefined, // Should be undefined because getter threw
          sessionContext: { key: "value" },
        })
      );

      // Should log warning about getter failure
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Node ID getter failed" }),
        "eventQueue:getCurrentNodeId:failed"
      );
    });

    it("should handle getSessionContext getter throwing", async () => {
      const mockDlq = {
        recordFailure: vi.fn().mockResolvedValue(undefined),
      };

      const processEvent = vi.fn().mockRejectedValue(new Error("Failed"));

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        dlq: mockDlq,
        dlqContext: {
          sessionId: "test-session",
          getCurrentNodeId: () => "node-123",
          getSessionContext: () => {
            throw new Error("Context getter failed");
          },
        },
      });

      await queue.enqueue(createMockEvent("message"));

      // Should still record to DLQ even though getter threw
      expect(mockDlq.recordFailure).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Error),
        expect.objectContaining({
          sessionId: "test-session",
          currentNodeId: "node-123",
          sessionContext: undefined, // Should be undefined because getter threw
        })
      );

      // Should log warning about getter failure
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Context getter failed" }),
        "eventQueue:getSessionContext:failed"
      );
    });

    it("should continue processing even if both getters throw", async () => {
      const processedEvents: string[] = [];
      const mockDlq = {
        recordFailure: vi.fn().mockResolvedValue(undefined),
      };

      const processEvent = vi.fn()
        .mockRejectedValueOnce(new Error("First fails"))
        .mockImplementation(async (event: JourneyEvent) => {
          processedEvents.push(event.type);
        });

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        dlq: mockDlq,
        dlqContext: {
          sessionId: "test-session",
          getCurrentNodeId: () => {
            throw new Error("Node ID getter failed");
          },
          getSessionContext: () => {
            throw new Error("Context getter failed");
          },
        },
      });

      await queue.enqueue(createMockEvent("message", { text: "first" }));
      await queue.enqueue(createMockEvent("message", { text: "second" }));

      // Should still process second event
      expect(processedEvents).toEqual(["message"]);

      // DLQ should still have recorded with undefined values
      expect(mockDlq.recordFailure).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Error),
        expect.objectContaining({
          currentNodeId: undefined,
          sessionContext: undefined,
        })
      );
    });
  });

  describe("logging", () => {
    it("should log trace events when logger provided", async () => {
      const processEvent = vi.fn().mockResolvedValue(undefined);
      const queue = new EventQueue(processEvent, { log: mockLog });

      await queue.enqueue(createMockEvent("message"));

      expect(mockLog.trace).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "message" }),
        "eventQueue:enqueued"
      );
      expect(mockLog.trace).toHaveBeenCalledWith(
        expect.objectContaining({ queueLength: 1 }),
        "eventQueue:processingStarted"
      );
      expect(mockLog.trace).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "message" }),
        "eventQueue:processingEvent"
      );
      expect(mockLog.trace).toHaveBeenCalledWith(
        {},
        "eventQueue:processingComplete"
      );
    });

    it("should work without logger", async () => {
      const processEvent = vi.fn().mockResolvedValue(undefined);
      const queue = new EventQueue(processEvent);

      // Should not throw
      await queue.enqueue(createMockEvent("message"));
      expect(processEvent).toHaveBeenCalled();
    });
  });

  describe("overflow policies", () => {
    it("should drop oldest event when queue reaches max with drop_oldest policy", async () => {
      const processedEvents: JourneyEvent[] = [];
      let resolveBlocking: () => void;
      const blockingPromise = new Promise<void>((resolve) => {
        resolveBlocking = resolve;
      });

      // First event blocks, allowing us to fill the queue
      const processEvent = vi.fn().mockImplementation(async (event: JourneyEvent) => {
        if (processedEvents.length === 0) {
          await blockingPromise;
        }
        processedEvents.push(event);
      });

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        maxQueueLength: 3,
        overflowPolicy: "drop_oldest",
      });

      // Enqueue first event (will block)
      const p1 = queue.enqueue(createMockEvent("message", { text: "first" }));

      // Fill the queue while first is blocking
      queue.enqueue(createMockEvent("message", { text: "second" }));
      queue.enqueue(createMockEvent("message", { text: "third" }));
      queue.enqueue(createMockEvent("message", { text: "fourth" }));

      // Queue is at capacity (3 pending). Add one more - should drop oldest (second)
      queue.enqueue(createMockEvent("message", { text: "fifth" }));

      // Unblock and let all process
      resolveBlocking!();
      await p1;
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have logged warning about dropping oldest
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ maxQueueLength: 3 }),
        "eventQueue:overflow:droppedOldest"
      );

      // Should have processed: first, third, fourth, fifth (second was dropped)
      expect(processedEvents.map((e) => e.payload.text)).toEqual([
        "first",
        "third",
        "fourth",
        "fifth",
      ]);
    });

    it("should reject new event when queue reaches max with drop_newest policy", async () => {
      const processedEvents: JourneyEvent[] = [];
      let resolveBlocking: () => void;
      const blockingPromise = new Promise<void>((resolve) => {
        resolveBlocking = resolve;
      });

      const processEvent = vi.fn().mockImplementation(async (event: JourneyEvent) => {
        if (processedEvents.length === 0) {
          await blockingPromise;
        }
        processedEvents.push(event);
      });

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        maxQueueLength: 3,
        overflowPolicy: "drop_newest",
      });

      // Enqueue first event (will block)
      const p1 = queue.enqueue(createMockEvent("message", { text: "first" }));

      // Fill the queue while first is blocking
      queue.enqueue(createMockEvent("message", { text: "second" }));
      queue.enqueue(createMockEvent("message", { text: "third" }));
      queue.enqueue(createMockEvent("message", { text: "fourth" }));

      // Queue is at capacity (3 pending). Add one more - should be rejected
      queue.enqueue(createMockEvent("message", { text: "fifth-rejected" }));

      // Unblock and let all process
      resolveBlocking!();
      await p1;
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have logged warning about dropping newest
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ droppedEventType: "message", maxQueueLength: 3 }),
        "eventQueue:overflow:droppedNewest"
      );

      // Should have processed: first, second, third, fourth (fifth was rejected)
      expect(processedEvents.map((e) => e.payload.text)).toEqual([
        "first",
        "second",
        "third",
        "fourth",
      ]);
    });

    it("should throw error when queue reaches max with reject policy", async () => {
      let resolveBlocking: () => void;
      const blockingPromise = new Promise<void>((resolve) => {
        resolveBlocking = resolve;
      });

      const processEvent = vi.fn().mockImplementation(async () => {
        await blockingPromise;
      });

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        maxQueueLength: 2,
        overflowPolicy: "reject",
      });

      // Enqueue first event (will block)
      queue.enqueue(createMockEvent("message", { text: "first" }));

      // Fill the queue
      queue.enqueue(createMockEvent("message", { text: "second" }));
      queue.enqueue(createMockEvent("message", { text: "third" }));

      // Queue is at capacity (2 pending). Add one more - should throw
      await expect(queue.enqueue(createMockEvent("message", { text: "fourth" }))).rejects.toThrow(
        "Event queue at capacity (2)"
      );

      // Cleanup
      resolveBlocking!();
    });

    it("should respect custom maxQueueLength configuration", async () => {
      let resolveBlocking: () => void;
      const blockingPromise = new Promise<void>((resolve) => {
        resolveBlocking = resolve;
      });

      const processEvent = vi.fn().mockImplementation(async () => {
        await blockingPromise;
      });

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        maxQueueLength: 5, // Custom limit
        overflowPolicy: "drop_oldest",
      });

      // Enqueue first event (will block)
      queue.enqueue(createMockEvent("message"));

      // Fill up to custom limit
      queue.enqueue(createMockEvent("message"));
      queue.enqueue(createMockEvent("message"));
      queue.enqueue(createMockEvent("message"));
      queue.enqueue(createMockEvent("message"));
      queue.enqueue(createMockEvent("message"));

      // Now at capacity (5 pending). One more should trigger overflow
      queue.enqueue(createMockEvent("timeout"));

      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ maxQueueLength: 5 }),
        "eventQueue:overflow:droppedOldest"
      );

      // Cleanup
      resolveBlocking!();
    });
  });

  describe("backpressure", () => {
    it("should fire backpressure callback when threshold is reached", async () => {
      let resolveBlocking: () => void;
      const blockingPromise = new Promise<void>((resolve) => {
        resolveBlocking = resolve;
      });

      const processEvent = vi.fn().mockImplementation(async () => {
        await blockingPromise;
      });

      const onBackpressure = vi.fn();

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        maxQueueLength: 100,
        backpressureThreshold: 3,
        onBackpressure,
      });

      // Enqueue first event (will start processing and be removed from queue)
      queue.enqueue(createMockEvent("message"));

      // Queue length = 1 (below threshold 3) - no callback
      queue.enqueue(createMockEvent("message"));
      expect(onBackpressure).not.toHaveBeenCalled();

      // Queue length = 2 (still below threshold)
      queue.enqueue(createMockEvent("message"));
      expect(onBackpressure).not.toHaveBeenCalled();

      // Queue length = 3 (reaches threshold) - callback fires!
      queue.enqueue(createMockEvent("timeout", { timerId: "t1" }));

      expect(onBackpressure).toHaveBeenCalledWith({
        queueLength: 3,
        eventType: "timeout",
      });

      // Should also fire for subsequent events above threshold
      queue.enqueue(createMockEvent("button_click", { buttonId: "b1" }));
      expect(onBackpressure).toHaveBeenCalledWith({
        queueLength: 4,
        eventType: "button_click",
      });

      // Cleanup
      resolveBlocking!();
    });

    it("should handle backpressure callback errors gracefully", async () => {
      let resolveBlocking: () => void;
      const blockingPromise = new Promise<void>((resolve) => {
        resolveBlocking = resolve;
      });

      const processEvent = vi.fn().mockImplementation(async () => {
        await blockingPromise;
      });

      const onBackpressure = vi.fn().mockImplementation(() => {
        throw new Error("Callback failed");
      });

      const queue = new EventQueue(processEvent, {
        log: mockLog,
        backpressureThreshold: 2,
        onBackpressure,
      });

      // Enqueue events to trigger backpressure
      queue.enqueue(createMockEvent("message"));
      queue.enqueue(createMockEvent("message"));
      queue.enqueue(createMockEvent("message"));

      // Should log warning but not crash
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Callback failed" }),
        "eventQueue:backpressureCallbackFailed"
      );

      // Cleanup
      resolveBlocking!();
    });
  });

  describe("high-load stress test", () => {
    it("should maintain FIFO order with 1000+ events", async () => {
      const processedEvents: string[] = [];
      const processEvent = vi.fn().mockImplementation(async (event: JourneyEvent) => {
        processedEvents.push(event.payload.text || "");
      });

      const queue = new EventQueue(processEvent, {
        maxQueueLength: 2000, // Ensure no overflow
      });

      const eventCount = 1000;
      const promises: Promise<void>[] = [];

      // Enqueue 1000 events as fast as possible
      for (let i = 0; i < eventCount; i++) {
        promises.push(queue.enqueue(createMockEvent("message", { text: `event-${i}` })));
      }

      await Promise.all(promises);

      // All events should be processed in FIFO order
      expect(processedEvents).toHaveLength(eventCount);
      for (let i = 0; i < eventCount; i++) {
        expect(processedEvents[i]).toBe(`event-${i}`);
      }
    });

    it("should handle concurrent enqueue/dequeue under stress", async () => {
      const processedEvents: string[] = [];
      const processEvent = vi.fn().mockImplementation(async (event: JourneyEvent) => {
        // Small delay to simulate work
        await new Promise((resolve) => setTimeout(resolve, 1));
        processedEvents.push(event.payload.text || "");
      });

      const queue = new EventQueue(processEvent, {
        maxQueueLength: 500,
      });

      // Enqueue events in bursts with small delays between bursts
      const totalEvents = 200;
      const burstsCount = 10;
      const eventsPerBurst = totalEvents / burstsCount;

      for (let burst = 0; burst < burstsCount; burst++) {
        const promises: Promise<void>[] = [];
        for (let i = 0; i < eventsPerBurst; i++) {
          const index = burst * eventsPerBurst + i;
          promises.push(queue.enqueue(createMockEvent("message", { text: `event-${index}` })));
        }
        // Small delay between bursts
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Wait for all processing to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // All events should be processed in FIFO order
      expect(processedEvents).toHaveLength(totalEvents);
      for (let i = 0; i < totalEvents; i++) {
        expect(processedEvents[i]).toBe(`event-${i}`);
      }
    });
  });
});
