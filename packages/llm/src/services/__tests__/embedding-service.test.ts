/**
 * Embedding Service Tests
 *
 * Validates successful embedding generation and error wrapping.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMAuthError, LLMError } from "../../types";

vi.mock("@journey/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("../../clients/openai", () => ({
  getOpenAIClient: vi.fn(),
}));

vi.mock("../../errors", () => ({
  classifyError: vi.fn(),
}));

vi.mock("../usage-tracking-service", () => ({
  usageTrackingService: {
    recordUsage: vi.fn(),
  },
}));

vi.mock("../model-registry-service", () => ({
  modelRegistryService: {
    calculateCost: vi.fn().mockReturnValue(0),
  },
}));

import { getOpenAIClient } from "../../clients/openai";
import { classifyError } from "../../errors";
import { generateEmbedding, generateEmbeddings } from "../embedding-service";

describe("Embedding Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a single embedding with defaults", async () => {
    vi.mocked(getOpenAIClient).mockReturnValue({
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          usage: { total_tokens: 42 },
        }),
      },
    } as any);

    const result = await generateEmbedding("hello world");

    expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(result.tokenCount).toBe(42);
    expect(getOpenAIClient).toHaveBeenCalledTimes(1);
  });

  it("returns empty list for batch with no inputs", async () => {
    const result = await generateEmbeddings([]);

    expect(result).toEqual([]);
    expect(getOpenAIClient).not.toHaveBeenCalled();
  });

  it("wraps auth errors as LLMAuthError", async () => {
    vi.mocked(getOpenAIClient).mockReturnValue({
      embeddings: {
        create: vi.fn().mockRejectedValue(new Error("auth failed")),
      },
    } as any);
    vi.mocked(classifyError).mockReturnValue({
      type: "auth",
      retryable: false,
      message: "auth failed",
    });

    await expect(generateEmbedding("secret")).rejects.toBeInstanceOf(LLMAuthError);
  });

  it("wraps non-auth errors as LLMError", async () => {
    vi.mocked(getOpenAIClient).mockReturnValue({
      embeddings: {
        create: vi.fn().mockRejectedValue(new Error("timeout")),
      },
    } as any);
    vi.mocked(classifyError).mockReturnValue({
      type: "timeout",
      retryable: true,
      message: "timeout",
    });

    await expect(generateEmbedding("retry")).rejects.toBeInstanceOf(LLMError);
  });
});
