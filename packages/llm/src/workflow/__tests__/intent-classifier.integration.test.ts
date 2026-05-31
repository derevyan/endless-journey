/**
 * Intent Classifier Integration Tests
 *
 * Real integration tests that call the Groq API.
 * These tests verify actual LLM behavior, not mocked responses.
 *
 * Requires: GROQ_API_KEY environment variable
 *
 * @module workflow/__tests__/intent-classifier.integration.test
 */

import { describe, it, expect } from "vitest";
import { classifyIntent } from "../intent-classifier";

// Skip tests if GROQ_API_KEY is not available
const hasGroqKey = !!process.env.GROQ_API_KEY;

describe.skipIf(!hasGroqKey)("classifyIntent - Integration", () => {
  // Increase timeout for API calls
  const TEST_TIMEOUT = 30000;

  describe("support vs sales classification", () => {
    const intents = ["support", "sales"];

    it(
      "classifies support request correctly",
      async () => {
        const result = await classifyIntent(
          "I'm having trouble logging into my account. Can you help me reset my password?",
          intents,
          0.6
        );

        expect(result.intent).toBe("support");
        expect(result.confidence).toBeGreaterThan(0.6);
        expect(result.matched).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "classifies sales inquiry correctly",
      async () => {
        const result = await classifyIntent(
          "What are your pricing plans? I'm interested in upgrading to the enterprise tier.",
          intents,
          0.6
        );

        expect(result.intent).toBe("sales");
        expect(result.confidence).toBeGreaterThan(0.6);
        expect(result.matched).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "returns low confidence for ambiguous message",
      async () => {
        const result = await classifyIntent("Hello", intents, 0.8);

        // "Hello" is ambiguous - should have lower confidence or not match
        expect(result.confidence).toBeLessThan(0.9);
      },
      TEST_TIMEOUT
    );
  });

  describe("multi-intent classification", () => {
    const intents = ["billing", "technical", "feedback", "general"];

    it(
      "classifies billing question",
      async () => {
        const result = await classifyIntent(
          "Why was I charged twice this month? I need a refund.",
          intents,
          0.6
        );

        expect(result.intent).toBe("billing");
        expect(result.matched).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "classifies technical issue",
      async () => {
        const result = await classifyIntent(
          "The app keeps crashing when I try to upload a file. Error code 500.",
          intents,
          0.6
        );

        expect(result.intent).toBe("technical");
        expect(result.matched).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "classifies feedback",
      async () => {
        const result = await classifyIntent(
          "I love the new dashboard design! Great job on the update.",
          intents,
          0.6
        );

        expect(result.intent).toBe("feedback");
        expect(result.matched).toBe(true);
      },
      TEST_TIMEOUT
    );
  });

  describe("edge cases", () => {
    it(
      "handles message with no clear intent",
      async () => {
        const result = await classifyIntent(
          "asdfghjkl random words 12345",
          ["support", "sales"],
          0.7
        );

        // Should either return null or low confidence
        if (result.intent !== null) {
          expect(result.confidence).toBeLessThan(0.8);
        }
      },
      TEST_TIMEOUT
    );

    it(
      "handles single-intent classification",
      async () => {
        const result = await classifyIntent(
          "I need help with something",
          ["help"], // Only one intent
          0.5
        );

        expect(result.intent).toBe("help");
        expect(result.matched).toBe(true);
      },
      TEST_TIMEOUT
    );
  });
});
