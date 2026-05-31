/**
 * Model Fallback Middleware Tests
 *
 * Tests for the createModelFallbackMiddleware function that automatically
 * tries alternative models when the primary model fails with retryable errors.
 */

import { describe, it, expect, vi } from "vitest";
import { createModelFallbackMiddleware } from "../../builtin/model-fallback";
import { AgentMiddlewarePipeline } from "../../middleware-pipeline";
import { createModelRequest } from "../../create-middleware";
import type { AgentState, AgentRuntime, ModelRequest, ModelResponse } from "../../types";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestState(): AgentState {
  return {
    messages: [],
    systemPrompt: "Test prompt",
    model: "gpt-4o",
  };
}

function createTestRuntime(): AgentRuntime {
  return {
    context: {},
    nodeId: "test-node",
    sessionId: "test-session",
  };
}

function createTestRequest(): ModelRequest {
  return createModelRequest({
    state: createTestState(),
    runtime: createTestRuntime(),
    model: "gpt-4o",
    tools: [],
    systemPrompt: "Test",
    messages: [],
  });
}

function createTestResponse(content: string = "Test response"): ModelResponse {
  return { content };
}

// ============================================================================
// Configuration Tests
// ============================================================================

describe("createModelFallbackMiddleware", () => {
  describe("configuration", () => {
    it("should throw if no fallback models provided", () => {
      expect(() => createModelFallbackMiddleware()).toThrow(
        "ModelFallbackMiddleware requires at least one fallback model"
      );
    });

    it("should create middleware with single fallback", () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      expect(mw.name).toBe("ModelFallbackMiddleware");
      expect(mw.priority).toBe(5);
    });

    it("should create middleware with multiple fallbacks", () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini", "claude-3-5-sonnet");
      expect(mw.name).toBe("ModelFallbackMiddleware");
    });
  });

  // ==========================================================================
  // Success Path Tests
  // ==========================================================================

  describe("success path", () => {
    it("should pass through on successful call", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue(createTestResponse("success"));

      const result = await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(coreHandler).toHaveBeenCalledTimes(1);
      expect(result.content).toBe("success");
    });

    it("should use original model on success", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      let usedModel = "";
      const coreHandler = vi.fn().mockImplementation(async (req: ModelRequest) => {
        usedModel = req.model;
        return createTestResponse();
      });

      await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(usedModel).toBe("gpt-4o");
    });
  });

  // ==========================================================================
  // Fallback Behavior Tests
  // ==========================================================================

  describe("fallback behavior", () => {
    it("should try first fallback on retryable error", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const modelsAttempted: string[] = [];
      const coreHandler = vi.fn().mockImplementation(async (req: ModelRequest) => {
        modelsAttempted.push(req.model);
        if (req.model === "gpt-4o") {
          throw new Error("Rate limit exceeded (429)");
        }
        return createTestResponse("fallback success");
      });

      const result = await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(modelsAttempted).toEqual(["gpt-4o", "gpt-5-mini"]);
      expect(result.content).toBe("fallback success");
    });

    it("should try next fallback if first also fails", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini", "claude-3-5-sonnet");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const modelsAttempted: string[] = [];
      const coreHandler = vi.fn().mockImplementation(async (req: ModelRequest) => {
        modelsAttempted.push(req.model);
        if (req.model === "gpt-4o") {
          throw new Error("Rate limit (429)");
        }
        if (req.model === "gpt-5-mini") {
          throw new Error("Server timeout");
        }
        return createTestResponse("second fallback success");
      });

      const result = await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(modelsAttempted).toEqual(["gpt-4o", "gpt-5-mini", "claude-3-5-sonnet"]);
      expect(result.content).toBe("second fallback success");
    });

    it("should throw after all fallbacks exhausted", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini", "claude-3-5-sonnet");
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      const coreHandler = vi.fn().mockImplementation(async () => {
        throw new Error("Rate limit exceeded");
      });

      await expect(
        pipeline.executeWrapModelCall(createTestRequest(), coreHandler)
      ).rejects.toThrow("Rate limit exceeded");

      // Should have tried all 3 models
      expect(coreHandler).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // Retryable Error Tests
  // ==========================================================================

  describe("retryable errors", () => {
    it("should retry on 429 rate limit", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      let callCount = 0;
      const coreHandler = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Error 429: Too many requests");
        }
        return createTestResponse();
      });

      await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(callCount).toBe(2);
    });

    it("should retry on timeout", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      let callCount = 0;
      const coreHandler = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Request timed out");
        }
        return createTestResponse();
      });

      await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(callCount).toBe(2);
    });

    it("should retry on server unavailable (503)", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      let callCount = 0;
      const coreHandler = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Service unavailable (503)");
        }
        return createTestResponse();
      });

      await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(callCount).toBe(2);
    });

    it("should retry on overloaded error", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      let callCount = 0;
      const coreHandler = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Server is overloaded");
        }
        return createTestResponse();
      });

      await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(callCount).toBe(2);
    });

    it("should NOT retry on validation errors", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      const coreHandler = vi.fn().mockRejectedValue(new Error("Invalid API key"));

      await expect(
        pipeline.executeWrapModelCall(createTestRequest(), coreHandler)
      ).rejects.toThrow("Invalid API key");

      // Should only try once (no retry for non-retryable error)
      expect(coreHandler).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on authentication errors", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      const coreHandler = vi.fn().mockRejectedValue(new Error("Unauthorized: Invalid token"));

      await expect(
        pipeline.executeWrapModelCall(createTestRequest(), coreHandler)
      ).rejects.toThrow("Unauthorized");

      expect(coreHandler).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on bad request errors", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      const coreHandler = vi.fn().mockRejectedValue(
        new Error("Bad Request: Invalid model parameters")
      );

      await expect(
        pipeline.executeWrapModelCall(createTestRequest(), coreHandler)
      ).rejects.toThrow("Bad Request");

      expect(coreHandler).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Request Override Tests
  // ==========================================================================

  describe("request.override", () => {
    it("should use override to switch model", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const modelsUsed: string[] = [];
      const coreHandler = vi.fn().mockImplementation(async (req: ModelRequest) => {
        modelsUsed.push(req.model);
        if (modelsUsed.length === 1) {
          throw new Error("Rate limit exceeded");
        }
        return createTestResponse();
      });

      await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(modelsUsed).toEqual(["gpt-4o", "gpt-5-mini"]);
    });

    it("should preserve other request properties when overriding model", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      let capturedRequest: ModelRequest | null = null;
      const coreHandler = vi.fn().mockImplementation(async (req: ModelRequest) => {
        if (req.model === "gpt-4o") {
          throw new Error("Rate limit");
        }
        capturedRequest = req;
        return createTestResponse();
      });

      // Create a request with custom systemPrompt
      const originalRequest = createModelRequest({
        state: createTestState(),
        runtime: createTestRuntime(),
        model: "gpt-4o",
        tools: [],
        systemPrompt: "Custom prompt",
        messages: [],
      });

      await pipeline.executeWrapModelCall(originalRequest, coreHandler);

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.model).toBe("gpt-5-mini");
      expect(capturedRequest!.systemPrompt).toBe("Custom prompt");
    });
  });

  // ==========================================================================
  // Connection Error Tests
  // ==========================================================================

  describe("connection errors", () => {
    it("should retry on ECONNRESET", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      let callCount = 0;
      const coreHandler = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("read ECONNRESET");
        }
        return createTestResponse();
      });

      await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(callCount).toBe(2);
    });

    it("should retry on network error", async () => {
      const mw = createModelFallbackMiddleware("gpt-5-mini");
      const pipeline = new AgentMiddlewarePipeline([mw]);

      let callCount = 0;
      const coreHandler = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Network error: Unable to connect");
        }
        return createTestResponse();
      });

      await pipeline.executeWrapModelCall(createTestRequest(), coreHandler);

      expect(callCount).toBe(2);
    });
  });
});
