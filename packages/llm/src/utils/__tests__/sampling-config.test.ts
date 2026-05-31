/**
 * Sampling Config Tests
 *
 * Tests for the centralized sampling configuration helper that determines
 * whether to use temperature or reasoningEffort based on model capabilities.
 *
 * Three-tier model support:
 * 1. Reasoning-only models (supportsTemperature: false) → reasoningEffort
 * 2. Hybrid models (supportsReasoning: true) → reasoningEffort (preferred)
 * 3. Standard models → temperature
 *
 * @module utils/__tests__/sampling-config
 */

import { describe, it, expect } from "vitest";
import { buildModelSamplingConfig, isReasoningModel } from "../sampling-config";

describe("buildModelSamplingConfig", () => {
  describe("reasoning-only models (supportsTemperature: false)", () => {
    it("returns reasoningEffort for gemini-3-flash-preview", () => {
      const config = buildModelSamplingConfig({ model: "gemini-3-flash-preview" });

      expect(config.reasoningEffort).toBe("high");
      expect(config.temperature).toBeUndefined();
    });

    it("uses custom reasoningEffort when provided", () => {
      const config = buildModelSamplingConfig({
        model: "gemini-3-flash-preview",
        reasoningEffort: "medium",
      });

      expect(config.reasoningEffort).toBe("medium");
      expect(config.temperature).toBeUndefined();
    });

    it("uses custom defaultReasoningEffort when no reasoningEffort provided", () => {
      const config = buildModelSamplingConfig({
        model: "gemini-3-flash-preview",
        defaultReasoningEffort: "low",
      });

      expect(config.reasoningEffort).toBe("low");
      expect(config.temperature).toBeUndefined();
    });

    it("ignores temperature for reasoning-only models", () => {
      const config = buildModelSamplingConfig({
        model: "gemini-3-flash-preview",
        temperature: 0.5, // Should be ignored for reasoning models
      });

      expect(config.reasoningEffort).toBe("high");
      expect(config.temperature).toBeUndefined();
    });

    it("prefers explicit reasoningEffort over defaultReasoningEffort", () => {
      const config = buildModelSamplingConfig({
        model: "gemini-3-flash-preview",
        reasoningEffort: "medium",
        defaultReasoningEffort: "low",
      });

      expect(config.reasoningEffort).toBe("medium");
    });
  });

  describe("standard models (supportsTemperature: true)", () => {
    it("returns temperature for gpt-4o", () => {
      const config = buildModelSamplingConfig({ model: "gpt-4o" });

      expect(config.temperature).toBe(0.7); // Default
      expect(config.reasoningEffort).toBeUndefined();
    });

    it("returns temperature for claude-haiku-4-5-20251001", () => {
      const config = buildModelSamplingConfig({ model: "claude-haiku-4-5-20251001" });

      expect(config.temperature).toBe(0.7);
      expect(config.reasoningEffort).toBeUndefined();
    });

    it("uses custom temperature when provided", () => {
      const config = buildModelSamplingConfig({
        model: "gpt-4o",
        temperature: 0.3,
      });

      expect(config.temperature).toBe(0.3);
      expect(config.reasoningEffort).toBeUndefined();
    });

    it("uses custom defaultTemperature when no temperature provided", () => {
      const config = buildModelSamplingConfig({
        model: "gpt-4o",
        defaultTemperature: 0.5,
      });

      expect(config.temperature).toBe(0.5);
      expect(config.reasoningEffort).toBeUndefined();
    });

    it("prefers explicit temperature over defaultTemperature", () => {
      const config = buildModelSamplingConfig({
        model: "gpt-4o",
        temperature: 0.3,
        defaultTemperature: 0.9,
      });

      expect(config.temperature).toBe(0.3);
    });

    it("ignores reasoningEffort for standard models", () => {
      const config = buildModelSamplingConfig({
        model: "gpt-4o",
        reasoningEffort: "high", // Should be ignored for standard models
      });

      expect(config.temperature).toBe(0.7);
      expect(config.reasoningEffort).toBeUndefined();
    });
  });

  describe("unknown models (safe fallback)", () => {
    it("falls back to temperature for unknown models", () => {
      const config = buildModelSamplingConfig({ model: "unknown-model-xyz-123" });

      expect(config.temperature).toBe(0.7);
      expect(config.reasoningEffort).toBeUndefined();
    });

    it("uses custom defaults for unknown models", () => {
      const config = buildModelSamplingConfig({
        model: "unknown-model-xyz",
        defaultTemperature: 0.5,
      });

      expect(config.temperature).toBe(0.5);
    });

    it("allows explicit temperature for unknown models", () => {
      const config = buildModelSamplingConfig({
        model: "some-future-model",
        temperature: 0.2,
      });

      expect(config.temperature).toBe(0.2);
    });
  });

  describe("edge cases", () => {
    it("handles temperature of 0 correctly", () => {
      const config = buildModelSamplingConfig({
        model: "gpt-4o",
        temperature: 0,
      });

      expect(config.temperature).toBe(0);
    });

    it("handles temperature of 1 correctly", () => {
      const config = buildModelSamplingConfig({
        model: "gpt-4o",
        temperature: 1,
      });

      expect(config.temperature).toBe(1);
    });

    it("returns only one sampling mode (mutually exclusive)", () => {
      // For reasoning models
      const reasoningConfig = buildModelSamplingConfig({ model: "gemini-3-flash-preview" });
      expect(Object.keys(reasoningConfig)).toHaveLength(1);
      expect(reasoningConfig).toHaveProperty("reasoningEffort");

      // For standard models
      const standardConfig = buildModelSamplingConfig({ model: "gpt-4o" });
      expect(Object.keys(standardConfig)).toHaveLength(1);
      expect(standardConfig).toHaveProperty("temperature");
    });
  });
});

