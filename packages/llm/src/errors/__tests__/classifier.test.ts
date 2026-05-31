/**
 * Error Classifier Tests
 *
 * Covers provider-aware classification, circuit breaker handling,
 * and fallback pattern detection.
 */

import { describe, it, expect } from "vitest";
import OpenAI from "openai";
import { CircuitOpenError } from "@journey/infra";
import { classifyError } from "../classifier";

describe("classifyError", () => {
  it("classifies circuit breaker errors", () => {
    const error = new CircuitOpenError("llm-service", "llm");
    const result = classifyError(error);

    expect(result.type).toBe("circuit_open");
    expect(result.retryable).toBe(false);
    expect(result.provider).toBe("llm");
  });

  it("classifies OpenAI rate limit errors with retry-after", () => {
    const headers = new Headers({ "retry-after": "5" });
    const error = new OpenAI.RateLimitError(429, { message: "rate limit" }, "rate limit", headers);

    const result = classifyError(error);

    expect(result.type).toBe("rate_limit");
    expect(result.retryable).toBe(true);
    expect(result.retryAfterMs).toBe(5000);
    expect(result.provider).toBe("openai");
  });

  it("classifies Anthropic auth errors by type and status", () => {
    const error = new Error("Anthropic authentication error");
    (error as Error & { type?: string; status?: number }).type = "authentication_error";
    (error as Error & { type?: string; status?: number }).status = 401;

    const result = classifyError(error);

    expect(result.type).toBe("auth");
    expect(result.retryable).toBe(false);
    expect(result.provider).toBe("anthropic");
  });

  it("classifies Google/Gemini rate limits from gRPC codes", () => {
    const error = new Error("Gemini quota exceeded");
    (error as Error & { code?: number }).code = 8;

    const result = classifyError(error);

    expect(result.type).toBe("rate_limit");
    expect(result.retryable).toBe(true);
    expect(result.provider).toBe("google-genai");
  });

  it("falls back to pattern matching for unknown errors", () => {
    const error = new Error("retry after 30 - rate limit exceeded");
    const result = classifyError(error);

    expect(result.type).toBe("rate_limit");
    expect(result.retryAfterMs).toBe(30000);
    expect(result.retryable).toBe(true);
  });
});
