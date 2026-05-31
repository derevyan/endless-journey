/**
 * Conversation History Strategy Tests
 *
 * Comprehensive tests for conversation history management strategies.
 * Tests all strategies: simple, sliding_window, and summarize.
 *
 * CRITICAL: These tests ensure history works "exactly as configured"
 * per user requirements.
 */

import { describe, it, expect } from "vitest";
import {
  applyConversationHistoryStrategy,
  type HistoryStrategyResult,
} from "../utilities/conversation-history-strategy";
import type { ConversationHistoryConfig, ConversationMessage } from "@journey/schemas";

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Creates an array of test messages with predictable content.
 */
function createMessages(count: number): ConversationMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `Message ${i + 1}`,
    timestamp: new Date(),
  }));
}

/**
 * Creates messages with specific roles for testing.
 */
function createMessagesWithRoles(roles: Array<"user" | "assistant" | "system">): ConversationMessage[] {
  return roles.map((role, i) => ({
    role,
    content: `${role.toUpperCase()} message ${i + 1}`,
    timestamp: new Date(),
  }));
}

// =============================================================================
// NO CONFIG (PASSTHROUGH)
// =============================================================================

describe("applyConversationHistoryStrategy - No Config (Passthrough)", () => {
  it("returns all messages when config is undefined", async () => {
    const messages = createMessages(50);

    const result = await applyConversationHistoryStrategy(messages, undefined);

    expect(result.messages).toHaveLength(50);
    expect(result.messages).toEqual(messages);
    expect(result.appliedStrategy).toBe("passthrough");
    expect(result.summaryGenerated).toBe(false);
    expect(result.originalCount).toBe(50);
  });

  it("preserves message order when no config", async () => {
    const messages = createMessages(5);

    const result = await applyConversationHistoryStrategy(messages, undefined);

    expect(result.messages[0].content).toBe("Message 1");
    expect(result.messages[4].content).toBe("Message 5");
  });

  it("handles empty message array when no config", async () => {
    const result = await applyConversationHistoryStrategy([], undefined);

    expect(result.messages).toHaveLength(0);
    expect(result.originalCount).toBe(0);
  });
});

// =============================================================================
// NONE STRATEGY (STATELESS MODE)
// =============================================================================