describe("isReasoningModel", () => {
  describe("reasoning-only models", () => {
    it("returns true for gemini-3-flash-preview", () => {
      expect(isReasoningModel("gemini-3-flash-preview")).toBe(true);
    });
  });

  describe("standard models", () => {
    it("returns false for gpt-4o", () => {
      expect(isReasoningModel("gpt-4o")).toBe(false);
    });

    it("returns false for gpt-4o-mini", () => {
      expect(isReasoningModel("gpt-4o-mini")).toBe(false);
    });

    it("returns false for claude-haiku-4-5-20251001", () => {
      expect(isReasoningModel("claude-haiku-4-5-20251001")).toBe(false);
    });

    it("returns false for llama-3.1-8b-instant", () => {
      expect(isReasoningModel("llama-3.1-8b-instant")).toBe(false);
    });
  });

  describe("unknown models", () => {
    it("returns false for unknown models (safe fallback)", () => {
      expect(isReasoningModel("unknown-model-xyz")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isReasoningModel("")).toBe(false);
    });
  });
});

describe("integration: common use cases", () => {
  it("handles agent node configuration (default reasoning)", () => {
    // Agent nodes typically use gemini-3-flash-preview with high reasoning
    const config = buildModelSamplingConfig({
      model: "gemini-3-flash-preview",
      defaultReasoningEffort: "high",
    });

    expect(config).toEqual({ reasoningEffort: "high" });
  });

  it("handles summarization node configuration (low temperature)", () => {
    // Summarization uses llama with low temperature for consistency
    const config = buildModelSamplingConfig({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
    });

    expect(config).toEqual({ temperature: 0.3 });
  });

  it("handles chat conversation configuration (moderate temperature)", () => {
    // Standard chat uses temperature for creativity
    const config = buildModelSamplingConfig({
      model: "gpt-4o",
      defaultTemperature: 0.7,
    });

    expect(config).toEqual({ temperature: 0.7 });
  });

  it("handles mindstate agent with custom config override", () => {
    // Mindstate agents can have custom llmConfig
    const config = buildModelSamplingConfig({
      model: "gpt-4o",
      temperature: 0.3, // Agent-specific override
      defaultTemperature: 0.7,
    });

    expect(config).toEqual({ temperature: 0.3 });
  });
});
