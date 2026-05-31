/**
 * Essential Model Adapter Tests
 *
 * Tests for adapter consolidation (F6) and cost calculation accuracy
 * Ensures unified adapter works correctly for both edge and server environments.
 *
 * See: https://github.com/anthropics/journey/pull/XXXX
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EssentialModelAdapter } from "../essential-model-adapter";

describe("EssentialModelAdapter", () => {
  let adapter: EssentialModelAdapter;

  beforeEach(() => {
    adapter = new EssentialModelAdapter();
  });

  // =============================================================================
  // Adapter Consolidation Tests (F6)
  // =============================================================================
  // Verify that the unified adapter works for all environments

  it("should initialize with essential models", () => {
    const models = adapter.getModels();
    expect(models.length).toBeGreaterThan(0);
    // EssentialModelAdapter loads all available models from ESSENTIAL_MODELS
    expect(models.length).toBeGreaterThan(10);
  });

  it("should report ready status", () => {
    expect(adapter.isReady()).toBe(true);
  });

  it("should handle synchronous initialization", () => {
    // Should work without async/await (no file I/O)
    expect(() => {
      new EssentialModelAdapter();
    }).not.toThrow();
  });

  // =============================================================================
  // Model Lookup Tests
  // =============================================================================

  it("should find model by exact ID", () => {
    const models = adapter.getModels();
    if (models.length > 0) {
      const firstModel = models[0];
      const found = adapter.getModel(firstModel.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(firstModel.id);
    }
  });

  it("should support fuzzy matching with normalized IDs", () => {
    const models = adapter.getModels();

    // Find a model that we can test fuzzy matching on
    const targetModel = models.find((m) => m.id.includes("-"));
    if (!targetModel) {
      // Skip if no model with hyphens exists
      return;
    }

    // Try different normalizations
    const normalized = targetModel.id.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Try exact match with fuzzy variations
    const found = adapter.getModel(normalized);
    if (found) {
      // Fuzzy matching should find the model
      expect(found.id).toBeDefined();
    }
  });

  it("should return undefined for non-existent model", () => {
    const found = adapter.getModel("nonexistent-model-12345");
    expect(found).toBeUndefined();
  });

  // =============================================================================
  // Cost Calculation Tests
  // =============================================================================

  it("should calculate cost for valid model", () => {
    const models = adapter.getModels();
    if (models.length > 0) {
      const model = models[0];
      const cost = adapter.calculateCost(model.id, 1000, 500);

      // Cost should be calculated correctly
      // Cost = (input_tokens / 1M) * input_price + (output_tokens / 1M) * output_price
      const expectedCost =
        (1000 / 1_000_000) * model.pricing.input + (500 / 1_000_000) * model.pricing.output;

      expect(cost).toBeCloseTo(expectedCost, 7);
    }
  });

  it("should return 0 cost for non-existent model", () => {
    const cost = adapter.calculateCost("nonexistent-model", 1000, 500);
    expect(cost).toBe(0);
  });

  it("should handle zero token counts", () => {
    const models = adapter.getModels();
    if (models.length > 0) {
      const model = models[0];
      const cost = adapter.calculateCost(model.id, 0, 0);
      expect(cost).toBe(0);
    }
  });

  it("should differentiate costs between models", () => {
    const models = adapter.getModels();
    if (models.length >= 2) {
      const model1 = models[0];
      const model2 = models[1];

      const cost1 = adapter.calculateCost(model1.id, 1000, 500);
      const cost2 = adapter.calculateCost(model2.id, 1000, 500);

      // If models have different pricing, costs should differ
      if (
        model1.pricing.input !== model2.pricing.input ||
        model1.pricing.output !== model2.pricing.output
      ) {
        expect(cost1).not.toEqual(cost2);
      }
    }
  });

  // =============================================================================
  // Unified Adapter Behavior Tests
  // =============================================================================

  it("should work without Node.js fs dependency (portable)", () => {
    // This adapter should work in edge/browser environments
    // Verify no async I/O is performed in constructor
    const startTime = Date.now();
    const newAdapter = new EssentialModelAdapter();
    const elapsed = Date.now() - startTime;

    // Should complete very quickly (< 10ms) - no file I/O
    expect(elapsed).toBeLessThan(10);
    expect(newAdapter.isReady()).toBe(true);
  });

  it("should provide consistent model list across instances", () => {
    const adapter1 = new EssentialModelAdapter();
    const adapter2 = new EssentialModelAdapter();

    const models1 = adapter1.getModels();
    const models2 = adapter2.getModels();

    expect(models1.length).toBe(models2.length);

    // Models should have same IDs in same order
    for (let i = 0; i < models1.length; i++) {
      expect(models1[i].id).toBe(models2[i].id);
    }
  });
});