describe("applyConversationHistoryStrategy - None Strategy", () => {
  it("returns empty messages array when strategy is none", async () => {
    const messages = createMessages(20);
    const config: ConversationHistoryConfig = { strategy: "none", maxMessages: 12 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(0);
    expect(result.appliedStrategy).toBe("none");
    expect(result.summaryGenerated).toBe(false);
    expect(result.originalCount).toBe(20);
  });

  it("returns empty array even when only one message", async () => {
    const messages = createMessages(1);
    const config: ConversationHistoryConfig = { strategy: "none", maxMessages: 12 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(0);
    expect(result.originalCount).toBe(1);
  });

  it("returns empty array when input is already empty", async () => {
    const config: ConversationHistoryConfig = { strategy: "none", maxMessages: 12 };

    const result = await applyConversationHistoryStrategy([], config);

    expect(result.messages).toHaveLength(0);
    expect(result.originalCount).toBe(0);
    expect(result.appliedStrategy).toBe("none");
  });

  it("ignores maxMessages setting when strategy is none", async () => {
    const messages = createMessages(5);
    const config: ConversationHistoryConfig = { strategy: "none", maxMessages: 100 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(0);
    expect(result.originalCount).toBe(5);
  });
});

// =============================================================================
// SIMPLE STRATEGY
// =============================================================================

describe("applyConversationHistoryStrategy - Simple Strategy", () => {
  it("keeps last N messages when history exceeds maxMessages", async () => {
    const messages = createMessages(20);
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 5 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(5);
    expect(result.messages[0].content).toBe("Message 16"); // First kept is 16th
    expect(result.messages[4].content).toBe("Message 20"); // Last kept is 20th
    expect(result.appliedStrategy).toBe("simple");
    expect(result.summaryGenerated).toBe(false);
    expect(result.originalCount).toBe(20);
  });

  it("returns all messages when history under maxMessages", async () => {
    const messages = createMessages(3);
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 10 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(3);
    expect(result.messages).toEqual(messages);
  });

  it("returns all messages when history equals maxMessages", async () => {
    const messages = createMessages(10);
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 10 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(10);
    expect(result.messages).toEqual(messages);
  });

  it("uses default maxMessages (12) from schema", async () => {
    const messages = createMessages(20);
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 12 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(12);
    expect(result.messages[0].content).toBe("Message 9");
    expect(result.messages[11].content).toBe("Message 20");
  });

  it("handles maxMessages of 1", async () => {
    const messages = createMessages(10);
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 1 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe("Message 10");
  });

  it("preserves message structure (role, content)", async () => {
    const messages: ConversationMessage[] = [
      { role: "system", content: "System prompt", timestamp: new Date() },
      { role: "user", content: "User question", timestamp: new Date() },
      { role: "assistant", content: "Assistant response", timestamp: new Date() },
    ];
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 2 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages[0]).toMatchObject({ role: "user", content: "User question" });
    expect(result.messages[1]).toMatchObject({ role: "assistant", content: "Assistant response" });
  });
});

// =============================================================================
// SLIDING WINDOW STRATEGY
// =============================================================================

describe("applyConversationHistoryStrategy - Sliding Window Strategy", () => {
  it("keeps last N messages (same as simple)", async () => {
    const messages = createMessages(15);
    const config: ConversationHistoryConfig = { strategy: "sliding_window", maxMessages: 8 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(8);
    expect(result.appliedStrategy).toBe("sliding_window");
    expect(result.messages[0].content).toBe("Message 8");
    expect(result.messages[7].content).toBe("Message 15");
  });

  it("returns all messages when under maxMessages", async () => {
    const messages = createMessages(5);
    const config: ConversationHistoryConfig = { strategy: "sliding_window", maxMessages: 10 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(5);
    expect(result.messages).toEqual(messages);
  });

  it("uses default maxMessages from schema", async () => {
    const messages = createMessages(20);
    const config: ConversationHistoryConfig = { strategy: "sliding_window", maxMessages: 12 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(12);
  });
});

// =============================================================================
// SUMMARIZE STRATEGY
// =============================================================================

describe("applyConversationHistoryStrategy - Summarize Strategy", () => {
  // Note: Full integration tests for summarization require mocking the LLM service.
  // These tests focus on the threshold and fallback behavior that can be tested without mocking.

  it("does not summarize when under threshold", async () => {
    const messages = createMessages(10);
    const config: ConversationHistoryConfig = {
      strategy: "summarize",
      maxMessages: 10,
      summarizeAfter: 15,
    };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(10);
    expect(result.summaryGenerated).toBe(false);
    expect(result.appliedStrategy).toBe("summarize");
    expect(result.messages).toEqual(messages);
  });

  it("does not summarize when exactly at threshold", async () => {
    const messages = createMessages(15);
    const config: ConversationHistoryConfig = {
      strategy: "summarize",
      maxMessages: 10,
      summarizeAfter: 15, // Exactly at threshold
    };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(15);
    expect(result.summaryGenerated).toBe(false);
  });

  it("returns all messages when well under threshold", async () => {
    const messages = createMessages(5);
    const config: ConversationHistoryConfig = {
      strategy: "summarize",
      maxMessages: 20,
      summarizeAfter: 30,
    };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(5);
    expect(result.summaryGenerated).toBe(false);
    expect(result.messages).toEqual(messages);
  });

  // Note: Tests for actual summarization (when over threshold) require integration tests
  // with mocked LLM service. Those are better suited for separate integration test files.
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("applyConversationHistoryStrategy - Edge Cases", () => {
  it("handles empty message array", async () => {
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 10 };

    const result = await applyConversationHistoryStrategy([], config);

    expect(result.messages).toHaveLength(0);
    expect(result.originalCount).toBe(0);
  });

  it("handles single message", async () => {
    const messages = createMessages(1);
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 10 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(1);
  });

  it("preserves message order after truncation", async () => {
    const now = new Date();
    const messages: ConversationMessage[] = [
      { role: "user", content: "1", timestamp: now },
      { role: "assistant", content: "2", timestamp: now },
      { role: "user", content: "3", timestamp: now },
      { role: "assistant", content: "4", timestamp: now },
      { role: "user", content: "5", timestamp: now },
    ];
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 3 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages[0].content).toBe("3");
    expect(result.messages[1].content).toBe("4");
    expect(result.messages[2].content).toBe("5");
  });

  it("handles unknown strategy gracefully", async () => {
    const messages = createMessages(10);
    const config = { strategy: "unknown_strategy", maxMessages: 5 } as unknown as ConversationHistoryConfig;

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(10);
    expect(result.appliedStrategy).toBe("unknown");
  });

  it("preserves timestamp field if present", async () => {
    const now = new Date();
    const messages: ConversationMessage[] = [
      { role: "user", content: "Test", timestamp: now },
    ];
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 10 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages[0].timestamp).toEqual(now);
  });

  it("handles messages with all roles (user, assistant, system)", async () => {
    const messages = createMessagesWithRoles(["system", "user", "assistant", "user", "assistant"]);
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 3 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(3);
    // Should keep last 3: assistant, user, assistant
    expect(result.messages[0].role).toBe("assistant");
    expect(result.messages[1].role).toBe("user");
    expect(result.messages[2].role).toBe("assistant");
  });
});

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

describe("applyConversationHistoryStrategy - Config Defaults", () => {
  it("applies default strategy (simple) when strategy missing", async () => {
    const messages = createMessages(20);
    const config = { maxMessages: 5 } as ConversationHistoryConfig;

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(5);
    expect(result.appliedStrategy).toBe("simple");
  });

  it("applies default maxMessages (12) when maxMessages missing", async () => {
    const messages = createMessages(20);
    const config = { strategy: "simple" } as ConversationHistoryConfig;

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(12);
  });

  it("respects maxMessages of 100 (schema max)", async () => {
    const messages = createMessages(150);
    const config: ConversationHistoryConfig = { strategy: "simple", maxMessages: 100 };

    const result = await applyConversationHistoryStrategy(messages, config);

    expect(result.messages).toHaveLength(100);
  });
});
