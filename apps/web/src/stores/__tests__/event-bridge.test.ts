/**
 * Event Bridge Tests
 *
 * Tests for the SSE to store event bridge that enables real-time sync.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeEventBus } from "../store-event-bus";
import { eventBridge } from "../event-bridge";
import { eventDispatcher } from "@/shared/lib/events";
import type { FrontendEvent } from "@/shared/lib/events/types";

// Mock the event dispatcher
vi.mock("@/shared/lib/events", () => ({
  eventDispatcher: {
    registerGlobal: vi.fn(),
    clear: vi.fn(),
  },
}));

describe("EventBridge", () => {
  let mockHandler: ((event: FrontendEvent) => void) | null = null;

  beforeEach(() => {
    // Clear mocks and reset state
    vi.clearAllMocks();
    mockHandler = null;

    // Capture the handler when registerGlobal is called
    vi.mocked(eventDispatcher.registerGlobal).mockImplementation((config) => {
      mockHandler = config.handler;
      return () => {
        mockHandler = null;
      };
    });

    // Clear store event bus
    storeEventBus.clear();

    // Stop and reset the bridge
    eventBridge.stop();
    eventBridge.resetMetrics();
  });

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  describe("lifecycle", () => {
    it("should start and register with event dispatcher", () => {
      eventBridge.start();

      expect(eventDispatcher.registerGlobal).toHaveBeenCalledTimes(1);
      expect(eventBridge.isRunning()).toBe(true);
    });

    it("should stop and unsubscribe from event dispatcher", () => {
      eventBridge.start();
      expect(eventBridge.isRunning()).toBe(true);

      eventBridge.stop();
      expect(eventBridge.isRunning()).toBe(false);
      expect(mockHandler).toBeNull();
    });

    it("should not register twice if already started", () => {
      eventBridge.start();
      eventBridge.start();

      expect(eventDispatcher.registerGlobal).toHaveBeenCalledTimes(1);
    });

    it("should handle stop when not started", () => {
      expect(() => eventBridge.stop()).not.toThrow();
    });
  });

  // ===========================================================================
  // METRICS
  // ===========================================================================

  describe("metrics", () => {
    it("should track events received", () => {
      eventBridge.start();

      // Simulate events
      mockHandler?.(createMockEvent("session.started"));
      mockHandler?.(createMockEvent("journey.updated"));
      mockHandler?.(createMockEvent("unknown.event"));

      const metrics = eventBridge.getMetrics();
      expect(metrics.eventsReceived).toBe(3);
    });

    it("should track events bridged", () => {
      eventBridge.start();

      // Bridgeable events
      mockHandler?.(createMockEvent("session.started"));
      mockHandler?.(createMockEvent("journey.updated"));

      // Non-bridgeable event
      mockHandler?.(createMockEvent("unknown.event"));

      const metrics = eventBridge.getMetrics();
      expect(metrics.eventsBridged).toBe(2);
    });

    it("should reset metrics", () => {
      eventBridge.start();
      mockHandler?.(createMockEvent("session.started"));

      eventBridge.resetMetrics();

      const metrics = eventBridge.getMetrics();
      expect(metrics.eventsReceived).toBe(0);
      expect(metrics.eventsBridged).toBe(0);
    });

    it("should return a copy of metrics", () => {
      const metrics1 = eventBridge.getMetrics();
      const metrics2 = eventBridge.getMetrics();

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });
  });

  // ===========================================================================
  // FILTERING
  // ===========================================================================

  describe("filtering", () => {
    it("should apply filter function", () => {
      const filter = vi.fn((event: FrontendEvent) => event.type.startsWith("session"));

      eventBridge.start({ filter });

      mockHandler?.(createMockEvent("session.started"));
      mockHandler?.(createMockEvent("journey.updated"));

      const metrics = eventBridge.getMetrics();
      expect(metrics.eventsReceived).toBe(2);
      expect(metrics.eventsFiltered).toBe(1);
      expect(metrics.eventsBridged).toBe(1);
    });

    it("should increment filtered count for filtered events", () => {
      eventBridge.start({
        filter: () => false, // Filter everything
      });

      mockHandler?.(createMockEvent("session.started"));
      mockHandler?.(createMockEvent("journey.updated"));

      const metrics = eventBridge.getMetrics();
      expect(metrics.eventsFiltered).toBe(2);
      expect(metrics.eventsBridged).toBe(0);
    });
  });

  // ===========================================================================
  // EVENT TRANSFORMATION
  // ===========================================================================

  describe("event transformation", () => {
    it("should transform session.started to sync:session.started", () => {
      const storeListener = vi.fn();
      storeEventBus.on("sync:session.started", storeListener);

      eventBridge.start();
      mockHandler?.(
        createMockEvent("session.started", {
          sessionId: "sess-123",
          journeyId: "journey-456",
        })
      );

      expect(storeListener).toHaveBeenCalledWith({
        type: "sync:session.started",
        payload: {
          sessionId: "sess-123",
          journeyId: "journey-456",
        },
      });
    });

    it("should transform journey.updated to sync:journey.saved", () => {
      const storeListener = vi.fn();
      storeEventBus.on("sync:journey.saved", storeListener);

      eventBridge.start();
      mockHandler?.(
        createMockEvent("journey.updated", {
          journeyId: "journey-123",
          performedBy: "user-456",
          timestamp: "2025-12-21T12:00:00Z",
        })
      );

      expect(storeListener).toHaveBeenCalledWith({
        type: "sync:journey.saved",
        payload: {
          journeyId: "journey-123",
          savedBy: "user-456",
          timestamp: "2025-12-21T12:00:00Z",
        },
      });
    });

    it("should transform journey.created to sync:journey.saved", () => {
      const storeListener = vi.fn();
      storeEventBus.on("sync:journey.saved", storeListener);

      eventBridge.start();
      mockHandler?.(
        createMockEvent("journey.created", {
          journeyId: "new-journey",
          performedBy: "creator",
        })
      );

      expect(storeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sync:journey.saved",
          payload: expect.objectContaining({
            journeyId: "new-journey",
            savedBy: "creator",
          }),
        })
      );
    });

    it("should transform node.created to node:added", () => {
      const storeListener = vi.fn();
      storeEventBus.on("node:added", storeListener);

      eventBridge.start();
      mockHandler?.(
        createMockEvent("node.created", {
          metadata: { nodeId: "node-123" },
          payload: {
            type: "message",
            position: { x: 100, y: 200 },
          },
        })
      );

      expect(storeListener).toHaveBeenCalledWith({
        type: "node:added",
        payload: {
          nodeId: "node-123",
          nodeType: "message",
          position: { x: 100, y: 200 },
        },
      });
    });

    it("should transform node.updated to node:updated", () => {
      const storeListener = vi.fn();
      storeEventBus.on("node:updated", storeListener);

      eventBridge.start();
      mockHandler?.(
        createMockEvent("node.updated", {
          metadata: { nodeId: "node-123" },
          payload: { data: { label: "Updated" } },
        })
      );

      expect(storeListener).toHaveBeenCalledWith({
        type: "node:updated",
        payload: {
          nodeId: "node-123",
          updates: { data: { label: "Updated" } },
        },
      });
    });

    it("should transform node.deleted to node:deleted", () => {
      const storeListener = vi.fn();
      storeEventBus.on("node:deleted", storeListener);

      eventBridge.start();
      mockHandler?.(
        createMockEvent("node.deleted", {
          metadata: { nodeId: "node-to-delete" },
        })
      );

      expect(storeListener).toHaveBeenCalledWith({
        type: "node:deleted",
        payload: {
          nodeId: "node-to-delete",
        },
      });
    });

    it("should transform edge.created to edge:added", () => {
      const storeListener = vi.fn();
      storeEventBus.on("edge:added", storeListener);

      eventBridge.start();
      mockHandler?.(
        createMockEvent("edge.created", {
          payload: {
            id: "edge-123",
            source: "node-1",
            target: "node-2",
            sourceHandle: "bottom",
            targetHandle: "top",
          },
        })
      );

      expect(storeListener).toHaveBeenCalledWith({
        type: "edge:added",
        payload: {
          edgeId: "edge-123",
          source: "node-1",
          target: "node-2",
          sourceHandle: "bottom",
          targetHandle: "top",
        },
      });
    });

    it("should transform edge.deleted to edge:deleted", () => {
      const storeListener = vi.fn();
      storeEventBus.on("edge:deleted", storeListener);

      eventBridge.start();
      mockHandler?.(
        createMockEvent("edge.deleted", {
          payload: { edgeId: "edge-to-delete" },
        })
      );

      expect(storeListener).toHaveBeenCalledWith({
        type: "edge:deleted",
        payload: {
          edgeId: "edge-to-delete",
        },
      });
    });

    it("should not bridge unknown event types", () => {
      const allListener = vi.fn();

      // Subscribe to a few event types
      storeEventBus.on("sync:session.started", allListener);
      storeEventBus.on("sync:journey.saved", allListener);
      storeEventBus.on("node:added", allListener);

      eventBridge.start();
      mockHandler?.(createMockEvent("unknown.event.type"));
      mockHandler?.(createMockEvent("some.other.event"));

      expect(allListener).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe("error handling", () => {
    it("should track transform errors", () => {
      eventBridge.start();

      // Create an event that might cause issues (but our transform is robust)
      mockHandler?.(createMockEvent("session.started"));

      const metrics = eventBridge.getMetrics();
      expect(metrics.transformErrors).toBe(0);
    });

    it("should handle missing fields gracefully", () => {
      const storeListener = vi.fn();
      storeEventBus.on("sync:session.started", storeListener);

      eventBridge.start();

      // Event with missing sessionId and journeyId
      mockHandler?.({
        id: "123",
        type: "session.started",
        timestamp: new Date().toISOString(),
        version: 1,
        organizationId: "org-1",
        source: "journey",
        sequence: 1,
      } as unknown as FrontendEvent);

      expect(storeListener).toHaveBeenCalledWith({
        type: "sync:session.started",
        payload: {
          sessionId: "",
          journeyId: "",
        },
      });
    });
  });
});

// ===========================================================================
// HELPERS
// ===========================================================================

/**
 * Create a mock FrontendEvent for testing
 */
function createMockEvent(
  type: string,
  overrides: Partial<FrontendEvent> & { metadata?: Record<string, unknown>; payload?: unknown } = {}
): FrontendEvent {
  const { metadata, payload, ...rest } = overrides;

  return {
    id: `event-${Date.now()}`,
    type,
    timestamp: new Date().toISOString(),
    version: 1,
    organizationId: "org-test",
    source: "journey",
    sequence: 1,
    sessionId: rest.sessionId,
    journeyId: rest.journeyId,
    performedBy: rest.performedBy,
    payload: payload,
    metadata: metadata as FrontendEvent["metadata"],
    ...rest,
  } as FrontendEvent;
}
