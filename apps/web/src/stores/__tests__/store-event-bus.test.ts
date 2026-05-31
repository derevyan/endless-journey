/**
 * Store Event Bus Tests
 *
 * Tests for the type-safe event bus used for store communication.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeEventBus, type StoreEvent } from "../store-event-bus";

describe("StoreEventBus", () => {
  beforeEach(() => {
    // Clear all listeners before each test
    storeEventBus.clear();
  });

  describe("emit and on", () => {
    it("should emit events to subscribed listeners", () => {
      const listener = vi.fn();

      storeEventBus.on("node:updated", listener);
      storeEventBus.emit({
        type: "node:updated",
        payload: { nodeId: "node-1", updates: { data: { label: "Test" } } },
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        type: "node:updated",
        payload: { nodeId: "node-1", updates: { data: { label: "Test" } } },
      });
    });

    it("should not call listeners for different event types", () => {
      const nodeListener = vi.fn();
      const edgeListener = vi.fn();

      storeEventBus.on("node:updated", nodeListener);
      storeEventBus.on("edge:updated", edgeListener);

      storeEventBus.emit({
        type: "node:updated",
        payload: { nodeId: "node-1", updates: {} },
      });

      expect(nodeListener).toHaveBeenCalledTimes(1);
      expect(edgeListener).not.toHaveBeenCalled();
    });

    it("should support multiple listeners for same event type", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      storeEventBus.on("node:deleted", listener1);
      storeEventBus.on("node:deleted", listener2);

      storeEventBus.emit({
        type: "node:deleted",
        payload: { nodeId: "node-1" },
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("should handle listener errors gracefully", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalListener = vi.fn();

      storeEventBus.on("web:journey:loaded", errorListener);
      storeEventBus.on("web:journey:loaded", normalListener);

      // Should not throw
      expect(() => {
        storeEventBus.emit({
          type: "web:journey:loaded",
          payload: { journeyId: "test", data: { nodes: [], edges: [] } },
        });
      }).not.toThrow();

      // Both listeners should have been called
      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("unsubscribe", () => {
    it("should unsubscribe listener when unsubscribe function is called", () => {
      const listener = vi.fn();
      const unsubscribe = storeEventBus.on("web:node:added", listener);

      // First event should be received
      storeEventBus.emit({
        type: "web:node:added",
        payload: { node: { id: "node-1" } as never },
      });
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second event should NOT be received
      storeEventBus.emit({
        type: "web:node:added",
        payload: { node: { id: "node-2" } as never },
      });
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });

  describe("onMany", () => {
    it("should subscribe to multiple event types", () => {
      const listener = vi.fn();

      storeEventBus.onMany(["web:node:added", "node:deleted"], listener);

      storeEventBus.emit({
        type: "web:node:added",
        payload: { node: { id: "node-1" } as never },
      });
      storeEventBus.emit({
        type: "node:deleted",
        payload: { nodeId: "node-1" },
      });

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("should unsubscribe from all event types", () => {
      const listener = vi.fn();
      const unsubscribe = storeEventBus.onMany(["web:node:added", "node:deleted"], listener);

      storeEventBus.emit({
        type: "web:node:added",
        payload: { node: { id: "node-1" } as never },
      });
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe from all
      unsubscribe();

      storeEventBus.emit({
        type: "node:deleted",
        payload: { nodeId: "node-1" },
      });
      expect(listener).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe("clear", () => {
    it("should remove all listeners", () => {
      const listener = vi.fn();

      storeEventBus.on("selection:cleared", listener);
      storeEventBus.clear();

      storeEventBus.emit({
        type: "selection:cleared",
        payload: {},
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it("should reset event count", () => {
      // Add a listener so the event gets counted
      storeEventBus.on("selection:cleared", vi.fn());

      storeEventBus.emit({
        type: "selection:cleared",
        payload: {},
      });

      expect(storeEventBus.getTotalEventCount()).toBeGreaterThan(0);

      storeEventBus.clear();
      expect(storeEventBus.getTotalEventCount()).toBe(0);
    });
  });

  describe("type safety", () => {
    it("should ensure event payload types are correct", () => {
      // This test verifies TypeScript compilation
      // If it compiles, the types are correct

      const listener = vi.fn();

      storeEventBus.on("node:updated", (event) => {
        // TypeScript should know that event.payload has nodeId and updates
        expect(event.payload).toHaveProperty("nodeId");
        expect(event.payload).toHaveProperty("updates");
      });

      storeEventBus.emit({
        type: "node:updated",
        payload: { nodeId: "test", updates: {} },
      });
    });
  });
});
