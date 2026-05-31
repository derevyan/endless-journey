/**
 * Model Registry Service
 *
 * Provides model metadata access via adapter delegation.
 *
 * The actual model registry is managed via ModelRegistryAdapter
 * which is initialized in the server startup and injected via context.
 * This separation enables:
 * - Browser/edge compatibility (no node:fs dependency in core)
 * - Flexible storage backends (filesystem, API, in-memory)
 * - Testability (easy to mock adapters)
 */

import type { ModelMetadata } from "@journey/schemas";
import {
  MODEL_PROVIDER_VALUES,
  LLM_PROVIDER_VALUES,
  isValidLLMProvider,
  isValidModelProvider,
} from "@journey/schemas";
import { getModelRegistryAdapter } from "../adapters/model-registry-context";

export type { ModelMetadata };

/**
 * Initialize a provider map from constants (DRY helper)
 *
 * Creates a Record with all provider keys initialized to empty arrays.
 * Uses the canonical provider arrays from @journey/schemas to ensure
 * consistency if providers are added/removed.
 */
function initProviderMap<T extends string>(
  providers: readonly T[]
): Record<T, ModelMetadata[]> {
  return Object.fromEntries(providers.map((p) => [p, []])) as unknown as Record<T, ModelMetadata[]>;
}

/**
 * Model Registry Service
 *
 * Delegates to the adapter context which is set up during server initialization.
 * Use setModelRegistryAdapter() during app startup to configure the registry backend.
 */
export const modelRegistryService = {
  /**
   * Initialize the model registry (no-op - initialization is handled by adapter)
   */
  initialize: async () => {
    // No-op: Adapter is initialized during app startup
  },

  /**
   * Clear the model registry cache by delegating to adapter.
   * Note: This method is optional - only works if adapter implements clear().
   */
  clear: () => {
    const adapter = getModelRegistryAdapter();
    // Check if adapter has clear method without any cast
    if ("clear" in adapter && typeof adapter.clear === "function") {
      adapter.clear();
    }
  },

  getModel: (modelId: string) => getModelRegistryAdapter().getModel(modelId),
  getModels: () => getModelRegistryAdapter().getModels(),
  calculateCost: (modelId: string, inputTokens: number, outputTokens: number) =>
    getModelRegistryAdapter().calculateCost(modelId, inputTokens, outputTokens),

  /**
   * Get the last time the model registry was loaded.
   * Note: This method is optional - only works if adapter implements getLastLoadTime().
   */
  getLastLoadTime: () => {
    const adapter = getModelRegistryAdapter();
    if ("getLastLoadTime" in adapter && typeof adapter.getLastLoadTime === "function") {
      return adapter.getLastLoadTime();
    }
    return null;
  },
  /**
   * Get all models grouped by provider (includes all model types)
   */
  getModelsByProvider: () => {
    const models = getModelRegistryAdapter().getModels();
    const grouped = initProviderMap(MODEL_PROVIDER_VALUES);

    for (const model of models) {
      if (isValidModelProvider(model.provider)) {
        grouped[model.provider].push(model);
      }
    }

    return grouped;
  },

  /**
   * Get only LLM models (category === "llm")
   */
  getLLMModels: () => {
    return getModelRegistryAdapter().getModels().filter((m) => m.category === "llm");
  },

  /**
   * Get only audio models (category === "audio")
   */
  getAudioModels: () => {
    return getModelRegistryAdapter().getModels().filter((m) => m.category === "audio");
  },

  /**
   * Get LLM models grouped by provider (excludes audio-only providers)
   */
  getLLMModelsByProvider: () => {
    const models = getModelRegistryAdapter().getModels().filter((m) => m.category === "llm");
    const grouped = initProviderMap(LLM_PROVIDER_VALUES);

    for (const model of models) {
      // Use type guard instead of unsafe cast
      if (isValidLLMProvider(model.provider)) {
        grouped[model.provider].push(model);
      }
    }

    return grouped;
  },
};
