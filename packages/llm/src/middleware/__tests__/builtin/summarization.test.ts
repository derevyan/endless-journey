/**
 * Summarization Middleware Tests
 *
 * Tests for the createSummarizationMiddleware function that compresses
 * long conversation histories by generating summaries.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSummarizationMiddleware } from "../../builtin/summarization";
import { AgentMiddlewarePipeline } from "../../middleware-pipeline";
import type { AgentState, AgentRuntime, ConversationMessage } from "../../types";

// Mock the LLM service
vi.mock("../../../services/llm-service", () => ({
  generateChatResponse: vi.fn().mockResolvedValue({
    result: "This is a test summary of the conversation.",
  }),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createTestState(
  messages: ConversationMessage[] = [],
  overrides: Partial<AgentState> = {}
): AgentState {
  return {
    messages,
    systemPrompt: "Test prompt",
    model: "gpt-4o",
    ...overrides,
  };
}

function createTestRuntime(): AgentRuntime {
  return {
    context: {},
    nodeId: "test-node",
    sessionId: "test-session",
  };
}

function createMessages(count: number): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  for (let i = 0; i < count; i++) {
    const role = i % 2 === 0 ? "user" : "assistant";
    messages.push({
      role: role as "user" | "assistant",
      content: `Message ${i + 1} content that is reasonably long to test token estimation.`,
      timestamp: new Date(),
    });
  }
  return messages;
}

// ============================================================================
// Configuration Tests
// ============================================================================

describe("createSummarizationMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("configuration", () => {
    it("should throw if no trigger condition provided", () => {
      expect(() =>
        createSummarizationMiddleware({
          model: "gpt-5-mini",
          trigger: {},
        })
      ).toThrow("at least one trigger condition");
    });

    it("should create middleware with message trigger", () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 20 },
      });
      expect(mw.name).toBe("SummarizationMiddleware");
      expect(mw.priority).toBe(15);
    });

    it("should create middleware with token trigger", () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { tokens: 4000 },
      });
      expect(mw.name).toBe("SummarizationMiddleware");
    });

    it("should create middleware with fraction trigger", () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { fraction: 0.8 },
      });
      expect(mw.name).toBe("SummarizationMiddleware");
    });
  });

  // ==========================================================================
  // Trigger Condition Tests
  // ==========================================================================

  describe("trigger conditions", () => {
    it("should NOT trigger when under message threshold", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 20 },
        keep: { messages: 6 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      // Only 10 messages - under threshold
      const messages = createMessages(10);
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should not have summarized - messages unchanged
      expect(result.state.messages.length).toBe(10);
    });

    it("should trigger when message count exceeds threshold", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 10 },
        keep: { messages: 4 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      // 15 messages - exceeds threshold
      const messages = createMessages(15);
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should have summarized - fewer messages now
      expect(result.state.messages.length).toBeLessThan(15);
    });

    it("should trigger when token count exceeds threshold", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { tokens: 500 }, // Low threshold
        keep: { messages: 4 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      // Create many messages to exceed token count
      const messages = createMessages(20);
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should have summarized
      expect(result.state.messages.length).toBeLessThan(20);
    });
  });

  // ==========================================================================
  // Keep Settings Tests
  // ==========================================================================

  describe("keep settings", () => {
    it("should keep specified number of recent messages", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 10 },
        keep: { messages: 4 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const messages = createMessages(15);
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should have 1 summary message + 4 kept messages = 5 total
      expect(result.state.messages.length).toBe(5);

      // First message should be the summary
      expect(result.state.messages[0].role).toBe("system");
      expect(result.state.messages[0].content).toContain("Summary");
    });

    it("should preserve most recent messages verbatim", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 8 },
        keep: { messages: 3 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const messages = createMessages(10);
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Last 3 messages should be preserved
      const keptMessages = result.state.messages.slice(1); // Skip summary
      expect(keptMessages).toHaveLength(3);

      // Verify they are the last 3 from original
      expect(keptMessages[2].content).toBe(messages[9].content);
    });
  });

  // ==========================================================================
  // Summary Generation Tests
  // ==========================================================================

  describe("summary generation", () => {
    it("should prepend summary to kept messages", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 5 },
        keep: { messages: 2 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const messages = createMessages(8);
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // First message should be summary
      expect(result.state.messages[0].role).toBe("system");
      expect(result.state.messages[0].content).toContain("Summary");
    });

    it("should use custom summary prefix", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 5 },
        keep: { messages: 2 },
        summaryPrefix: "[CONTEXT]\n",
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const messages = createMessages(8);
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toContain("[CONTEXT]");
    });

    it("should store _mwConversationSummary in state", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 5 },
        keep: { messages: 2 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const messages = createMessages(8);
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state._mwConversationSummary).toBeDefined();
      expect(typeof result.state._mwConversationSummary).toBe("string");
    });

    it("should update _mwSummarizedUpToIndex", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 5 },
        keep: { messages: 2 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const messages = createMessages(8);
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should record how many messages were summarized
      expect(result.state._mwSummarizedUpToIndex).toBe(6); // 8 - 2 = 6
    });
  });

  // ==========================================================================
  // Existing Summary Tests
  // ==========================================================================

  describe("existing summary handling", () => {
    it("should prepend existing summary when not triggering new summarization", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 20 }, // High threshold - won't trigger
        keep: { messages: 6 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      // Only 8 messages but with existing summary
      const messages = createMessages(8);
      const state = pipeline.initializeState(createTestState(messages), {
        _mwConversationSummary: "Previous conversation was about X.",
      });

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should have summary message prepended
      expect(result.state.messages[0].content).toContain("Previous conversation was about X.");
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty messages array", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 5 },
        keep: { messages: 2 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState([]));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should not error, just return unchanged
      expect(result.state.messages).toEqual([]);
    });

    it("should skip system messages when counting for summarization trigger", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 8 },
        keep: { messages: 3 },
        preserveSystemMessages: false, // Disable to test legacy behavior
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const messages: ConversationMessage[] = [
        { role: "system", content: "You are helpful.", timestamp: new Date() },
        ...createMessages(10),
      ];
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should have summarized, keeping only summary + 3 kept (system message dropped)
      expect(result.state.messages.length).toBe(4); // 1 summary + 3 kept
    });
  });

  // ==========================================================================
  // Preserve System Messages Tests
  // ==========================================================================

  describe("preserveSystemMessages option", () => {
    it("should preserve original system messages by default", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 8 },
        keep: { messages: 3 },
        // preserveSystemMessages defaults to true
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const messages: ConversationMessage[] = [
        { role: "system", content: "You are a helpful assistant.", timestamp: new Date() },
        { role: "system", content: "You have access to these tools...", timestamp: new Date() },
        ...createMessages(10),
      ];
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should have: 2 original system + 1 summary + 3 kept = 6 messages
      expect(result.state.messages.length).toBe(6);

      // First two should be the preserved original system messages
      expect(result.state.messages[0].role).toBe("system");
      expect(result.state.messages[0].content).toBe("You are a helpful assistant.");
      expect(result.state.messages[1].role).toBe("system");
      expect(result.state.messages[1].content).toBe("You have access to these tools...");

      // Third should be the summary
      expect(result.state.messages[2].role).toBe("system");
      expect(result.state.messages[2].content).toContain("Summary");
    });

    it("should NOT preserve system messages when option is false", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 8 },
        keep: { messages: 3 },
        preserveSystemMessages: false,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const messages: ConversationMessage[] = [
        { role: "system", content: "You are a helpful assistant.", timestamp: new Date() },
        ...createMessages(10),
      ];
      const state = pipeline.initializeState(createTestState(messages));

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should have: 1 summary + 3 kept = 4 messages (original system dropped)
      expect(result.state.messages.length).toBe(4);

      // First message should be the summary, not the original system
      expect(result.state.messages[0].content).not.toBe("You are a helpful assistant.");
      expect(result.state.messages[0].content).toContain("Summary");
    });

    it("should preserve system messages when prepending existing summary", async () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 20 }, // High threshold - won't trigger
        keep: { messages: 4 },
        // preserveSystemMessages defaults to true
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const messages: ConversationMessage[] = [
        { role: "system", content: "You are the support bot.", timestamp: new Date() },
        ...createMessages(8),
      ];
      const state = pipeline.initializeState(createTestState(messages), {
        _mwConversationSummary: "Previous conversation summary here.",
      });

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // First message should be the preserved original system message
      expect(result.state.messages[0].content).toBe("You are the support bot.");

      // Second message should be the summary
      expect(result.state.messages[1].content).toContain("Previous conversation summary here.");
    });
  });

  // ==========================================================================
  // State Schema Tests
  // ==========================================================================

  describe("state schema", () => {
    it("should initialize state with defaults", () => {
      const mw = createSummarizationMiddleware({
        model: "gpt-5-mini",
        trigger: { messages: 20 },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState([]));

      expect(state._mwConversationSummary).toBeUndefined();
      expect(state._mwSummarizedUpToIndex).toBe(0);
    });
  });
});
