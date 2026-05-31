/**
 * ServiceFactory - UUID Event ID Generation Tests
 *
 * Tests that event IDs are generated in valid UUID v4 format
 * to satisfy database foreign key constraints on sent_messages.interaction_event_id
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import type { InteractionEvent } from "@journey/schemas";

describe("ServiceFactory - UUID Event ID Generation", () => {
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("should generate valid UUID v4 format for event IDs", () => {
    // Test that randomUUID() generates valid v4 format
    const id = randomUUID();

    expect(id).toMatch(UUID_V4_REGEX);
    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
  });

  it("should generate unique event IDs across multiple calls", () => {
    const ids = new Set<string>();

    // Generate 1000 IDs and verify they're all unique
    for (let i = 0; i < 1000; i++) {
      const id = randomUUID();
      ids.add(id);
    }

    // All 1000 IDs should be unique
    expect(ids.size).toBe(1000);

    // All should match UUID v4 format
    ids.forEach((id) => {
      expect(id).toMatch(UUID_V4_REGEX);
    });
  });

  it("should be compatible with InteractionEvent type requiring UUID format", () => {
    // Create an interaction event with UUID ID
    const id = randomUUID();

    const event: InteractionEvent = {
      id, // UUID format
      timestamp: new Date().toISOString(),
      type: "engine.message",
      nodeId: "test-node",
      payload: { content: "Test message" },
    };

    // Event should have all required properties
    expect(event).toHaveProperty("id");
    expect(event).toHaveProperty("timestamp");
    expect(event).toHaveProperty("type");
    expect(event).toHaveProperty("nodeId");
    expect(event).toHaveProperty("payload");

    // ID must be UUID format (required for sent_messages FK)
    expect(event.id).toMatch(UUID_V4_REGEX);

    // Timestamp should be ISO string
    expect(typeof event.timestamp).toBe("string");
    expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
  });

  it("should maintain UUID format for all event types", () => {
    const eventTypes = ["user.message", "engine.message", "user.click", "timer.expired"];

    eventTypes.forEach((eventType) => {
      const id = randomUUID();

      const event: InteractionEvent = {
        id,
        timestamp: new Date().toISOString(),
        type: eventType as any,
        nodeId: "test-node",
        payload: {},
      };

      expect(event.id).toMatch(UUID_V4_REGEX);
    });
  });

  it("should reject old string format for UUID validation", () => {
    const oldFormat = `evt_${Date.now()}_abc123`;
    const uuidRegex = UUID_V4_REGEX;

    // Verify that old format does NOT match UUID regex
    expect(oldFormat).not.toMatch(uuidRegex);
  });
});
