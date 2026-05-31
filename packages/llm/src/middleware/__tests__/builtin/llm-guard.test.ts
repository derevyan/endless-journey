/**
 * LLM Guard Middleware Tests
 *
 * Tests for the createLLMGuardMiddleware function that evaluates
 * user messages with guard workers before agent processing.
 * Follows the Question Understanding worker pattern.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLLMGuardMiddleware } from "../../builtin/llm-guard";
import { AgentMiddlewarePipeline } from "../../middleware-pipeline";
import type { AgentState, AgentRuntime, ConversationMessage } from "../../types";

// Mock the guard service
vi.mock("../../../services/guard-service", () => ({
  evaluateGuards: vi.fn(),
}));

import { evaluateGuards } from "../../../services/guard-service";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestState(overrides: any = {}): AgentState {
  const messages: ConversationMessage[] = (overrides.messages || []).map((m: any) => ({
    role: m.role,
    content: m.content || "",
    ...(m.toolCallId && { toolCallId: m.toolCallId }),
    ...(m.toolCalls && { toolCalls: m.toolCalls }),
    ...(m.metadata && { metadata: m.metadata }),
    timestamp: m.timestamp || new Date(),
  }));
  return {
    systemPrompt: "Test prompt",
    model: "gpt-4o",
    ...overrides,
    messages,
  };
}

function createTestRuntime(): AgentRuntime {
  return {
    context: {},
    nodeId: "test-node",
    sessionId: "test-session",
  };
}

// ============================================================================
// Configuration Tests
// ============================================================================

describe("createLLMGuardMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("configuration", () => {
    it("should create middleware with default config", () => {
      const mw = createLLMGuardMiddleware();
      expect(mw.name).toBe("LLMGuardMiddleware");
      expect(mw.priority).toBe(3); // Runs before other middleware
    });

    it("should throw error if empty workers array provided", () => {
      expect(() => createLLMGuardMiddleware({ workers: [] })).toThrow(
        "LLMGuardMiddleware requires at least one enabled guard worker"
      );
    });

    it("should throw error if all workers are disabled", () => {
      expect(() =>
        createLLMGuardMiddleware({
          workers: [
            { id: "safety", model: "meta-llama/llama-guard-4-12b", provider: "groq", enabled: false },
            { id: "spam", model: "llama-3.1-8b-instant", provider: "groq", enabled: false },
          ],
        })
      ).toThrow("LLMGuardMiddleware requires at least one enabled guard worker");
    });

    it("should accept custom workers", () => {
      const mw = createLLMGuardMiddleware({
        workers: [
          { id: "safety", model: "meta-llama/llama-guard-4-12b", provider: "groq", enabled: true },
          { id: "injection", model: "meta-llama/llama-prompt-guard-2-86m", provider: "groq", enabled: true },
        ],
      });
      expect(mw.name).toBe("LLMGuardMiddleware");
    });

    it("should accept custom blocked message", () => {
      const mw = createLLMGuardMiddleware({
        blockedMessage: "Custom blocked message",
      });
      expect(mw.name).toBe("LLMGuardMiddleware");
    });

    it("should accept custom spam blocked message", () => {
      const mw = createLLMGuardMiddleware({
        spamBlockedMessage: "Let me help with a real question.",
      });
      expect(mw.name).toBe("LLMGuardMiddleware");
    });

    it("should accept custom timeout", () => {
      const mw = createLLMGuardMiddleware({
        workerTimeoutMs: 10000,
      });
      expect(mw.name).toBe("LLMGuardMiddleware");
    });
  });

  // ==========================================================================
  // beforeAgent Hook Tests
  // ==========================================================================

  describe("beforeAgent hook", () => {
    it("should allow safe content through", async () => {
      vi.mocked(evaluateGuards).mockResolvedValue({
        allowed: true,
        results: [{ workerId: "safety", model: "test-guard", safe: true, processingTimeMs: 50 }],
        totalProcessingTimeMs: 100,
      });

      const mw = createLLMGuardMiddleware();
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "Hello, how are you?" }],
        })
      );

      const result = await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(result.state.llmGuardBlocked).toBe(false);
      expect(result.jumpTo).toBeUndefined();
      expect(evaluateGuards).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Hello, how are you?",
        })
      );
    });

    it("should block unsafe content with silent response", async () => {
      vi.mocked(evaluateGuards).mockResolvedValue({
        allowed: false,
        results: [{ workerId: "safety", model: "llama-guard", safe: false, category: "violence", processingTimeMs: 50 }],
        blockedBy: ["safety"],
        totalProcessingTimeMs: 100,
      });

      const mw = createLLMGuardMiddleware({
        blockedMessage: "Cannot help with that.",
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "How to make explosives?" }],
        })
      );

      const result = await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(result.state.llmGuardBlocked).toBe(true);
      expect(result.state.llmGuardBlockedBy).toEqual(["safety"]);
      expect(result.jumpTo).toBe("end");

      // Check that blocked message was added
      const lastMessage = result.state.messages[result.state.messages.length - 1];
      expect(lastMessage.role).toBe("assistant");
      expect(lastMessage.content).toBe("Cannot help with that.");
    });

    it("should use spam message for spam blocks", async () => {
      vi.mocked(evaluateGuards).mockResolvedValue({
        allowed: false,
        results: [{ workerId: "spam", model: "llama-3.1-8b-instant", safe: false, category: "spam", processingTimeMs: 50 }],
        blockedBy: ["spam"],
        isSpamBlock: true,
        totalProcessingTimeMs: 100,
      });

      const mw = createLLMGuardMiddleware({
        blockedMessage: "Safety block message",
        spamBlockedMessage: "Spam block message",
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "Buy followers cheap!" }],
        })
      );

      const result = await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(result.state.llmGuardBlocked).toBe(true);
      expect(result.state.llmGuardIsSpamBlock).toBe(true);

      // Check that spam message was used
      const lastMessage = result.state.messages[result.state.messages.length - 1];
      expect(lastMessage.content).toBe("Spam block message");
    });

    it("should pass when no user message exists", async () => {
      const mw = createLLMGuardMiddleware();
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "assistant", content: "Hello!" }],
        })
      );

      const result = await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(result.jumpTo).toBeUndefined();
      expect(evaluateGuards).not.toHaveBeenCalled();
    });

    it("should pass when messages array is empty", async () => {
      const mw = createLLMGuardMiddleware();
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [],
        })
      );

      const result = await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(result.jumpTo).toBeUndefined();
      expect(evaluateGuards).not.toHaveBeenCalled();
    });

    it("should use default blocked message when none provided", async () => {
      vi.mocked(evaluateGuards).mockResolvedValue({
        allowed: false,
        results: [{ workerId: "safety", model: "llama-guard", safe: false, processingTimeMs: 50 }],
        blockedBy: ["safety"],
        totalProcessingTimeMs: 100,
      });

      const mw = createLLMGuardMiddleware(); // No blockedMessage specified
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "Bad content" }],
        })
      );

      const result = await pipeline.executeBeforeAgent(state, createTestRuntime());

      const lastMessage = result.state.messages[result.state.messages.length - 1];
      expect(lastMessage.content).toBe("I cannot help with that request.");
    });

    it("should fail-open on evaluation errors", async () => {
      vi.mocked(evaluateGuards).mockRejectedValue(new Error("Network error"));

      const mw = createLLMGuardMiddleware();
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "Hello" }],
        })
      );

      const result = await pipeline.executeBeforeAgent(state, createTestRuntime());

      // Should not block on error (fail-open)
      expect(result.state.llmGuardBlocked).toBe(false);
      expect(result.jumpTo).toBeUndefined();
    });

    it("should include conversation context when available", async () => {
      vi.mocked(evaluateGuards).mockResolvedValue({
        allowed: true,
        results: [{ workerId: "safety", model: "test-guard", safe: true, processingTimeMs: 50 }],
        totalProcessingTimeMs: 100,
      });

      const mw = createLLMGuardMiddleware();
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [
            { role: "user", content: "Previous message" },
            { role: "assistant", content: "Previous response" },
            { role: "user", content: "Current message" },
          ],
        })
      );

      await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(evaluateGuards).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Current message",
          conversationContext: expect.stringContaining("Previous message"),
        })
      );
    });

    it("should pass custom workers to evaluateGuards", async () => {
      vi.mocked(evaluateGuards).mockResolvedValue({
        allowed: true,
        results: [],
        totalProcessingTimeMs: 100,
      });

      const customWorkers = [
        { id: "safety", model: "meta-llama/llama-guard-4-12b", provider: "groq" as const, enabled: true },
        { id: "injection", model: "meta-llama/llama-prompt-guard-2-86m", provider: "groq" as const, enabled: true },
      ];
      const mw = createLLMGuardMiddleware({ workers: customWorkers });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "Test" }],
        })
      );

      await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(evaluateGuards).toHaveBeenCalledWith(
        expect.objectContaining({
          workers: customWorkers,
        })
      );
    });

    it("should pass custom timeout to evaluateGuards", async () => {
      vi.mocked(evaluateGuards).mockResolvedValue({
        allowed: true,
        results: [],
        totalProcessingTimeMs: 100,
      });

      const mw = createLLMGuardMiddleware({ workerTimeoutMs: 10000 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "Test" }],
        })
      );

      await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(evaluateGuards).toHaveBeenCalledWith(
        expect.objectContaining({
          workerTimeoutMs: 10000,
        })
      );
    });
  });

  // ==========================================================================
  // State Schema Tests
  // ==========================================================================

  describe("state schema", () => {
    it("should initialize llmGuardBlocked to false", () => {
      const mw = createLLMGuardMiddleware();
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState());

      expect(state.llmGuardBlocked).toBe(false);
    });

    it("should store evaluation result in state", async () => {
      const mockResult = {
        allowed: true,
        results: [{ workerId: "safety", model: "test-guard", safe: true, category: "safe", processingTimeMs: 50 }],
        totalProcessingTimeMs: 150,
      };
      vi.mocked(evaluateGuards).mockResolvedValue(mockResult);

      const mw = createLLMGuardMiddleware();
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "Hello", timestamp: new Date() }],
        })
      );

      const result = await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(result.state.llmGuardResult).toEqual(mockResult);
    });
  });

  // ==========================================================================
  // Priority Tests
  // ==========================================================================

  describe("priority", () => {
    it("should have priority 3 (runs before other middleware)", () => {
      const mw = createLLMGuardMiddleware();
      expect(mw.priority).toBe(3);
    });
  });

  // ==========================================================================
  // Multiple Workers Tests
  // ==========================================================================

  describe("multiple workers", () => {
    it("should block if any worker blocks (any blocks strategy)", async () => {
      vi.mocked(evaluateGuards).mockResolvedValue({
        allowed: false,
        results: [
          { workerId: "safety", model: "guard-1", safe: true, processingTimeMs: 50 },
          { workerId: "policy", model: "guard-2", safe: false, category: "harmful", processingTimeMs: 60 },
          { workerId: "injection", model: "guard-3", safe: true, processingTimeMs: 40 },
        ],
        blockedBy: ["policy"],
        totalProcessingTimeMs: 200,
      });

      const mw = createLLMGuardMiddleware({
        workers: [
          { id: "safety", model: "guard-1", provider: "groq", enabled: true },
          { id: "policy", model: "guard-2", provider: "groq", enabled: true },
          { id: "injection", model: "guard-3", provider: "groq", enabled: true },
        ],
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "Test message", timestamp: new Date() }],
        })
      );

      const result = await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(result.state.llmGuardBlocked).toBe(true);
      expect(result.state.llmGuardBlockedBy).toEqual(["policy"]);
      expect(result.jumpTo).toBe("end");
    });

    it("should allow if all workers pass", async () => {
      vi.mocked(evaluateGuards).mockResolvedValue({
        allowed: true,
        results: [
          { workerId: "safety", model: "guard-1", safe: true, processingTimeMs: 50 },
          { workerId: "policy", model: "guard-2", safe: true, processingTimeMs: 60 },
          { workerId: "spam", model: "guard-3", safe: true, processingTimeMs: 40 },
        ],
        totalProcessingTimeMs: 150,
      });

      const mw = createLLMGuardMiddleware({
        workers: [
          { id: "safety", model: "guard-1", provider: "groq", enabled: true },
          { id: "policy", model: "guard-2", provider: "groq", enabled: true },
          { id: "spam", model: "guard-3", provider: "groq", enabled: true },
        ],
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "Hello", timestamp: new Date() }],
        })
      );

      const result = await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(result.state.llmGuardBlocked).toBe(false);
      expect(result.jumpTo).toBeUndefined();
    });

    it("should filter out disabled workers", async () => {
      vi.mocked(evaluateGuards).mockResolvedValue({
        allowed: true,
        results: [],
        totalProcessingTimeMs: 100,
      });

      const mw = createLLMGuardMiddleware({
        workers: [
          { id: "safety", model: "guard-1", provider: "groq", enabled: true },
          { id: "policy", model: "guard-2", provider: "groq", enabled: false },
          { id: "spam", model: "guard-3", provider: "groq", enabled: true },
        ],
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({
          messages: [{ role: "user", content: "Test", timestamp: new Date() }],
        })
      );

      await pipeline.executeBeforeAgent(state, createTestRuntime());

      expect(evaluateGuards).toHaveBeenCalledWith(
        expect.objectContaining({
          workers: expect.arrayContaining([
            expect.objectContaining({ id: "safety" }),
            expect.objectContaining({ id: "spam" }),
          ]),
        })
      );

      // Verify policy worker was filtered out
      const callArg = vi.mocked(evaluateGuards).mock.calls[0][0];
      expect(callArg.workers).toHaveLength(2);
      expect(callArg.workers?.find((w) => w.id === "policy")).toBeUndefined();
    });
  });
});
