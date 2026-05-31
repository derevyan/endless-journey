/**
 * Parse AI Response Tests
 *
 * Tests for parseAIResponse and buttonsToConfig functions.
 * These functions handle structured output parsing for quick-reply buttons.
 *
 * @module handlers/__tests__/parse-ai-response.test
 */

import { describe, it, expect } from "vitest";
import { parseAIResponse, buttonsToConfig } from "../types/agent/handler";

// =============================================================================
// parseAIResponse Tests
// =============================================================================

describe("parseAIResponse", () => {
  describe("valid JSON parsing", () => {
    it("parses valid JSON with response and buttons", () => {
      const json = JSON.stringify({
        response: "Hello! How can I help?",
        buttons: [
          { label: "Yes", emoji: "✅" },
          { label: "No", emoji: "❌" },
        ],
      });

      const result = parseAIResponse(json);

      expect(result.response).toBe("Hello! How can I help?");
      expect(result.buttons).toHaveLength(2);
      expect(result.buttons![0]).toEqual({ label: "Yes", emoji: "✅" });
      expect(result.buttons![1]).toEqual({ label: "No", emoji: "❌" });
    });

    it("parses valid JSON with only response (no buttons)", () => {
      const json = JSON.stringify({
        response: "Hello! No buttons here.",
      });

      const result = parseAIResponse(json);

      expect(result.response).toBe("Hello! No buttons here.");
      expect(result.buttons).toBeUndefined();
    });

    it("handles empty buttons array", () => {
      const json = JSON.stringify({
        response: "Empty buttons array",
        buttons: [],
      });

      const result = parseAIResponse(json);

      expect(result.response).toBe("Empty buttons array");
      expect(result.buttons).toEqual([]);
    });
  });

  describe("fallback behavior", () => {
    it("falls back to plain text when JSON is invalid", () => {
      const plainText = "This is not JSON";

      const result = parseAIResponse(plainText);

      expect(result.response).toBe("This is not JSON");
      expect(result.buttons).toBeUndefined();
    });

    it("falls back when response field is missing", () => {
      const json = JSON.stringify({
        buttons: [{ label: "Option 1" }],
      });

      const result = parseAIResponse(json);

      // When response field is not a string, falls back to original text
      expect(result.response).toBe(json);
      expect(result.buttons).toHaveLength(1);
    });

    it("falls back when response field is not a string", () => {
      const json = JSON.stringify({
        response: 123, // Number instead of string
        buttons: [{ label: "Option 1" }],
      });

      const result = parseAIResponse(json);

      // Falls back to original text when response is not a string
      expect(result.response).toBe(json);
      expect(result.buttons).toHaveLength(1);
    });

    it("handles malformed buttons (not array)", () => {
      const json = JSON.stringify({
        response: "Hello",
        buttons: "not-an-array",
      });

      const result = parseAIResponse(json);

      expect(result.response).toBe("Hello");
      expect(result.buttons).toBeUndefined();
    });

    it("handles null buttons", () => {
      const json = JSON.stringify({
        response: "Hello",
        buttons: null,
      });

      const result = parseAIResponse(json);

      expect(result.response).toBe("Hello");
      expect(result.buttons).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles empty string input", () => {
      const result = parseAIResponse("");

      expect(result.response).toBe("");
      expect(result.buttons).toBeUndefined();
    });

    it("handles whitespace-only input", () => {
      const result = parseAIResponse("   ");

      expect(result.response).toBe("   ");
      expect(result.buttons).toBeUndefined();
    });

    it("handles JSON with extra fields", () => {
      const json = JSON.stringify({
        response: "Hello",
        buttons: [{ label: "Yes" }],
        extraField: "ignored",
        anotherField: 123,
      });

      const result = parseAIResponse(json);

      expect(result.response).toBe("Hello");
      expect(result.buttons).toHaveLength(1);
    });
  });
});

// =============================================================================
// buttonsToConfig Tests
// =============================================================================

