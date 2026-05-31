/**
 * Intent Classifier Unit Tests
 *
 * Minimal tests focusing on:
 * - Input validation (empty message, empty intents)
 * - Error handling (API failures)
 *
 * Real integration tests that call Groq API are in intent-classifier.integration.test.ts
 *
 * @module workflow/__tests__/intent-classifier.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyIntent } from "../intent-classifier";

// Mock the LLM service
vi.mock("../../services/llm-service", () => ({
  generateStructuredOutput: vi.fn(),
}));

import { generateStructuredOutput } from "../../services/llm-service";
const mockGenerateStructuredOutput = vi.mocked(generateStructuredOutput);

// =============================================================================
// TESTS
// =============================================================================

describe("classifyIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Input Validation (prevents unnecessary API calls)
  // ===========================================================================

  describe("input validation", () => {
    it("returns matched:false for empty message without calling LLM", async () => {
      const result = await classifyIntent("", ["support", "sales"], 0.7);

      expect(result).toEqual({
        matched: false,
        intent: null,
        confidence: 0,
        reasoning: "Empty message cannot be classified",
      });
      expect(mockGenerateStructuredOutput).not.toHaveBeenCalled();
    });

    it("returns matched:false for whitespace-only message without calling LLM", async () => {
      const result = await classifyIntent("   ", ["support", "sales"], 0.7);

      expect(result.matched).toBe(false);
      expect(result.reasoning).toContain("Empty message");
      expect(mockGenerateStructuredOutput).not.toHaveBeenCalled();
    });

    it("returns matched:false for empty intents array without calling LLM", async () => {
      const result = await classifyIntent("Hello", [], 0.7);

      expect(result).toEqual({
        matched: false,
        intent: null,
        confidence: 0,
        reasoning: "No intents provided for classification",
      });
      expect(mockGenerateStructuredOutput).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Error Handling (graceful degradation)
  // ===========================================================================

  describe("error handling", () => {
    it("returns matched:false on LLM API error", async () => {
      mockGenerateStructuredOutput.mockRejectedValue(new Error("API rate limit exceeded"));

      const result = await classifyIntent("Hello", ["support"], 0.7);

      expect(result).toEqual({
        matched: false,
        intent: null,
        confidence: 0,
        reasoning: "Classification failed: API rate limit exceeded",
      });
    });

    it("handles non-Error exceptions gracefully", async () => {
      mockGenerateStructuredOutput.mockRejectedValue("Unknown error string");

      const result = await classifyIntent("Hello", ["support"], 0.7);

      expect(result.matched).toBe(false);
      expect(result.reasoning).toContain("Classification failed");
    });
  });

  // ===========================================================================
  // Intent Validation (LLM returning invalid intent)
  // ===========================================================================

  describe("intent validation", () => {
    it("returns matched:false when LLM returns intent not in provided list", async () => {
      mockGenerateStructuredOutput.mockResolvedValue({
        result: {
          selectedIntent: "unknown_intent_not_in_list",
          confidence: 0.95,
          reasoning: "Classified as unknown",
        },
      });

      const result = await classifyIntent("Some message", ["support", "sales"], 0.7);

      expect(result.matched).toBe(false);
      expect(result.intent).toBe("unknown_intent_not_in_list");
      expect(result.confidence).toBe(0.95);
    });
  });
});
