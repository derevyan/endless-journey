/**
 * Model Call Limit Middleware Tests
 *
 * Tests for the createModelCallLimitMiddleware function that limits
 * model calls per run and/or across threads.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createModelCallLimitMiddleware } from "../../builtin/model-call-limit";
import { AgentMiddlewarePipeline } from "../../middleware-pipeline";
import type { AgentState, AgentRuntime, ModelResponse } from "../../types";

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

function createTestRuntime(): AgentRuntime {
  return {
    context: {},
    nodeId: "test-node",
    sessionId: "test-session",
  };
}

function createTestResponse(): ModelResponse {
  return {
    content: "Test response",
  };
}

// ============================================================================
// Configuration Tests
// ============================================================================

describe("createModelCallLimitMiddleware", () => {
  describe("configuration", () => {
    it("should throw if neither runLimit nor threadLimit is provided", () => {
      expect(() => createModelCallLimitMiddleware({})).toThrow(
        "ModelCallLimitMiddleware requires at least one of runLimit or threadLimit"
      );
    });

    it("should create middleware with only runLimit", () => {
      const mw = createModelCallLimitMiddleware({ runLimit: 10 });
      expect(mw.name).toBe("ModelCallLimitMiddleware");
      expect(mw.priority).toBe(20);
    });

    it("should create middleware with only threadLimit", () => {
      const mw = createModelCallLimitMiddleware({ threadLimit: 50 });
      expect(mw.name).toBe("ModelCallLimitMiddleware");
    });

    it("should create middleware with both limits", () => {
      const mw = createModelCallLimitMiddleware({ runLimit: 10, threadLimit: 50 });
      expect(mw.name).toBe("ModelCallLimitMiddleware");
    });
  });

  // ==========================================================================
  // Run Limit Tests
  // ==========================================================================

  describe("runLimit", () => {
    it("should allow calls under the limit", async () => {
      const mw = createModelCallLimitMiddleware({ runLimit: 5 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      // Initialize state with counter at 2 (under limit of 5)
      const state = pipeline.initializeState(createTestState(), {
        _mwModelCallCount: 2,
      });

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should not jump to end
      expect(result.jumpTo).toBeUndefined();
    });

    it("should return jumpTo:'end' when limit exceeded", async () => {
      const mw = createModelCallLimitMiddleware({ runLimit: 5 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      // Initialize state with counter at 5 (at limit)
      const state = pipeline.initializeState(createTestState(), {
        _mwModelCallCount: 5,
      });

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.jumpTo).toBe("end");
    });

    it("should increment _mwModelCallCount in afterModel", async () => {
      const mw = createModelCallLimitMiddleware({ runLimit: 10 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState());
      expect(state._mwModelCallCount).toBe(0);

      const result = await pipeline.executeAfterModel(
        state,
        createTestRuntime(),
        createTestResponse()
      );

      expect(result.state._mwModelCallCount).toBe(1);
    });

    it("should track multiple model calls", async () => {
      const mw = createModelCallLimitMiddleware({ runLimit: 10 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      let state = pipeline.initializeState(createTestState());

      // Simulate 3 model calls
      for (let i = 0; i < 3; i++) {
        const result = await pipeline.executeAfterModel(
          state,
          createTestRuntime(),
          createTestResponse()
        );
        state = result.state;
      }

      expect(state._mwModelCallCount).toBe(3);
    });
  });

  // ==========================================================================
  // Thread Limit Tests
  // ==========================================================================

  describe("threadLimit", () => {
    it("should allow calls under thread limit", async () => {
      const mw = createModelCallLimitMiddleware({ threadLimit: 50 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState(), {
        _mwThreadModelCallCount: 40,
      });

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.jumpTo).toBeUndefined();
    });

    it("should return jumpTo:'end' when thread limit reached", async () => {
      const mw = createModelCallLimitMiddleware({ threadLimit: 50 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState(), {
        _mwThreadModelCallCount: 50,
      });

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.jumpTo).toBe("end");
    });

    it("should increment _mwThreadModelCallCount in afterModel", async () => {
      const mw = createModelCallLimitMiddleware({ threadLimit: 50 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState(), {
        _mwThreadModelCallCount: 25,
      });

      const result = await pipeline.executeAfterModel(
        state,
        createTestRuntime(),
        createTestResponse()
      );

      expect(result.state._mwThreadModelCallCount).toBe(26);
    });

    it("should track calls across multiple runs via thread count", async () => {
      const mw = createModelCallLimitMiddleware({ runLimit: 10, threadLimit: 50 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      // Simulate thread count persisted from previous run
      const state = pipeline.initializeState(createTestState(), {
        _mwModelCallCount: 0, // New run, reset
        _mwThreadModelCallCount: 45, // Persisted from thread
      });

      const result = await pipeline.executeAfterModel(
        state,
        createTestRuntime(),
        createTestResponse()
      );

      expect(result.state._mwModelCallCount).toBe(1); // Run count increased
      expect(result.state._mwThreadModelCallCount).toBe(46); // Thread count increased
    });
  });

  // ==========================================================================
  // Exit Behavior Tests
  // ==========================================================================

  describe("exitBehavior", () => {
    it("should return jumpTo:'end' when exitBehavior='end' (default)", async () => {
      const mw = createModelCallLimitMiddleware({ runLimit: 5 }); // default is "end"
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState(), {
        _mwModelCallCount: 5,
      });

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.jumpTo).toBe("end");
    });

    it("should throw error when exitBehavior='error'", async () => {
      const mw = createModelCallLimitMiddleware({
        runLimit: 5,
        exitBehavior: "error",
      });
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      const state = pipeline.initializeState(createTestState(), {
        _mwModelCallCount: 5,
      });

      await expect(
        pipeline.executeBeforeModel(state, createTestRuntime())
      ).rejects.toThrow("Model call limit (5 per run) reached");
    });

    it("should throw error with custom message when exitBehavior='error'", async () => {
      const mw = createModelCallLimitMiddleware({
        runLimit: 5,
        exitBehavior: "error",
        limitMessage: "Custom limit message",
      });
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      const state = pipeline.initializeState(createTestState(), {
        _mwModelCallCount: 5,
      });

      await expect(
        pipeline.executeBeforeModel(state, createTestRuntime())
      ).rejects.toThrow("Custom limit message");
    });
  });

  // ==========================================================================
  // Combined Limit Tests
  // ==========================================================================

  describe("combined limits", () => {
    it("should check run limit before thread limit", async () => {
      const mw = createModelCallLimitMiddleware({
        runLimit: 5,
        threadLimit: 50,
        exitBehavior: "error",
      });
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      // Run limit exceeded (5), thread limit not (40)
      const state = pipeline.initializeState(createTestState(), {
        _mwModelCallCount: 5,
        _mwThreadModelCallCount: 40,
      });

      await expect(
        pipeline.executeBeforeModel(state, createTestRuntime())
      ).rejects.toThrow("Model call limit (5 per run) reached");
    });

    it("should check thread limit when run limit not exceeded", async () => {
      const mw = createModelCallLimitMiddleware({
        runLimit: 10,
        threadLimit: 50,
        exitBehavior: "error",
      });
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      // Run limit not exceeded (3), thread limit exceeded (50)
      const state = pipeline.initializeState(createTestState(), {
        _mwModelCallCount: 3,
        _mwThreadModelCallCount: 50,
      });

      await expect(
        pipeline.executeBeforeModel(state, createTestRuntime())
      ).rejects.toThrow("Model call limit (50 per thread) reached");
    });
  });

  // ==========================================================================
  // State Schema Tests
  // ==========================================================================

  describe("state schema", () => {
    it("should initialize counters to 0", () => {
      const mw = createModelCallLimitMiddleware({ runLimit: 10 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState());

      expect(state._mwModelCallCount).toBe(0);
      expect(state._mwThreadModelCallCount).toBe(0);
    });

    it("should preserve existing counter values", () => {
      const mw = createModelCallLimitMiddleware({ runLimit: 10 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState(), {
        _mwModelCallCount: 7,
        _mwThreadModelCallCount: 42,
      });

      expect(state._mwModelCallCount).toBe(7);
      expect(state._mwThreadModelCallCount).toBe(42);
    });
  });
});
