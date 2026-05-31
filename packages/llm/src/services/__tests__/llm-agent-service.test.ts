/**
 * Agent Engine Tests
 *
 * Tests for tool retry with exponential backoff and parallel tool execution.
 * Uses mocked LangChain dependencies for isolated unit testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import type { AgentTool } from "@journey/schemas";

// Mock LangChain dependencies
vi.mock("langchain", () => ({
  initChatModel: vi.fn(),
  tool: vi.fn((execute, options) => ({
    name: options.name,
    description: options.description,
    schema: options.schema,
    func: execute,
  })),
}));

vi.mock("@langchain/core/messages", () => ({
  AIMessage: vi.fn().mockImplementation((content) => ({
    content,
    tool_calls: [],
    usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  })),
  HumanMessage: vi.fn().mockImplementation((content) => ({ content, type: "human" })),
  SystemMessage: vi.fn().mockImplementation((content) => ({ content, type: "system" })),
  ToolMessage: vi.fn().mockImplementation(({ content, tool_call_id }) => ({
    content,
    tool_call_id,
    type: "tool",
  })),
}));

// Import after mocks
import { runAgent } from "../../agent/agent-engine";
import { initChatModel } from "langchain";
import { clearAgentModelCache } from "../../runtime/model-runtime";

describe("Agent Engine (runAgent)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearAgentModelCache(); // Clear model cache to ensure mock is used
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create a mock model
  function createMockModel(responses: Array<{ content: string; tool_calls?: any[] }>) {
    let callIndex = 0;
    return {
      bindTools: vi.fn().mockReturnValue({
        invoke: vi.fn().mockImplementation(async () => {
          const response = responses[callIndex] || responses[responses.length - 1];
          callIndex++;
          return {
            content: response.content,
            tool_calls: response.tool_calls || [],
            usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
          };
        }),
      }),
    };
  }

  describe("Tool Retry with Exponential Backoff", () => {
    it("should retry failed tool with exponential backoff", async () => {
      let attempts = 0;
      const flakyTool: AgentTool = {
        name: "flaky_tool",
        description: "A tool that fails twice then succeeds",
        schema: z.object({ input: z.string() }),
        retry: {
          maxRetries: 3,
          initialDelayMs: 100,
          backoffFactor: 2.0,
        },
        execute: vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error("Transient error");
          }
          return { success: true, attempt: attempts };
        }),
      };

      const mockModel = createMockModel([
        {
          content: "",
          tool_calls: [{ id: "call-1", name: "flaky_tool", args: { input: "test" } }],
        },
        { content: "Tool executed successfully!" },
      ]);

      vi.mocked(initChatModel).mockResolvedValue(mockModel as any);

      // Run with real timers for this test
      vi.useRealTimers();

      const result = await runAgent(
        "Test agent",
        [{ role: "user", content: "Run the flaky tool" }],
        {
          model: "gpt-4o",
          provider: "openai",
          tools: [flakyTool],
          maxIterations: 5,
        }
      );

      expect(attempts).toBe(3); // First 2 fail, 3rd succeeds
      expect(flakyTool.execute).toHaveBeenCalledTimes(3);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls?.[0].result).toEqual({ success: true, attempt: 3 });
    });

    it("should not retry when retryOn returns false", async () => {
      let attempts = 0;
      const selectiveRetryTool: AgentTool = {
        name: "selective_retry",
        description: "Only retries on specific errors",
        schema: z.object({}),
        retry: {
          maxRetries: 3,
          initialDelayMs: 10,
          retryOn: (error) => error.message.includes("network"),
        },
        execute: vi.fn().mockImplementation(async () => {
          attempts++;
          throw new Error("Validation failed"); // Should NOT retry
        }),
      };

      const mockModel = createMockModel([
        {
          content: "",
          tool_calls: [{ id: "call-1", name: "selective_retry", args: {} }],
        },
        { content: "Done" },
      ]);

      vi.mocked(initChatModel).mockResolvedValue(mockModel as any);
      vi.useRealTimers();

      await runAgent(
        "Test agent",
        [{ role: "user", content: "Test" }],
        {
          model: "gpt-4o",
          provider: "openai",
          tools: [selectiveRetryTool],
          maxIterations: 3,
        }
      );

      // Should only attempt once since error doesn't match retryOn
      expect(attempts).toBe(1);
      expect(selectiveRetryTool.execute).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries exceeded", async () => {
      const alwaysFailsTool: AgentTool = {
        name: "always_fails",
        description: "Always fails",
        schema: z.object({}),
        retry: {
          maxRetries: 2,
          initialDelayMs: 10,
        },
        execute: vi.fn().mockRejectedValue(new Error("Permanent failure")),
      };

      const mockModel = createMockModel([
        {
          content: "",
          tool_calls: [{ id: "call-1", name: "always_fails", args: {} }],
        },
        { content: "Error handled" },
      ]);

      vi.mocked(initChatModel).mockResolvedValue(mockModel as any);
      vi.useRealTimers();

      const result = await runAgent(
        "Test agent",
        [{ role: "user", content: "Test" }],
        {
          model: "gpt-4o",
          provider: "openai",
          tools: [alwaysFailsTool],
          maxIterations: 3,
        }
      );

      // Tool should be called 3 times (initial + 2 retries)
      expect(alwaysFailsTool.execute).toHaveBeenCalledTimes(3);
      // Tool call should NOT be in successful results (it failed)
      expect(result.toolCalls).toHaveLength(0);
    });

    it("should succeed on first try when no errors occur", async () => {
      const reliableTool: AgentTool = {
        name: "reliable_tool",
        description: "Always succeeds",
        schema: z.object({ data: z.string() }),
        retry: {
          maxRetries: 3,
          initialDelayMs: 100,
        },
        execute: vi.fn().mockResolvedValue({ result: "success" }),
      };

      const mockModel = createMockModel([
        {
          content: "",
          tool_calls: [{ id: "call-1", name: "reliable_tool", args: { data: "test" } }],
        },
        { content: "Done!" },
      ]);

      vi.mocked(initChatModel).mockResolvedValue(mockModel as any);
      vi.useRealTimers();

      const result = await runAgent(
        "Test agent",
        [{ role: "user", content: "Test" }],
        {
          model: "gpt-4o",
          provider: "openai",
          tools: [reliableTool],
          maxIterations: 3,
        }
      );

      expect(reliableTool.execute).toHaveBeenCalledTimes(1);
      expect(result.toolCalls).toHaveLength(1);
    });
  });

  describe("Parallel Tool Execution", () => {
    it("should execute multiple tools in parallel", async () => {
      const executionOrder: string[] = [];
      const startTimes: Record<string, number> = {};

      const tool1: AgentTool = {
        name: "tool_1",
        description: "First tool",
        schema: z.object({}),
        execute: vi.fn().mockImplementation(async () => {
          startTimes.tool_1 = Date.now();
          executionOrder.push("tool_1_start");
          await new Promise((r) => setTimeout(r, 50));
          executionOrder.push("tool_1_end");
          return { tool: 1 };
        }),
      };

      const tool2: AgentTool = {
        name: "tool_2",
        description: "Second tool",
        schema: z.object({}),
        execute: vi.fn().mockImplementation(async () => {
          startTimes.tool_2 = Date.now();
          executionOrder.push("tool_2_start");
          await new Promise((r) => setTimeout(r, 50));
          executionOrder.push("tool_2_end");
          return { tool: 2 };
        }),
      };

      const mockModel = createMockModel([
        {
          content: "",
          tool_calls: [
            { id: "call-1", name: "tool_1", args: {} },
            { id: "call-2", name: "tool_2", args: {} },
          ],
        },
        { content: "Both tools executed!" },
      ]);

      vi.mocked(initChatModel).mockResolvedValue(mockModel as any);
      vi.useRealTimers();

      const start = Date.now();
      const result = await runAgent(
        "Test agent",
        [{ role: "user", content: "Run both tools" }],
        {
          model: "gpt-4o",
          provider: "openai",
          tools: [tool1, tool2],
          maxIterations: 3,
        }
      );
      const duration = Date.now() - start;

      // Both tools should be called
      expect(tool1.execute).toHaveBeenCalledTimes(1);
      expect(tool2.execute).toHaveBeenCalledTimes(1);
      expect(result.toolCalls).toHaveLength(2);

      // If executed in parallel, both should start before either ends
      // (execution order should show interleaving or near-simultaneous starts)
      // In parallel: tool_1_start, tool_2_start could be in any order, but both before ends
      const tool1StartIdx = executionOrder.indexOf("tool_1_start");
      const tool2StartIdx = executionOrder.indexOf("tool_2_start");
      const tool1EndIdx = executionOrder.indexOf("tool_1_end");
      const tool2EndIdx = executionOrder.indexOf("tool_2_end");

      // Both starts should happen before both ends in parallel execution
      expect(Math.max(tool1StartIdx, tool2StartIdx)).toBeLessThan(
        Math.min(tool1EndIdx, tool2EndIdx)
      );

      // Total time should be ~50ms (parallel), not ~100ms (sequential)
      // Allow some variance for test environment
      expect(duration).toBeLessThan(150);
    });

    it("should handle mixed success/failure in parallel", async () => {
      const successTool: AgentTool = {
        name: "success_tool",
        description: "Succeeds",
        schema: z.object({}),
        execute: vi.fn().mockResolvedValue({ status: "ok" }),
      };

      const failTool: AgentTool = {
        name: "fail_tool",
        description: "Fails",
        schema: z.object({}),
        execute: vi.fn().mockRejectedValue(new Error("Tool failed")),
      };

      const mockModel = createMockModel([
        {
          content: "",
          tool_calls: [
            { id: "call-1", name: "success_tool", args: {} },
            { id: "call-2", name: "fail_tool", args: {} },
          ],
        },
        { content: "Handled mixed results" },
      ]);

      vi.mocked(initChatModel).mockResolvedValue(mockModel as any);
      vi.useRealTimers();

      const result = await runAgent(
        "Test agent",
        [{ role: "user", content: "Test" }],
        {
          model: "gpt-4o",
          provider: "openai",
          tools: [successTool, failTool],
          maxIterations: 3,
        }
      );

      // Success tool should be in results
      expect(result.toolCalls?.find((tc) => tc.name === "success_tool")).toBeDefined();
      // Fail tool should NOT be in results (only successful calls are recorded)
      expect(result.toolCalls?.find((tc) => tc.name === "fail_tool")).toBeUndefined();
    });

    it("should preserve tool call order in messages", async () => {
      const tools: AgentTool[] = [
        {
          name: "tool_a",
          description: "Tool A",
          schema: z.object({}),
          execute: vi.fn().mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 30));
            return { tool: "a" };
          }),
        },
        {
          name: "tool_b",
          description: "Tool B",
          schema: z.object({}),
          execute: vi.fn().mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 10));
            return { tool: "b" };
          }),
        },
        {
          name: "tool_c",
          description: "Tool C",
          schema: z.object({}),
          execute: vi.fn().mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 20));
            return { tool: "c" };
          }),
        },
      ];

      const mockModel = createMockModel([
        {
          content: "",
          tool_calls: [
            { id: "call-a", name: "tool_a", args: {} },
            { id: "call-b", name: "tool_b", args: {} },
            { id: "call-c", name: "tool_c", args: {} },
          ],
        },
        { content: "All done" },
      ]);

      vi.mocked(initChatModel).mockResolvedValue(mockModel as any);
      vi.useRealTimers();

      const result = await runAgent(
        "Test agent",
        [{ role: "user", content: "Test" }],
        {
          model: "gpt-4o",
          provider: "openai",
          tools,
          maxIterations: 3,
        }
      );

      // Results should be in original order (a, b, c), not completion order
      const toolNames = result.toolCalls?.map((tc) => tc.name);
      expect(toolNames).toEqual(["tool_a", "tool_b", "tool_c"]);
    });
  });

  describe("Tool Validation", () => {
    it("should return validation error to LLM when args are invalid", async () => {
      const strictTool: AgentTool = {
        name: "strict_tool",
        description: "Requires specific args",
        schema: z.object({
          required_field: z.string(),
          number_field: z.number(),
        }),
        execute: vi.fn().mockResolvedValue({ ok: true }),
      };

      const mockModel = createMockModel([
        {
          content: "",
          tool_calls: [
            { id: "call-1", name: "strict_tool", args: { wrong_field: "value" } },
          ],
        },
        { content: "Fixed after error" },
      ]);

      vi.mocked(initChatModel).mockResolvedValue(mockModel as any);
      vi.useRealTimers();

      const result = await runAgent(
        "Test agent",
        [{ role: "user", content: "Test" }],
        {
          model: "gpt-4o",
          provider: "openai",
          tools: [strictTool],
          maxIterations: 3,
        }
      );

      // Tool should NOT be executed due to validation failure
      expect(strictTool.execute).not.toHaveBeenCalled();
      // No successful tool calls
      expect(result.toolCalls).toHaveLength(0);
    });

    it("should handle unknown tool gracefully", async () => {
      const knownTool: AgentTool = {
        name: "known_tool",
        description: "A known tool",
        schema: z.object({}),
        execute: vi.fn().mockResolvedValue({ ok: true }),
      };

      const mockModel = createMockModel([
        {
          content: "",
          tool_calls: [
            { id: "call-1", name: "unknown_tool", args: {} }, // Unknown tool
          ],
        },
        { content: "Handled unknown tool" },
      ]);

      vi.mocked(initChatModel).mockResolvedValue(mockModel as any);
      vi.useRealTimers();

      const result = await runAgent(
        "Test agent",
        [{ role: "user", content: "Test" }],
        {
          model: "gpt-4o",
          provider: "openai",
          tools: [knownTool],
          maxIterations: 3,
        }
      );

      // Known tool was never called
      expect(knownTool.execute).not.toHaveBeenCalled();
      // No successful tool calls (unknown tool is an error)
      expect(result.toolCalls).toHaveLength(0);
    });
  });

  describe("Token Usage Tracking", () => {
    it("should accumulate token usage across iterations", async () => {
      const simpleTool: AgentTool = {
        name: "simple_tool",
        description: "Simple tool",
        schema: z.object({}),
        execute: vi.fn().mockResolvedValue({ done: true }),
      };

      const mockModel = createMockModel([
        {
          content: "",
          tool_calls: [{ id: "call-1", name: "simple_tool", args: {} }],
        },
        { content: "Final response" },
      ]);

      vi.mocked(initChatModel).mockResolvedValue(mockModel as any);
      vi.useRealTimers();

      const result = await runAgent(
        "Test agent",
        [{ role: "user", content: "Test" }],
        {
          model: "gpt-4o",
          provider: "openai",
          tools: [simpleTool],
          maxIterations: 3,
        }
      );

      // Should have usage from 2 iterations (tool call + final response)
      expect(result.usage).toBeDefined();
      expect(result.usage?.promptTokens).toBe(20); // 10 per call × 2
      expect(result.usage?.completionTokens).toBe(10); // 5 per call × 2
      expect(result.usage?.totalTokens).toBe(30); // 15 per call × 2
    });
  });
});
