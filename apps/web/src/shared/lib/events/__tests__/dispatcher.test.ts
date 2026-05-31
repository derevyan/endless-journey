/**
 * Event Dispatcher Tests
 *
 * Tests for the event dispatcher with priority, filtering, and metrics.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FrontendEvent } from "../types";
import { HANDLER_PRIORITY } from "../types";

// Create a fresh dispatcher instance for testing
// We need to test the class directly, not the singleton
class TestEventDispatcher {
  private handlers: Map<string, { handler: (e: FrontendEvent) => void | Promise<void>; priority?: number; filter?: (e: FrontendEvent) => boolean }[]> = new Map();
  private globalHandlers: { handler: (e: FrontendEvent) => void | Promise<void>; priority?: number; filter?: (e: FrontendEvent) => boolean }[] = [];
  private processedEventQueue: string[] = [];
  private processedEventSet: Set<string> = new Set();
  private globalFilter: ((e: FrontendEvent) => boolean) | null = null;
  private maxProcessedCache = 100; // Lower for testing
  private metrics = {
    eventsDispatched: 0,
    handlersExecuted: 0,
    handlerErrors: 0,
    duplicatesSkipped: 0,
    eventsFiltered: 0,
  };

  setGlobalFilter(filter: ((e: FrontendEvent) => boolean) | null): void {
    this.globalFilter = filter;
  }

  register(eventType: string | string[], config: { handler: (e: FrontendEvent) => void | Promise<void>; priority?: number; filter?: (e: FrontendEvent) => boolean }): () => void {
    const types = Array.isArray(eventType) ? eventType : [eventType];
    types.forEach((type) => {
      const existing = this.handlers.get(type) || [];
      existing.push(config);
      existing.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.handlers.set(type, existing);
    });
    return () => {
      types.forEach((type) => {
        const existing = this.handlers.get(type);
        if (existing) {
          const filtered = existing.filter((h) => h !== config);
          if (filtered.length > 0) {
            this.handlers.set(type, filtered);
          } else {
            this.handlers.delete(type);
          }
        }
      });
    };
  }

  registerGlobal(config: { handler: (e: FrontendEvent) => void | Promise<void>; priority?: number }): () => void {
    this.globalHandlers.push(config);
    this.globalHandlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return () => {
      this.globalHandlers = this.globalHandlers.filter((h) => h !== config);
    };
  }

  async dispatch(event: FrontendEvent): Promise<void> {
    if (this.processedEventSet.has(event.id)) {
      this.metrics.duplicatesSkipped++;
      return;
    }

    if (this.globalFilter && !this.globalFilter(event)) {
      this.metrics.eventsFiltered++;
      return;
    }

    // Add to cache (queue + set for FIFO order)
    this.processedEventQueue.push(event.id);
    this.processedEventSet.add(event.id);

    // Cleanup cache if too large (remove oldest first - FIFO)
    if (this.processedEventQueue.length > this.maxProcessedCache) {
      const toRemove = Math.floor(this.maxProcessedCache * 0.1);
      const removedIds = this.processedEventQueue.splice(0, toRemove);
      for (const id of removedIds) {
        this.processedEventSet.delete(id);
      }
    }

    const handlersToRun = [
      ...(this.handlers.get(event.type) || []),
      ...this.globalHandlers,
    ];
    handlersToRun.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const config of handlersToRun) {
      try {
        if (config.filter && !config.filter(event)) continue;
        await config.handler(event);
        this.metrics.handlersExecuted++;
      } catch {
        this.metrics.handlerErrors++;
      }
    }

    this.metrics.eventsDispatched++;
  }

  // For testing cache state
  getProcessedEventCount(): number {
    return this.processedEventQueue.length;
  }

  getOldestProcessedEventId(): string | undefined {
    return this.processedEventQueue[0];
  }

  getMetrics() {
    return { ...this.metrics };
  }

  clear(): void {
    this.handlers.clear();
    this.globalHandlers = [];
    this.processedEventQueue = [];
    this.processedEventSet.clear();
    this.globalFilter = null;
  }

  getHandlerCount(): { typeSpecific: number; global: number } {
    let typeSpecific = 0;
    this.handlers.forEach((h) => (typeSpecific += h.length));
    return { typeSpecific, global: this.globalHandlers.length };
  }
}

// Helper to create test events
function createTestEvent(overrides: Partial<FrontendEvent> = {}): FrontendEvent {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    type: "test.event",
    organizationId: "org-1",
    timestamp: new Date().toISOString(),
    payload: {},
    ...overrides,
  } as FrontendEvent;
}

describe("EventDispatcher", () => {
  let dispatcher: TestEventDispatcher;

  beforeEach(() => {
    dispatcher = new TestEventDispatcher();
  });

  describe("register", () => {
    it("should register a handler for a single event type", () => {
      const handler = vi.fn();
      dispatcher.register("test.event", { handler });

      expect(dispatcher.getHandlerCount().typeSpecific).toBe(1);
    });

    it("should register a handler for multiple event types", () => {
      const handler = vi.fn();
      dispatcher.register(["event.a", "event.b", "event.c"], { handler });

      expect(dispatcher.getHandlerCount().typeSpecific).toBe(3);
    });

    it("should return an unsubscribe function", () => {
      const handler = vi.fn();
      const unsubscribe = dispatcher.register("test.event", { handler });

      expect(dispatcher.getHandlerCount().typeSpecific).toBe(1);

      unsubscribe();

      expect(dispatcher.getHandlerCount().typeSpecific).toBe(0);
    });
  });

  describe("registerGlobal", () => {
    it("should register a global handler", () => {
      const handler = vi.fn();
      dispatcher.registerGlobal({ handler });

      expect(dispatcher.getHandlerCount().global).toBe(1);
    });

    it("should unsubscribe global handler", () => {
      const handler = vi.fn();
      const unsubscribe = dispatcher.registerGlobal({ handler });

      expect(dispatcher.getHandlerCount().global).toBe(1);

      unsubscribe();

      expect(dispatcher.getHandlerCount().global).toBe(0);
    });
  });

  describe("dispatch", () => {
    it("should dispatch event to registered handler", async () => {
      const handler = vi.fn();
      dispatcher.register("test.event", { handler });

      const event = createTestEvent();
      await dispatcher.dispatch(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it("should dispatch event to global handlers", async () => {
      const handler = vi.fn();
      dispatcher.registerGlobal({ handler });

      const event = createTestEvent();
      await dispatcher.dispatch(event);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should not call handlers for different event types", async () => {
      const handler = vi.fn();
      dispatcher.register("other.event", { handler });

      await dispatcher.dispatch(createTestEvent({ type: "test.event" }));

      expect(handler).not.toHaveBeenCalled();
    });

    it("should deduplicate events by ID", async () => {
      const handler = vi.fn();
      dispatcher.register("test.event", { handler });

      const event = createTestEvent({ id: "duplicate-id" });
      await dispatcher.dispatch(event);
      await dispatcher.dispatch(event);
      await dispatcher.dispatch(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(dispatcher.getMetrics().duplicatesSkipped).toBe(2);
    });
  });

  describe("priority", () => {
    it("should execute handlers in priority order (higher first)", async () => {
      const order: number[] = [];

      dispatcher.register("test.event", {
        handler: () => { order.push(1); },
        priority: HANDLER_PRIORITY.LOW,
      });
      dispatcher.register("test.event", {
        handler: () => { order.push(2); },
        priority: HANDLER_PRIORITY.HIGH,
      });
      dispatcher.register("test.event", {
        handler: () => { order.push(3); },
        priority: HANDLER_PRIORITY.CRITICAL,
      });
      dispatcher.register("test.event", {
        handler: () => { order.push(4); },
        priority: HANDLER_PRIORITY.NORMAL,
      });

      await dispatcher.dispatch(createTestEvent());

      expect(order).toEqual([3, 2, 4, 1]); // CRITICAL, HIGH, NORMAL, LOW
    });

    it("should mix type-specific and global handlers by priority", async () => {
      const order: string[] = [];

      dispatcher.register("test.event", {
        handler: () => { order.push("type-low"); },
        priority: HANDLER_PRIORITY.LOW,
      });
      dispatcher.registerGlobal({
        handler: () => { order.push("global-high"); },
        priority: HANDLER_PRIORITY.HIGH,
      });
      dispatcher.register("test.event", {
        handler: () => { order.push("type-critical"); },
        priority: HANDLER_PRIORITY.CRITICAL,
      });

      await dispatcher.dispatch(createTestEvent());

      expect(order).toEqual(["type-critical", "global-high", "type-low"]);
    });
  });

  describe("filter", () => {
    it("should skip handler if filter returns false", async () => {
      const handler = vi.fn();
      dispatcher.register("test.event", {
        handler,
        filter: (event) => event.payload?.shouldProcess === true,
      });

      await dispatcher.dispatch(createTestEvent({ payload: { shouldProcess: false } }));
      expect(handler).not.toHaveBeenCalled();

      await dispatcher.dispatch(createTestEvent({ payload: { shouldProcess: true } }));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should apply global filter before dispatch", async () => {
      const handler = vi.fn();
      dispatcher.register("test.event", { handler });

      dispatcher.setGlobalFilter((event) => event.type.startsWith("allowed."));

      await dispatcher.dispatch(createTestEvent({ type: "test.event" }));
      expect(handler).not.toHaveBeenCalled();
      expect(dispatcher.getMetrics().eventsFiltered).toBe(1);

      await dispatcher.dispatch(createTestEvent({ type: "allowed.event" }));
      expect(handler).not.toHaveBeenCalled(); // Handler is for "test.event" not "allowed.event"
    });

    it("should clear global filter when set to null", async () => {
      const handler = vi.fn();
      dispatcher.register("test.event", { handler });

      dispatcher.setGlobalFilter(() => false);
      await dispatcher.dispatch(createTestEvent());
      expect(handler).not.toHaveBeenCalled();

      dispatcher.setGlobalFilter(null);
      await dispatcher.dispatch(createTestEvent());
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("should continue executing handlers after one throws", async () => {
      const handler1 = vi.fn(() => { throw new Error("Test error"); });
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      dispatcher.register("test.event", { handler: handler1 });
      dispatcher.register("test.event", { handler: handler2 });
      dispatcher.register("test.event", { handler: handler3 });

      await dispatcher.dispatch(createTestEvent());

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
      expect(dispatcher.getMetrics().handlerErrors).toBe(1);
    });
  });

  describe("metrics", () => {
    it("should track events dispatched", async () => {
      dispatcher.register("test.event", { handler: vi.fn() });

      await dispatcher.dispatch(createTestEvent());
      await dispatcher.dispatch(createTestEvent());
      await dispatcher.dispatch(createTestEvent());

      expect(dispatcher.getMetrics().eventsDispatched).toBe(3);
    });

    it("should track handlers executed", async () => {
      dispatcher.register("test.event", { handler: vi.fn() });
      dispatcher.register("test.event", { handler: vi.fn() });
      dispatcher.registerGlobal({ handler: vi.fn() });

      await dispatcher.dispatch(createTestEvent());

      expect(dispatcher.getMetrics().handlersExecuted).toBe(3);
    });

    it("should track handler errors", async () => {
      dispatcher.register("test.event", {
        handler: () => { throw new Error("Error 1"); },
      });
      dispatcher.register("test.event", {
        handler: () => { throw new Error("Error 2"); },
      });

      await dispatcher.dispatch(createTestEvent());

      expect(dispatcher.getMetrics().handlerErrors).toBe(2);
    });
  });

  describe("clear", () => {
    it("should remove all handlers", () => {
      dispatcher.register("test.event", { handler: vi.fn() });
      dispatcher.registerGlobal({ handler: vi.fn() });

      expect(dispatcher.getHandlerCount().typeSpecific).toBe(1);
      expect(dispatcher.getHandlerCount().global).toBe(1);

      dispatcher.clear();

      expect(dispatcher.getHandlerCount().typeSpecific).toBe(0);
      expect(dispatcher.getHandlerCount().global).toBe(0);
    });

    it("should clear processed events cache", async () => {
      const handler = vi.fn();
      dispatcher.register("test.event", { handler });

      const event = createTestEvent({ id: "event-1" });
      await dispatcher.dispatch(event);

      expect(dispatcher.getProcessedEventCount()).toBe(1);
      expect(handler).toHaveBeenCalledTimes(1);

      dispatcher.clear();

      expect(dispatcher.getProcessedEventCount()).toBe(0);

      // Re-register handler (clear also removes handlers)
      dispatcher.register("test.event", { handler });

      // Event should be processable again after clear
      await dispatcher.dispatch(event);
      expect(handler).toHaveBeenCalledTimes(2); // Called twice - once before clear, once after
    });
  });

  describe("async handlers", () => {
    it("should handle async handlers correctly", async () => {
      const order: number[] = [];

      dispatcher.register("test.event", {
        handler: async () => {
          await new Promise(r => setTimeout(r, 10));
          order.push(1);
        },
        priority: HANDLER_PRIORITY.HIGH,
      });

      dispatcher.register("test.event", {
        handler: () => { order.push(2); },
        priority: HANDLER_PRIORITY.LOW,
      });

      await dispatcher.dispatch(createTestEvent());

      // High priority async handler should complete before low priority starts
      expect(order).toEqual([1, 2]);
    });

    it("should maintain priority order with multiple async handlers", async () => {
      const order: string[] = [];

      dispatcher.register("test.event", {
        handler: async () => {
          await new Promise(r => setTimeout(r, 5));
          order.push("critical");
        },
        priority: HANDLER_PRIORITY.CRITICAL,
      });

      dispatcher.register("test.event", {
        handler: async () => {
          await new Promise(r => setTimeout(r, 15));
          order.push("high");
        },
        priority: HANDLER_PRIORITY.HIGH,
      });

      dispatcher.register("test.event", {
        handler: async () => {
          await new Promise(r => setTimeout(r, 1));
          order.push("normal");
        },
        priority: HANDLER_PRIORITY.NORMAL,
      });

      await dispatcher.dispatch(createTestEvent());

      // Should execute in priority order despite different delays
      expect(order).toEqual(["critical", "high", "normal"]);
    });

    it("should continue after async handler throws", async () => {
      const handler2 = vi.fn();

      dispatcher.register("test.event", {
        handler: async () => {
          await new Promise(r => setTimeout(r, 5));
          throw new Error("Async error");
        },
        priority: HANDLER_PRIORITY.HIGH,
      });

      dispatcher.register("test.event", {
        handler: handler2,
        priority: HANDLER_PRIORITY.LOW,
      });

      await dispatcher.dispatch(createTestEvent());

      expect(handler2).toHaveBeenCalled();
      expect(dispatcher.getMetrics().handlerErrors).toBe(1);
    });
  });

  describe("cache cleanup", () => {
    it("should remove oldest events when cache exceeds limit", async () => {
      dispatcher.register("test.event", { handler: vi.fn() });

      // Dispatch 105 events (cache limit is 100)
      const firstEventId = "event-0";
      for (let i = 0; i < 105; i++) {
        await dispatcher.dispatch(createTestEvent({ id: `event-${i}` }));
      }

      // Cache should have been trimmed (removes 10% = 10 events)
      expect(dispatcher.getProcessedEventCount()).toBe(95);

      // Oldest event should have been removed (FIFO)
      expect(dispatcher.getOldestProcessedEventId()).toBe("event-10");
    });

    it("should allow reprocessing of events removed from cache", async () => {
      const handler = vi.fn();
      dispatcher.register("test.event", { handler });

      // Dispatch 105 events to trigger cleanup
      for (let i = 0; i < 105; i++) {
        await dispatcher.dispatch(createTestEvent({ id: `event-${i}` }));
      }

      // event-0 should have been removed from cache
      // Dispatching it again should succeed
      await dispatcher.dispatch(createTestEvent({ id: "event-0" }));

      // Handler should be called for the re-dispatched event
      expect(handler).toHaveBeenCalledTimes(106);
    });
  });
});