describe("buttonsToConfig", () => {
  it("converts buttons with label and emoji", () => {
    const buttons = [
      { label: "Yes", emoji: "✅" },
      { label: "No", emoji: "❌" },
    ];

    const result = buttonsToConfig(buttons);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "ai-reply-0", text: "✅ Yes" });
    expect(result[1]).toEqual({ id: "ai-reply-1", text: "❌ No" });
  });

  it("converts buttons with only label (no emoji)", () => {
    const buttons = [{ label: "Continue" }, { label: "Cancel" }];

    const result = buttonsToConfig(buttons);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "ai-reply-0", text: "Continue" });
    expect(result[1]).toEqual({ id: "ai-reply-1", text: "Cancel" });
  });

  it("limits to 4 buttons max", () => {
    const buttons = [
      { label: "One" },
      { label: "Two" },
      { label: "Three" },
      { label: "Four" },
      { label: "Five" },
      { label: "Six" },
    ];

    const result = buttonsToConfig(buttons);

    expect(result).toHaveLength(4);
    expect(result[3].text).toBe("Four");
  });

  it("truncates long labels to 35 chars", () => {
    const buttons = [
      { label: "This is a very long button label that exceeds the maximum" },
    ];

    const result = buttonsToConfig(buttons);

    expect(result[0].text.length).toBeLessThanOrEqual(35);
    // "This is a very long button label th" = 35 chars exactly
    expect(result[0].text).toBe("This is a very long button label th");
  });

  it("truncates emoji + label combined to 35 chars", () => {
    const buttons = [
      { label: "This is a long label that will be truncated", emoji: "🎉" },
    ];

    const result = buttonsToConfig(buttons);

    expect(result[0].text.length).toBeLessThanOrEqual(35);
    expect(result[0].text.startsWith("🎉")).toBe(true);
  });

  it("generates unique IDs for each button", () => {
    const buttons = [{ label: "A" }, { label: "B" }, { label: "C" }];

    const result = buttonsToConfig(buttons);

    const ids = result.map((b) => b.id);
    expect(new Set(ids).size).toBe(3); // All unique
    expect(ids).toEqual(["ai-reply-0", "ai-reply-1", "ai-reply-2"]);
  });

  it("handles empty array", () => {
    const result = buttonsToConfig([]);

    expect(result).toEqual([]);
  });

  it("handles buttons with empty labels", () => {
    const buttons = [{ label: "", emoji: "🎯" }];

    const result = buttonsToConfig(buttons);

    expect(result[0].text).toBe("🎯 ");
  });
});

// =============================================================================
// Integration: parseAIResponse + buttonsToConfig
// =============================================================================

describe("parseAIResponse + buttonsToConfig integration", () => {
  it("full flow: JSON response → parsed → button config", () => {
    const aiResponse = JSON.stringify({
      response: "Which option do you prefer?",
      buttons: [
        { label: "Option A", emoji: "🅰️" },
        { label: "Option B", emoji: "🅱️" },
      ],
    });

    const parsed = parseAIResponse(aiResponse);
    const buttonConfig = parsed.buttons ? buttonsToConfig(parsed.buttons) : [];

    expect(parsed.response).toBe("Which option do you prefer?");
    expect(buttonConfig).toHaveLength(2);
    expect(buttonConfig[0]).toEqual({ id: "ai-reply-0", text: "🅰️ Option A" });
    expect(buttonConfig[1]).toEqual({ id: "ai-reply-1", text: "🅱️ Option B" });
  });

  it("handles plain text response (no buttons)", () => {
    const aiResponse = "Hello! This is a plain text response.";

    const parsed = parseAIResponse(aiResponse);
    const buttonConfig = parsed.buttons ? buttonsToConfig(parsed.buttons) : [];

    expect(parsed.response).toBe("Hello! This is a plain text response.");
    expect(buttonConfig).toEqual([]);
  });
});
