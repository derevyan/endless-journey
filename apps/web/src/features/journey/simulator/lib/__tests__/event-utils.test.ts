/**
 * Event Utils Tests
 *
 * Tests for event deduplication, merging, and ID generation utilities.
 */

import type { InteractionEvent } from "@journey/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEventId, deduplicateEvents, MAX_EVENT_LOG_SIZE, mergeEventLogs } from "../event-utils";

// Helper to create a mock event
function createMockEvent(id: string, type = "system.transition"): InteractionEvent {
  return {
    id,
    type: type as InteractionEvent["type"],
    timestamp: new Date().toISOString(),
    nodeId: "node-1",
    payload: {},
  };
}

describe("event-utils", () => {
  describe("deduplicateEvents", () => {
    it("should return empty array for empty input", () => {
      expect(deduplicateEvents([])).toEqual([]);
    });

    it("should return same array when no duplicates", () => {
      const events = [
        createMockEvent("evt-1"),
        createMockEvent("evt-2"),
        createMockEvent("evt-3"),
      ];

      const result = deduplicateEvents(events);
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.id)).toEqual(["evt-1", "evt-2", "evt-3"]);
    });

    it("should remove duplicate events by ID (keep first occurrence)", () => {
      const events = [
        createMockEvent("evt-1"),
        createMockEvent("evt-2"),
        createMockEvent("evt-1"), // duplicate
        createMockEvent("evt-3"),
        createMockEvent("evt-2"), // duplicate
      ];

      const result = deduplicateEvents(events);
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.id)).toEqual(["evt-1", "evt-2", "evt-3"]);
    });

    it("should handle events with null/undefined IDs", () => {
      const events = [
        createMockEvent("evt-1"),
        { ...createMockEvent("evt-2"), id: undefined } as unknown as InteractionEvent,
        createMockEvent("evt-3"),
      ];

      const result = deduplicateEvents(events);
      // Events without IDs should be included
      expect(result).toHaveLength(3);
    });

    it("should warn in development when event has no ID", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const events = [
        { ...createMockEvent("evt-1"), id: undefined } as unknown as InteractionEvent,
      ];

      deduplicateEvents(events);

      // In development mode, should warn about missing ID
      if (process.env.NODE_ENV === "development") {
        expect(consoleWarnSpy).toHaveBeenCalled();
      }

      consoleWarnSpy.mockRestore();
    });
  });

  describe("mergeEventLogs", () => {
    it("should merge two empty arrays", () => {
      expect(mergeEventLogs([], [])).toEqual([]);
    });

    it("should add incoming events to existing log", () => {
      const existing = [createMockEvent("evt-1")];
      const incoming = [createMockEvent("evt-2"), createMockEvent("evt-3")];

      const result = mergeEventLogs(existing, incoming);
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.id)).toEqual(["evt-1", "evt-2", "evt-3"]);
    });

    it("should not add duplicate events from incoming", () => {
      const existing = [createMockEvent("evt-1"), createMockEvent("evt-2")];
      const incoming = [
        createMockEvent("evt-2"), // duplicate
        createMockEvent("evt-3"),
      ];

      const result = mergeEventLogs(existing, incoming);
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.id)).toEqual(["evt-1", "evt-2", "evt-3"]);
    });

    it("should apply FIFO eviction when exceeding max size", () => {
      const existing = Array.from({ length: 10 }, (_, i) => createMockEvent(`existing-${i}`));
      const incoming = Array.from({ length: 5 }, (_, i) => createMockEvent(`incoming-${i}`));

      // With maxSize of 10, should keep last 10 events
      const result = mergeEventLogs(existing, incoming, 10);
      expect(result).toHaveLength(10);
      // Should have the last 5 existing and all 5 incoming
      expect(result[0].id).toBe("existing-5");
      expect(result[9].id).toBe("incoming-4");
    });

    it("should use default MAX_EVENT_LOG_SIZE when not specified", () => {
      const events = mergeEventLogs([], [createMockEvent("evt-1")]);
      // Just verifying it doesn't throw and works with default
      expect(events).toHaveLength(1);
      expect(MAX_EVENT_LOG_SIZE).toBe(5000);
    });

    it("should skip incoming events with no ID", () => {
      const existing = [createMockEvent("evt-1")];
      const incoming = [
        { ...createMockEvent("evt-2"), id: undefined } as unknown as InteractionEvent,
        createMockEvent("evt-3"),
      ];

      const result = mergeEventLogs(existing, incoming);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id)).toEqual(["evt-1", "evt-3"]);
    });
  });

  describe("createEventId", () => {
    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(createEventId());
      }
      expect(ids.size).toBe(100);
    });

    it("should return UUID v4 format", () => {
      const id = createEventId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it("should ignore custom prefix (UUID takes precedence)", () => {
      const id = createEventId("custom");
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it("should generate unique IDs", () => {
      const id1 = createEventId();
      const id2 = createEventId();
      const id3 = createEventId();

      expect(id1).not.toEqual(id2);
      expect(id2).not.toEqual(id3);
      expect(id1).not.toEqual(id3);
    });
  });
});
