/**
 * Model Registry Service Tests
 *
 * Tests for critical behaviors:
 * - Re-initialization clears old entries (P0-2 fix verification)
 * - Cost calculation uses fuzzy matching
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { modelRegistryService } from "../model-registry-service";
import { setModelRegistryAdapter, NoopModelAdapter } from "../../adapters";

// Test adapter with sample models (tracks state like real adapter)
// Includes both LLM and audio models to test category filtering
class TestModelAdapter extends NoopModelAdapter {
  private models: Map<string, any> = new Map([
    [
      "gpt-4o",
      {
        id: "gpt-4o",
        displayName: "GPT-4o",
        provider: "openai",
        category: "llm", // LLM model
        supportsTemperature: true,
        capabilities: { reasoning: true, vision: true, toolCalling: true },
        contextWindow: 128000,
        outputLimit: 16384,
        pricing: { input: 2.5, output: 10 },
      },
    ],
    [
      "claude-opus",
      {
        id: "claude-opus",
        displayName: "Claude Opus",
        provider: "anthropic",
        category: "llm", // LLM model
        supportsTemperature: true,
        capabilities: { reasoning: true, vision: true, toolCalling: true },
        contextWindow: 200000,
        outputLimit: 8192,
        pricing: { input: 3, output: 15 },
      },
    ],
    [
      "gemini-2.0-flash",
      {
        id: "gemini-2.0-flash",
        displayName: "Gemini 2.0 Flash",
        provider: "google-genai",
        category: "llm", // LLM model
        supportsTemperature: true,
        capabilities: { reasoning: true, vision: true, toolCalling: true },
        contextWindow: 1000000,
        outputLimit: 8192,
        pricing: { input: 0.075, output: 0.3 },
      },
    ],
    [
      "llama-3.3-70b",
      {
        id: "llama-3.3-70b",
        displayName: "Llama 3.3 70B",
        provider: "groq",
        category: "llm", // LLM model
        supportsTemperature: true,
        capabilities: { reasoning: false, vision: false, toolCalling: true },
        contextWindow: 131072,
        outputLimit: 8192,
        pricing: { input: 0.59, output: 0.79 },
      },
    ],
    [
      "eleven_multilingual_v2",
      {
        id: "eleven_multilingual_v2",
        displayName: "ElevenLabs Multilingual v2",
        provider: "elevenlabs",
        category: "audio", // Audio model - NOT an LLM
        audio: {
          type: "tts",
          perCharacter: 0.00024,
        },
        pricing: { input: 0, output: 0 },
      },
    ],
    [
      "tts-1",
      {
        id: "tts-1",
        displayName: "OpenAI TTS-1",
        provider: "openai",
        category: "audio", // Audio model
        audio: {
          type: "tts",
          perCharacter: 0.000015,
        },
        pricing: { input: 0, output: 0 },
      },
    ],
  ]);

  override getModel(modelId: string) {
    // Exact match
    const exact = this.models.get(modelId);
    if (exact) return exact;

    // Fuzzy match: strip provider prefix and normalize
    // e.g., "openai/gpt-4o" → "gpt-4o" → "gpt4o"
    let normalizedInput = modelId.toLowerCase();
    // Remove provider prefix if present (e.g., "openai/", "anthropic/")
    const slashIndex = normalizedInput.indexOf("/");
    if (slashIndex !== -1) {
      normalizedInput = normalizedInput.slice(slashIndex + 1);
    }
    // Remove all non-alphanumeric
    normalizedInput = normalizedInput.replace(/[^a-z0-9]/g, "");

    // Compare with stored models
    for (const [id, model] of this.models) {
      const normalizedId = id.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalizedId === normalizedInput) {
        return model;
      }
    }
    return undefined;
  }

  override getModels() {
    return Array.from(this.models.values());
  }

  override calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getModel(modelId);
    if (!model) return 0;
    const inputCost = (inputTokens / 1_000_000) * model.pricing.input;
    const outputCost = (outputTokens / 1_000_000) * model.pricing.output;
    return inputCost + outputCost;
  }

  override isReady(): boolean {
    return this.models.size > 0;
  }

  // Support clearing for tests
  clear() {
    this.models.clear();
  }
}

describe("Model Registry Service", () => {
  // Setup test adapter before each test
  beforeEach(() => {
    const testAdapter = new TestModelAdapter();
    setModelRegistryAdapter(testAdapter);
  });

  describe("initialize()", () => {
    it("should load models from JSON file", async () => {
      await modelRegistryService.initialize();

      const models = modelRegistryService.getModels();
      expect(models.length).toBeGreaterThan(0);

      // Check we have models from multiple providers
      const providers = new Set(models.map((m) => m.provider));
      expect(providers.size).toBeGreaterThan(1);
    });

    it("should clear existing entries on re-initialization (P0-2 fix)", async () => {
      // First initialization
      await modelRegistryService.initialize();
      const firstCount = modelRegistryService.getModels().length;

      // Second initialization - should NOT duplicate entries
      await modelRegistryService.initialize();
      const secondCount = modelRegistryService.getModels().length;

      // FIX VERIFICATION: Counts should be equal because clear() is called
      expect(secondCount).toBe(firstCount);
    });

    it("should not have duplicate models after multiple initializations", async () => {
      // Initialize multiple times
      await modelRegistryService.initialize();
      await modelRegistryService.initialize();
      await modelRegistryService.initialize();

      // Get models by provider
      const modelsByProvider = modelRegistryService.getModelsByProvider();

      // Check for duplicates within each provider
      for (const [provider, models] of Object.entries(modelsByProvider)) {
        const ids = models.map((m) => m.id);
        const uniqueIds = new Set(ids);
        expect(ids.length).toBe(uniqueIds.size);
      }
    });
  });

  describe("calculateCost()", () => {
    it("should calculate cost for known models", () => {
      // Use a model that should be in the registry
      const cost = modelRegistryService.calculateCost("gpt-4o", 1000, 500);
      expect(cost).toBeGreaterThan(0);
    });

    it("should return 0 for unknown models", () => {
      const cost = modelRegistryService.calculateCost("unknown-model-xyz", 1000, 500);
      expect(cost).toBe(0);
    });

    it("should use fuzzy matching for model names with provider prefix", () => {
      // Test that "openai/gpt-4o" matches "gpt-4o"
      const directCost = modelRegistryService.calculateCost("gpt-4o", 1000, 500);
      const prefixedCost = modelRegistryService.calculateCost("openai/gpt-4o", 1000, 500);

      // Both should return the same non-zero cost
      expect(directCost).toBeGreaterThan(0);
      expect(prefixedCost).toBe(directCost);
    });
  });

  describe("getModel()", () => {
    it("should return model metadata for known models", () => {
      const model = modelRegistryService.getModel("gpt-4o");
      expect(model?.provider).toBe("openai");
    });
  });

  describe("clear()", () => {
    it("should remove all models from registry", async () => {
      await modelRegistryService.initialize();
      expect(modelRegistryService.getModels().length).toBeGreaterThan(0);

      modelRegistryService.clear();
      expect(modelRegistryService.getModels().length).toBe(0);
    });
  });
});

// =============================================================================
// CATEGORY FILTERING TESTS (LLM vs Audio separation)
// Tests for the provider separation implemented in providers.ts
// =============================================================================

describe("Category Filtering (LLM vs Audio)", () => {
  beforeEach(() => {
    const testAdapter = new TestModelAdapter();
    setModelRegistryAdapter(testAdapter);
  });

  describe("getLLMModels()", () => {
    it("should return only models with category 'llm'", () => {
      const llmModels = modelRegistryService.getLLMModels();

      // Should have 4 LLM models (gpt-4o, claude-opus, gemini-2.0-flash, llama-3.3-70b)
      expect(llmModels.length).toBe(4);

      // All returned models should have category "llm"
      for (const model of llmModels) {
        expect(model.category).toBe("llm");
      }

      // Should NOT include audio models
      const ids = llmModels.map((m) => m.id);
      expect(ids).not.toContain("eleven_multilingual_v2");
      expect(ids).not.toContain("tts-1");
    });

    it("should include models from all LLM providers", () => {
      const llmModels = modelRegistryService.getLLMModels();
      const providers = new Set(llmModels.map((m) => m.provider));

      expect(providers.has("openai")).toBe(true);
      expect(providers.has("anthropic")).toBe(true);
      expect(providers.has("google-genai")).toBe(true);
      expect(providers.has("groq")).toBe(true);

      // Should NOT have elevenlabs (audio-only provider)
      expect(providers.has("elevenlabs")).toBe(false);
    });
  });

  describe("getAudioModels()", () => {
    it("should return only models with category 'audio'", () => {
      const audioModels = modelRegistryService.getAudioModels();

      // Should have 2 audio models (eleven_multilingual_v2, tts-1)
      expect(audioModels.length).toBe(2);

      // All returned models should have category "audio"
      for (const model of audioModels) {
        expect(model.category).toBe("audio");
      }

      // Should NOT include LLM models
      const ids = audioModels.map((m) => m.id);
      expect(ids).not.toContain("gpt-4o");
      expect(ids).not.toContain("claude-opus");
    });

    it("should include audio models from both OpenAI and ElevenLabs", () => {
      const audioModels = modelRegistryService.getAudioModels();
      const providers = new Set(audioModels.map((m) => m.provider));

      expect(providers.has("openai")).toBe(true); // tts-1
      expect(providers.has("elevenlabs")).toBe(true); // eleven_multilingual_v2
    });
  });

  describe("getLLMModelsByProvider()", () => {
    it("should return LLM models grouped by LLM providers only", () => {
      const grouped = modelRegistryService.getLLMModelsByProvider();

      // Should have all 4 LLM provider keys
      expect(Object.keys(grouped)).toEqual(
        expect.arrayContaining(["openai", "anthropic", "google-genai", "groq"])
      );

      // Should NOT have elevenlabs key (audio-only provider)
      expect(grouped).not.toHaveProperty("elevenlabs");
    });

    it("should exclude audio models from OpenAI group", () => {
      const grouped = modelRegistryService.getLLMModelsByProvider();

      // OpenAI should have gpt-4o but NOT tts-1
      const openaiIds = grouped.openai.map((m) => m.id);
      expect(openaiIds).toContain("gpt-4o");
      expect(openaiIds).not.toContain("tts-1");
    });

    it("should have correct model count per provider", () => {
      const grouped = modelRegistryService.getLLMModelsByProvider();

      // gpt-4o only (tts-1 is audio, excluded)
      expect(grouped.openai.length).toBe(1);
      expect(grouped.anthropic.length).toBe(1); // claude-opus
      expect(grouped["google-genai"].length).toBe(1); // gemini-2.0-flash
      expect(grouped.groq.length).toBe(1); // llama-3.3-70b
    });

    it("should only include models with category 'llm'", () => {
      const grouped = modelRegistryService.getLLMModelsByProvider();

      // Flatten all models and check categories
      const allModels = Object.values(grouped).flat();
      for (const model of allModels) {
        expect(model.category).toBe("llm");
      }
    });
  });

  describe("getModelsByProvider()", () => {
    it("should include ALL providers including audio-only ones", () => {
      const grouped = modelRegistryService.getModelsByProvider();

      // Should have all 5 provider keys (including elevenlabs)
      expect(grouped).toHaveProperty("openai");
      expect(grouped).toHaveProperty("anthropic");
      expect(grouped).toHaveProperty("google-genai");
      expect(grouped).toHaveProperty("groq");
      expect(grouped).toHaveProperty("elevenlabs");
    });

    it("should include both LLM and audio models for OpenAI", () => {
      const grouped = modelRegistryService.getModelsByProvider();

      // OpenAI should have both gpt-4o (LLM) and tts-1 (audio)
      const openaiIds = grouped.openai.map((m) => m.id);
      expect(openaiIds).toContain("gpt-4o");
      expect(openaiIds).toContain("tts-1");
    });

    it("should have elevenlabs models in elevenlabs group", () => {
      const grouped = modelRegistryService.getModelsByProvider();

      expect(grouped.elevenlabs.length).toBe(1);
      expect(grouped.elevenlabs[0].id).toBe("eleven_multilingual_v2");
    });
  });
});
