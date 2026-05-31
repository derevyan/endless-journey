/**
 * Conversation History Service - Edge Case Tests
 *
 * Tests conversation message filtering, handling empty events,
 * and preservation of chronological order.
 */

import { describe, it, expect } from "vitest";
import { createConversationHistoryService } from "../../services/conversation-history-service";
import type { InteractionEvent } from "@journey/schemas";

describe("ConversationHistoryService - Edge Cases", () => {
  it("should filter conversation messages from interaction events", () => {
    const service = createConversationHistoryService();

    const events: InteractionEvent[] = [
      {
        id: "evt-1",
        type: "user.message",
        nodeId: "chat-node",
        payload: { text: "Hi there" },
        timestamp: "2026-01-05T12:00:00Z",
      },
      {
        id: "evt-2",
        type: "engine.message",
        nodeId: "chat-node",
        payload: { content: "Hello! How can I help?" },
        timestamp: "2026-01-05T12:00:01Z",
      },
      {
        id: "evt-3",
        type: "timer.expired",
        nodeId: "wait-node",
        payload: { timerId: "timer-1" },
        timestamp: "2026-01-05T12:00:02Z",
      },
      {
        id: "evt-4",
        type: "user.click",
        nodeId: "button-node",
        payload: { buttonId: "btn-continue" },
        timestamp: "2026-01-05T12:00:03Z",
      },
    ];

    const conversationHistory = service.buildFromEvents(events);

    // Should only include user.message and engine.message
    expect(conversationHistory).toHaveLength(2);
    expect(conversationHistory[0].role).toBe("user");
    expect(conversationHistory[0].content).toBe("Hi there");
    expect(conversationHistory[1].role).toBe("assistant");
    expect(conversationHistory[1].content).toBe("Hello! How can I help?");
  });

  it("should handle empty interaction events gracefully", () => {
    const service = createConversationHistoryService();

    const conversationHistory = service.buildFromEvents([]);

    expect(conversationHistory).toEqual([]);
    expect(conversationHistory).toHaveLength(0);
  });

  it("should handle empty events gracefully", () => {
    const service = createConversationHistoryService();

    const conversationHistory = service.buildFromEvents([]);

    expect(Array.isArray(conversationHistory)).toBe(true);
    expect(conversationHistory).toHaveLength(0);
  });

  it("should preserve insertion order of messages from events", () => {
    const service = createConversationHistoryService();

    const events: InteractionEvent[] = [
      {
        id: "evt-1",
        type: "user.message",
        nodeId: "chat-node",
        payload: { text: "First" },
        timestamp: "2026-01-05T12:00:00Z",
      },
      {
        id: "evt-2",
        type: "engine.message",
        nodeId: "chat-node",
        payload: { content: "Second" },
        timestamp: "2026-01-05T12:00:01Z",
      },
      {
        id: "evt-3",
        type: "engine.message",
        nodeId: "chat-node",
        payload: { content: "Third" },
        timestamp: "2026-01-05T12:00:02Z",
      },
    ];

    const conversationHistory = service.buildFromEvents(events);

    // Service preserves insertion order from events
    expect(conversationHistory).toHaveLength(3);
    expect(conversationHistory[0].content).toBe("First");
    expect(conversationHistory[1].content).toBe("Second");
    expect(conversationHistory[2].content).toBe("Third");
  });

  it("should only include events with conversation-relevant types", () => {
    const service = createConversationHistoryService();

    const events: InteractionEvent[] = [
      {
        id: "evt-1",
        type: "timer.expired",
        nodeId: "timer-node",
        payload: { timerId: "timer-1" },
        timestamp: "2026-01-05T12:00:00Z",
      },
      {
        id: "evt-2",
        type: "user.click",
        nodeId: "button-node",
        payload: { buttonId: "btn-1" },
        timestamp: "2026-01-05T12:00:01Z",
      },
      {
        id: "evt-3",
        type: "user.message",
        nodeId: "chat-node",
        payload: { text: "Hello" },
        timestamp: "2026-01-05T12:00:02Z",
      },
    ];

    const conversationHistory = service.buildFromEvents(events);

    // Should only include user.message
    expect(conversationHistory).toHaveLength(1);
    expect(conversationHistory[0].content).toBe("Hello");
  });

  it("should get last user message from history", () => {
    const service = createConversationHistoryService();

    const events: InteractionEvent[] = [
      {
        id: "evt-1",
        type: "user.message",
        nodeId: "chat-node",
        payload: { text: "First question" },
        timestamp: "2026-01-05T12:00:00Z",
      },
      {
        id: "evt-2",
        type: "engine.message",
        nodeId: "chat-node",
        payload: { content: "Answer to first" },
        timestamp: "2026-01-05T12:00:01Z",
      },
      {
        id: "evt-3",
        type: "user.message",
        nodeId: "chat-node",
        payload: { text: "Second question" },
        timestamp: "2026-01-05T12:00:02Z",
      },
    ];

    const conversationHistory = service.buildFromEvents(events);
    const lastUserMessage = service.getLastUserMessage(conversationHistory);

    expect(lastUserMessage).toBe("Second question");
  });

  it("should return empty string when no user messages exist", () => {
    const service = createConversationHistoryService();

    const events: InteractionEvent[] = [
      {
        id: "evt-1",
        type: "engine.message",
        nodeId: "chat-node",
        payload: { content: "Welcome" },
        timestamp: "2026-01-05T12:00:00Z",
      },
    ];

    const conversationHistory = service.buildFromEvents(events);
    const lastUserMessage = service.getLastUserMessage(conversationHistory);

    expect(lastUserMessage).toBe("");
  });

  it("should include button clicks with labels as user messages", () => {
    const service = createConversationHistoryService();

    const events: InteractionEvent[] = [
      {
        id: "evt-1",
        type: "engine.message",
        nodeId: "agent-node",
        payload: { content: "What would you like to know?" },
        timestamp: "2026-01-05T12:00:00Z",
      },
      {
        id: "evt-2",
        type: "user.click",
        nodeId: "agent-node",
        payload: { buttonId: "ai-reply-0", buttonLabel: "Tell me more" },
        timestamp: "2026-01-05T12:00:01Z",
      },
    ];

    const conversationHistory = service.buildFromEvents(events);

    expect(conversationHistory).toHaveLength(2);
    expect(conversationHistory[0].role).toBe("assistant");
    expect(conversationHistory[0].content).toBe("What would you like to know?");
    expect(conversationHistory[1].role).toBe("user");
    expect(conversationHistory[1].content).toBe("Tell me more");
  });

  it("should filter out button clicks without proper labels", () => {
    const service = createConversationHistoryService();

    const events: InteractionEvent[] = [
      {
        id: "evt-1",
        type: "user.click",
        nodeId: "agent-node",
        // buttonLabel is just the ID - should be filtered
        payload: { buttonId: "ai-reply-0", buttonLabel: "ai-reply-0" },
        timestamp: "2026-01-05T12:00:00Z",
      },
      {
        id: "evt-2",
        type: "user.click",
        nodeId: "button-node",
        // No buttonLabel at all - should be filtered
        payload: { buttonId: "btn-continue" },
        timestamp: "2026-01-05T12:00:01Z",
      },
    ];

    const conversationHistory = service.buildFromEvents(events);

    // Both should be filtered out
    expect(conversationHistory).toHaveLength(0);
  });
});
