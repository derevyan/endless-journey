/**
 * Middleware Pipeline Tests
 *
 * Tests for the AgentMiddlewarePipeline class that executes middleware hooks
 * in the correct order: before hooks forward, after hooks reverse, wrap hooks nested.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { AgentMiddlewarePipeline } from "../middleware-pipeline";
import { createMiddleware, createModelRequest } from "../create-middleware";
import type {
  AgentMiddleware,
  AgentState,
  AgentRuntime,
  ModelRequest,
  ModelResponse,
  ToolCallRequest,
  ToolCallResponse,
} from "../types";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    messages: [],
    systemPrompt: "Test prompt",
    model: "gpt-4o",
    ...overrides,
  };
}

function createTestRuntime(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  return {
    context: {},
    nodeId: "test-node",
    sessionId: "test-session",
    ...overrides,
  };
}

function createMockModelRequest(): ModelRequest {
  return createModelRequest({
    state: createTestState(),
    runtime: createTestRuntime(),
    model: "gpt-4o",
    tools: [],
    systemPrompt: "Test",
    messages: [],
  });
}

function createMockToolRequest(): ToolCallRequest {
  return {
    state: createTestState(),
    runtime: createTestRuntime(),
    toolName: "test_tool",
    toolArgs: { input: "test" },
    toolCallId: "call-1",
    tool: {
      name: "test_tool",
      description: "Test tool",
      schema: z.object({ input: z.string() }),
      execute: async () => ({ result: "ok" }),
    },
  };
}

// ============================================================================
// Constructor Tests
// ============================================================================

describe("AgentMiddlewarePipeline", () => {
  describe("constructor", () => {
    it("should sort middleware by priority (lower first)", () => {
      const mw1 = createMiddleware({ name: "MW1", priority: 30 });
      const mw2 = createMiddleware({ name: "MW2", priority: 10 });
      const mw3 = createMiddleware({ name: "MW3", priority: 20 });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2, mw3]);

      expect(pipeline.getMiddlewareNames()).toEqual(["MW2", "MW3", "MW1"]);
    });

    it("should use default priority 100 for middleware without priority", () => {
      const mw1 = createMiddleware({ name: "MW1" }); // default 100
      const mw2 = createMiddleware({ name: "MW2", priority: 50 });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2]);

      expect(pipeline.getMiddlewareNames()).toEqual(["MW2", "MW1"]);
    });

    it("should maintain insertion order for same priority", () => {
      const mw1 = createMiddleware({ name: "MW1", priority: 10 });
      const mw2 = createMiddleware({ name: "MW2", priority: 10 });
      const mw3 = createMiddleware({ name: "MW3", priority: 10 });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2, mw3]);

      // Stable sort should preserve order for equal priorities
      expect(pipeline.getMiddlewareNames()).toEqual(["MW1", "MW2", "MW3"]);
    });
  });

  // ==========================================================================
  // State Initialization Tests
  // ==========================================================================

  describe("initializeState", () => {
    it("should merge stateSchema defaults into state", () => {
      const mw = createMiddleware({
        name: "CounterMW",
        stateSchema: z.object({
          counter: z.number().default(0),
          name: z.string().default("default"),
        }),
      });

      const pipeline = new AgentMiddlewarePipeline([mw]);
      const state = pipeline.initializeState(createTestState());

      expect(state.counter).toBe(0);
      expect(state.name).toBe("default");
    });

    it("should allow initial values to override defaults", () => {
      const mw = createMiddleware({
        name: "CounterMW",
        stateSchema: z.object({
          counter: z.number().default(0),
        }),
      });

      const pipeline = new AgentMiddlewarePipeline([mw]);
      const state = pipeline.initializeState(createTestState(), { counter: 42 });

      expect(state.counter).toBe(42);
    });

    it("should merge defaults from multiple middleware", () => {
      const mw1 = createMiddleware({
        name: "MW1",
        stateSchema: z.object({ field1: z.string().default("a") }),
      });
      const mw2 = createMiddleware({
        name: "MW2",
        stateSchema: z.object({ field2: z.string().default("b") }),
      });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2]);
      const state = pipeline.initializeState(createTestState());

      expect(state.field1).toBe("a");
      expect(state.field2).toBe("b");
    });
  });

  // ==========================================================================
  // beforeAgent Hook Tests
  // ==========================================================================

  describe("executeBeforeAgent", () => {
    it("should execute hooks in forward priority order", async () => {
      const executionOrder: string[] = [];

      const mw1 = createMiddleware({
        name: "MW1",
        priority: 30,
        beforeAgent: async () => {
          executionOrder.push("MW1");
        },
      });
      const mw2 = createMiddleware({
        name: "MW2",
        priority: 10,
        beforeAgent: async () => {
          executionOrder.push("MW2");
        },
      });
      const mw3 = createMiddleware({
        name: "MW3",
        priority: 20,
        beforeAgent: async () => {
          executionOrder.push("MW3");
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2, mw3]);
      await pipeline.executeBeforeAgent(createTestState(), createTestRuntime());

      expect(executionOrder).toEqual(["MW2", "MW3", "MW1"]);
    });

    it("should apply state changes from hook returns", async () => {
      const mw = createMiddleware({
        name: "StateMW",
        stateSchema: z.object({ counter: z.number().default(0) }),
        beforeAgent: async (state) => {
          return { counter: (state.counter as number) + 10 };
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw]);
      const initialState = pipeline.initializeState(createTestState());
      const result = await pipeline.executeBeforeAgent(initialState, createTestRuntime());

      expect(result.state.counter).toBe(10);
    });

    it("should stop and return jumpTo when hook returns jumpTo", async () => {
      const mw2BeforeAgent = vi.fn().mockResolvedValue(undefined);
      const mw1 = createMiddleware({
        name: "JumpMW",
        priority: 10,
        beforeAgent: async () => {
          return { jumpTo: "end" as const };
        },
      });
      const mw2 = createMiddleware({
        name: "NeverCalled",
        priority: 20,
        beforeAgent: async (state, runtime) => mw2BeforeAgent(state, runtime),
      });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2]);
      const result = await pipeline.executeBeforeAgent(createTestState(), createTestRuntime());

      expect(result.jumpTo).toBe("end");
      expect(mw2BeforeAgent).not.toHaveBeenCalled();
    });

    it("should continue on hook error when stopOnError=false", async () => {
      const mw2BeforeAgent = vi.fn().mockResolvedValue(undefined);
      const mw1 = createMiddleware({
        name: "ErrorMW",
        priority: 10,
        beforeAgent: async () => {
          throw new Error("Hook error");
        },
      });
      const mw2 = createMiddleware({
        name: "AfterError",
        priority: 20,
        beforeAgent: async (state, runtime) => mw2BeforeAgent(state, runtime),
      });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2], { stopOnError: false });
      await pipeline.executeBeforeAgent(createTestState(), createTestRuntime());

      expect(mw2BeforeAgent).toHaveBeenCalled();
    });

    it("should throw on hook error when stopOnError=true", async () => {
      const mw = createMiddleware({
        name: "ErrorMW",
        beforeAgent: async () => {
          throw new Error("Hook error");
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      await expect(
        pipeline.executeBeforeAgent(createTestState(), createTestRuntime())
      ).rejects.toThrow("Hook error");
    });
  });

  // ==========================================================================
  // beforeModel Hook Tests
  // ==========================================================================

  describe("executeBeforeModel", () => {
    it("should execute hooks in forward order", async () => {
      const executionOrder: string[] = [];

      const mw1 = createMiddleware({
        name: "MW1",
        priority: 20,
        beforeModel: async () => {
          executionOrder.push("MW1");
        },
      });
      const mw2 = createMiddleware({
        name: "MW2",
        priority: 10,
        beforeModel: async () => {
          executionOrder.push("MW2");
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2]);
      await pipeline.executeBeforeModel(createTestState(), createTestRuntime());

      expect(executionOrder).toEqual(["MW2", "MW1"]);
    });

    it("should merge message changes into state", async () => {
      const mw = createMiddleware({
        name: "MessageMW",
        beforeModel: async () => {
          return {
            messages: [{ role: "user" as const, content: "Modified message", timestamp: new Date() }],
          };
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw]);
      const result = await pipeline.executeBeforeModel(createTestState(), createTestRuntime());

      expect(result.state.messages).toHaveLength(1);
      expect(result.state.messages[0].content).toBe("Modified message");
    });
  });

  // ==========================================================================
  // afterModel Hook Tests
  // ==========================================================================

  describe("executeAfterModel", () => {
    it("should execute hooks in REVERSE order", async () => {
      const executionOrder: string[] = [];

      const mw1 = createMiddleware({
        name: "MW1",
        priority: 10,
        afterModel: async () => {
          executionOrder.push("MW1");
        },
      });
      const mw2 = createMiddleware({
        name: "MW2",
        priority: 20,
        afterModel: async () => {
          executionOrder.push("MW2");
        },
      });
      const mw3 = createMiddleware({
        name: "MW3",
        priority: 30,
        afterModel: async () => {
          executionOrder.push("MW3");
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2, mw3]);
      const response: ModelResponse = { content: "Test response" };
      await pipeline.executeAfterModel(createTestState(), createTestRuntime(), response);

      // Reverse order: MW3 (30), MW2 (20), MW1 (10)
      expect(executionOrder).toEqual(["MW3", "MW2", "MW1"]);
    });

    it("should pass response to hooks", async () => {
      const receivedResponse = { content: "" };

      const mw = createMiddleware({
        name: "ResponseMW",
        afterModel: async (_state, _runtime, response) => {
          receivedResponse.content = response.content;
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw]);
      const response: ModelResponse = { content: "Model response content" };
      await pipeline.executeAfterModel(createTestState(), createTestRuntime(), response);

      expect(receivedResponse.content).toBe("Model response content");
    });
  });

  // ==========================================================================
  // afterAgent Hook Tests
  // ==========================================================================

  describe("executeAfterAgent", () => {
    it("should execute hooks in REVERSE order", async () => {
      const executionOrder: string[] = [];

      const mw1 = createMiddleware({
        name: "MW1",
        priority: 10,
        afterAgent: async () => {
          executionOrder.push("MW1");
        },
      });
      const mw2 = createMiddleware({
        name: "MW2",
        priority: 20,
        afterAgent: async () => {
          executionOrder.push("MW2");
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2]);
      await pipeline.executeAfterAgent(createTestState(), createTestRuntime());

      // Reverse: MW2 (20), MW1 (10)
      expect(executionOrder).toEqual(["MW2", "MW1"]);
    });
  });

  // ==========================================================================
  // wrapModelCall (Onion Pattern) Tests
  // ==========================================================================

  describe("executeWrapModelCall (onion pattern)", () => {
    it("should wrap handlers in correct order (mw1 → mw2 → core → mw2 → mw1)", async () => {
      const executionOrder: string[] = [];

      const mw1 = createMiddleware({
        name: "MW1",
        priority: 10,
        wrapModelCall: async (req, handler) => {
          executionOrder.push("MW1:enter");
          const result = await handler(req);
          executionOrder.push("MW1:exit");
          return result;
        },
      });

      const mw2 = createMiddleware({
        name: "MW2",
        priority: 20,
        wrapModelCall: async (req, handler) => {
          executionOrder.push("MW2:enter");
          const result = await handler(req);
          executionOrder.push("MW2:exit");
          return result;
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2]);

      const coreHandler = vi.fn().mockImplementation(async () => {
        executionOrder.push("core");
        return { content: "response" };
      });

      await pipeline.executeWrapModelCall(createMockModelRequest(), coreHandler);

      // Onion pattern: MW1 wraps MW2 wraps core
      expect(executionOrder).toEqual([
        "MW1:enter",
        "MW2:enter",
        "core",
        "MW2:exit",
        "MW1:exit",
      ]);
    });

    it("should pass through when no wrapModelCall hooks", async () => {
      const mw = createMiddleware({
        name: "NoWrapMW",
        beforeModel: async () => {}, // Has beforeModel but not wrapModelCall
      });

      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ content: "response" });

      const result = await pipeline.executeWrapModelCall(createMockModelRequest(), coreHandler);

      expect(coreHandler).toHaveBeenCalled();
      expect(result.content).toBe("response");
    });

    it("should handle errors and continue to next handler when stopOnError=false", async () => {
      const mw = createMiddleware({
        name: "ErrorWrapMW",
        wrapModelCall: async () => {
          throw new Error("Wrap error");
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: false });

      const coreHandler = vi.fn().mockResolvedValue({ content: "fallback" });

      const result = await pipeline.executeWrapModelCall(createMockModelRequest(), coreHandler);

      // Should continue to core handler after error
      expect(coreHandler).toHaveBeenCalled();
      expect(result.content).toBe("fallback");
    });

    it("should allow middleware to modify request via override", async () => {
      const mw = createMiddleware({
        name: "OverrideMW",
        wrapModelCall: async (req, handler) => {
          const modifiedReq = req.override({ model: "modified-model" });
          return handler(modifiedReq);
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw]);

      let receivedModel = "";
      const coreHandler = vi.fn().mockImplementation(async (req: ModelRequest) => {
        receivedModel = req.model;
        return { content: "response" };
      });

      await pipeline.executeWrapModelCall(createMockModelRequest(), coreHandler);

      expect(receivedModel).toBe("modified-model");
    });
  });

  // ==========================================================================
  // wrapToolCall (Onion Pattern) Tests
  // ==========================================================================

  describe("executeWrapToolCall (onion pattern)", () => {
    it("should wrap tool handlers in onion pattern", async () => {
      const executionOrder: string[] = [];

      const mw1 = createMiddleware({
        name: "MW1",
        priority: 10,
        wrapToolCall: async (req, handler) => {
          executionOrder.push("MW1:enter");
          const result = await handler(req);
          executionOrder.push("MW1:exit");
          return result;
        },
      });

      const mw2 = createMiddleware({
        name: "MW2",
        priority: 20,
        wrapToolCall: async (req, handler) => {
          executionOrder.push("MW2:enter");
          const result = await handler(req);
          executionOrder.push("MW2:exit");
          return result;
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw1, mw2]);

      const coreHandler = vi.fn().mockImplementation(async () => {
        executionOrder.push("core");
        return { result: "tool result" };
      });

      await pipeline.executeWrapToolCall(createMockToolRequest(), coreHandler);

      expect(executionOrder).toEqual([
        "MW1:enter",
        "MW2:enter",
        "core",
        "MW2:exit",
        "MW1:exit",
      ]);
    });

    it("should pass tool request through to core handler", async () => {
      const pipeline = new AgentMiddlewarePipeline([]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "success" });

      const request = createMockToolRequest();
      const result = await pipeline.executeWrapToolCall(request, coreHandler);

      expect(coreHandler).toHaveBeenCalledWith(request);
      expect(result.result).toBe("success");
    });

    it("should allow middleware to block tool execution", async () => {
      const mw = createMiddleware({
        name: "BlockMW",
        wrapToolCall: async () => {
          // Don't call handler - block the tool
          return { result: null, error: new Error("Tool blocked") };
        },
      });

      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "should not be called" });

      const result = await pipeline.executeWrapToolCall(createMockToolRequest(), coreHandler);

      expect(coreHandler).not.toHaveBeenCalled();
      expect(result.error?.message).toBe("Tool blocked");
    });
  });

  // ==========================================================================
  // Utility Method Tests
  // ==========================================================================

  describe("utility methods", () => {
    it("should return middleware count via size property", () => {
      const pipeline = new AgentMiddlewarePipeline([
        createMiddleware({ name: "MW1" }),
        createMiddleware({ name: "MW2" }),
        createMiddleware({ name: "MW3" }),
      ]);

      expect(pipeline.size).toBe(3);
    });

    it("should check if middleware exists via has()", () => {
      const pipeline = new AgentMiddlewarePipeline([
        createMiddleware({ name: "ExistingMW" }),
      ]);

      expect(pipeline.has("ExistingMW")).toBe(true);
      expect(pipeline.has("NonExistingMW")).toBe(false);
    });
  });
});
