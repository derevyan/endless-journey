/**
 * PII Detection Middleware Tests
 *
 * Tests for the createPIIMiddleware function that detects and handles
 * Personally Identifiable Information in messages.
 */

import { describe, it, expect } from "vitest";
import { createPIIMiddleware } from "../../builtin/pii-detection";
import { AgentMiddlewarePipeline } from "../../middleware-pipeline";
import type { AgentState, AgentRuntime, ModelResponse, ConversationMessage } from "../../types";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestState(messages: Partial<ConversationMessage>[] = []): AgentState {
  return {
    messages: messages.map((m) => ({
      role: m.role as ConversationMessage["role"],
      content: m.content || "",
      ...(m.toolCallId && { toolCallId: m.toolCallId }),
      ...(m.toolCalls && { toolCalls: m.toolCalls }),
      ...(m.metadata && { metadata: m.metadata }),
      timestamp: m.timestamp || new Date(),
    } as ConversationMessage)),
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

function createTestResponse(content: string = "Test response"): ModelResponse {
  return { content };
}

function createMessage(role: "user" | "assistant" | "system", content: string): ConversationMessage {
  return {
    role,
    content,
    timestamp: new Date(),
  };
}

// ============================================================================
// Configuration Tests
// ============================================================================

describe("createPIIMiddleware", () => {
  describe("configuration", () => {
    it("should throw for unknown PII type without custom detector", () => {
      expect(() => createPIIMiddleware("unknown_type")).toThrow(
        'Unknown PII type "unknown_type" and no custom detector provided'
      );
    });

    it("should create middleware with built-in type", () => {
      const mw = createPIIMiddleware("email");
      expect(mw.name).toBe("PIIMiddleware:email");
      expect(mw.priority).toBe(10);
    });

    it("should create middleware with custom detector", () => {
      const mw = createPIIMiddleware("custom_id", {
        detector: /CUST-\d{6}/g,
      });
      expect(mw.name).toBe("PIIMiddleware:custom_id");
    });
  });

  // ==========================================================================
  // Built-in Pattern Tests
  // ==========================================================================

  describe("built-in patterns", () => {
    it("should detect email addresses", async () => {
      const mw = createPIIMiddleware("email", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        createMessage("user", "Contact me at john@example.com please"),
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("Contact me at [REDACTED] please");
    });

    it("should detect phone numbers", async () => {
      const mw = createPIIMiddleware("phone", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Call me at 555-123-4567" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("Call me at [REDACTED]");
    });

    it("should detect phone numbers with various formats", async () => {
      const mw = createPIIMiddleware("phone", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const formats = [
        "(555) 123-4567",
        "555.123.4567",
        "+1 555 123 4567",
      ];

      for (const phone of formats) {
        const state = createTestState([
          { role: "user", content: `Call me at ${phone}` },
        ]);

        const result = await pipeline.executeBeforeModel(state, createTestRuntime());
        expect(result.state.messages[0].content).not.toContain(phone);
      }
    });

    it("should detect SSN patterns", async () => {
      const mw = createPIIMiddleware("ssn", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "My SSN is 123-45-6789" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("My SSN is [REDACTED]");
    });

    it("should detect credit card numbers", async () => {
      const mw = createPIIMiddleware("credit_card", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Card: 4111-1111-1111-1111" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("Card: [REDACTED]");
    });

    it("should detect IP addresses", async () => {
      const mw = createPIIMiddleware("ip", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Server IP: 192.168.1.100" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("Server IP: [REDACTED]");
    });
  });

  // ==========================================================================
  // Strategy Tests
  // ==========================================================================

  describe("strategies", () => {
    it("should redact PII when strategy='redact'", async () => {
      const mw = createPIIMiddleware("email", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Email: test@example.com" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("Email: [REDACTED]");
    });

    it("should use custom redaction text", async () => {
      const mw = createPIIMiddleware("email", {
        strategy: "redact",
        redactionText: "[EMAIL REMOVED]",
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Email: test@example.com" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("Email: [EMAIL REMOVED]");
    });

    it("should mask PII when strategy='mask'", async () => {
      const mw = createPIIMiddleware("phone", {
        strategy: "mask",
        maskKeepLast: 4,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Call: 555-123-4567" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should keep last 4 digits visible
      expect(result.state.messages[0].content).toContain("4567");
      expect(result.state.messages[0].content).toContain("*");
    });

    it("should use custom mask character", async () => {
      const mw = createPIIMiddleware("ssn", {
        strategy: "mask",
        maskChar: "X",
        maskKeepLast: 4,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "SSN: 123-45-6789" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toContain("X");
      expect(result.state.messages[0].content).toContain("6789");
    });

    it("should block and throw when strategy='block'", async () => {
      const mw = createPIIMiddleware("credit_card", { strategy: "block" });
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      const state = createTestState([
        { role: "user", content: "Card: 4111-1111-1111-1111" },
      ]);

      await expect(
        pipeline.executeBeforeModel(state, createTestRuntime())
      ).rejects.toThrow("CREDIT_CARD detected");
    });

    it("should use custom block message", async () => {
      const mw = createPIIMiddleware("credit_card", {
        strategy: "block",
        blockMessage: "Credit cards not allowed!",
      });
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      const state = createTestState([
        { role: "user", content: "Card: 4111-1111-1111-1111" },
      ]);

      await expect(
        pipeline.executeBeforeModel(state, createTestRuntime())
      ).rejects.toThrow("Credit cards not allowed!");
    });

    it("should warn but allow when strategy='warn'", async () => {
      const mw = createPIIMiddleware("email", { strategy: "warn" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Email: test@example.com" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Content should be unchanged
      expect(result.state.messages[0].content).toBe("Email: test@example.com");
    });
  });

  // ==========================================================================
  // Input/Output Application Tests
  // ==========================================================================

  describe("applyToInput/applyToOutput", () => {
    it("should scan input messages when applyToInput=true", async () => {
      const mw = createPIIMiddleware("email", {
        strategy: "redact",
        applyToInput: true,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Email: user@test.com" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("Email: [REDACTED]");
    });

    it("should NOT scan assistant messages in beforeModel", async () => {
      const mw = createPIIMiddleware("email", {
        strategy: "redact",
        applyToInput: true,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "assistant", content: "Email: assistant@test.com" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Assistant message should be unchanged
      expect(result.state.messages[0].content).toBe("Email: assistant@test.com");
    });

    it("should skip input when applyToInput=false", async () => {
      const mw = createPIIMiddleware("email", {
        strategy: "redact",
        applyToInput: false,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Email: user@test.com" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // Should be unchanged since applyToInput=false
      expect(result.state.messages[0].content).toBe("Email: user@test.com");
    });

    it("should scan output when applyToOutput=true and block", async () => {
      const mw = createPIIMiddleware("email", {
        strategy: "block",
        applyToInput: false,
        applyToOutput: true,
      });
      const pipeline = new AgentMiddlewarePipeline([mw], { stopOnError: true });

      const state = createTestState();
      const mockRequest = {
        state,
        runtime: createTestRuntime(),
        model: "gpt-4o",
        tools: [],
        systemPrompt: state.systemPrompt,
        messages: state.messages,
        override: () => mockRequest,
      };

      // Mock handler that returns a response with PII
      const mockHandler = async () => createTestResponse("Contact: support@company.com");

      // Should block the response with PII when using wrapModelCall
      await expect(
        pipeline.executeWrapModelCall(mockRequest, mockHandler)
      ).rejects.toThrow("EMAIL detected");
    });

    it("should redact output when applyToOutput=true and strategy=redact", async () => {
      const mw = createPIIMiddleware("email", {
        strategy: "redact",
        applyToInput: false,
        applyToOutput: true,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState();
      const mockRequest = {
        state,
        runtime: createTestRuntime(),
        model: "gpt-4o",
        tools: [],
        systemPrompt: state.systemPrompt,
        messages: state.messages,
        override: () => mockRequest,
      };

      // Mock handler that returns a response with PII
      const mockHandler = async () => createTestResponse("Contact: support@company.com");

      const result = await pipeline.executeWrapModelCall(mockRequest, mockHandler);

      // Response content should have PII redacted
      expect(result.content).toBe("Contact: [REDACTED]");
    });
  });

  // ==========================================================================
  // Custom Detector Tests
  // ==========================================================================

  describe("custom detector", () => {
    it("should use custom regex pattern", async () => {
      const mw = createPIIMiddleware("employee_id", {
        detector: /EMP-\d{8}/g,
        strategy: "redact",
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Employee: EMP-12345678" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("Employee: [REDACTED]");
    });

    it("should detect multiple occurrences with custom pattern", async () => {
      const mw = createPIIMiddleware("order_id", {
        detector: /ORD-[A-Z]{2}\d{4}/g,
        strategy: "redact",
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Orders: ORD-AB1234 and ORD-CD5678" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("Orders: [REDACTED] and [REDACTED]");
    });
  });

  // ==========================================================================
  // Multiple PII in Same Message Tests
  // ==========================================================================

  describe("multiple PII handling", () => {
    it("should redact multiple occurrences of same type", async () => {
      const mw = createPIIMiddleware("email", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Contact john@test.com or jane@test.com" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe(
        "Contact [REDACTED] or [REDACTED]"
      );
    });

    it("should handle multiple middleware for different PII types", async () => {
      const emailMw = createPIIMiddleware("email", { strategy: "redact" });
      const phoneMw = createPIIMiddleware("phone", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([emailMw, phoneMw]);

      const state = createTestState([
        { role: "user", content: "Email: test@test.com Phone: 555-123-4567" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe(
        "Email: [REDACTED] Phone: [REDACTED]"
      );
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty messages array", async () => {
      const mw = createPIIMiddleware("email", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages).toEqual([]);
    });

    it("should handle messages without PII", async () => {
      const mw = createPIIMiddleware("email", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "user", content: "Hello, how are you?" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      expect(result.state.messages[0].content).toBe("Hello, how are you?");
    });

    it("should handle system messages", async () => {
      const mw = createPIIMiddleware("email", { strategy: "redact" });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = createTestState([
        { role: "system", content: "You are a helpful assistant at admin@system.com" },
      ]);

      const result = await pipeline.executeBeforeModel(state, createTestRuntime());

      // System messages should be unchanged (only scans user messages on input)
      expect(result.state.messages[0].content).toBe(
        "You are a helpful assistant at admin@system.com"
      );
    });
  });
});
