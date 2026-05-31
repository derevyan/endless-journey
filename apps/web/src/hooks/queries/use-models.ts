/**
 * LLM Models Query Hooks
 *
 * TanStack Query hooks for fetching available LLM models from the backend.
 * Models include dynamic pricing from models.dev and manual capability metadata.
 *
 * @module hooks/queries/use-models
 */

import { useQuery } from "@tanstack/react-query";
import type { ModelMetadata } from "@journey/schemas";
import { appConfig } from "@/shared/lib/app-config";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Extended model metadata for frontend use
 * Extends canonical ModelMetadata with frontend-specific fields
 */
export interface ModelRegistryEntry extends ModelMetadata {
  description?: string;
  temperatureRange?: { min: number; max: number };
  releaseDate?: string;
  knowledge?: string;
}

// =============================================================================
// MODELS
// =============================================================================

/**
 * Response structure for /api/llm/models endpoint
 */
interface ModelsResponse {
  models: ModelRegistryEntry[];
  metadata: {
    count: number;
    lastFetch: string | null;
  };
}

/**
 * Response structure for /api/llm/models/grouped endpoint
 */
interface ModelsGroupedResponse {
  modelsByProvider: Record<string, ModelRegistryEntry[]>;
}

/**
 * Fetch all available LLM models
 *
 * Returns all models with pricing, capabilities, and temperature support info.
 * Data is cached for 1 hour to reduce API calls.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useModels();
 * if (data) {
 *   console.log(`${data.metadata.count} models available`);
 *   data.models.forEach(model => console.log(model.displayName));
 * }
 * ```
 */
export function useModels() {
  return useQuery({
    queryKey: ["llm", "models"],
    queryFn: async (): Promise<ModelsResponse> => {
      const response = await fetch("/api/llm/models");

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour (models don't change often)
    retry: 2,
  });
}

/**
 * Fetch models grouped by provider
 *
 * Returns models organized by provider (openai, anthropic, google-genai).
 * Useful for displaying provider-specific model groups in dropdowns.
 *
 * @example
 * ```tsx
 * const { data } = useModelsByProvider();
 * if (data) {
 *   Object.entries(data.modelsByProvider).forEach(([provider, models]) => {
 *     console.log(`${provider}: ${models.length} models`);
 *   });
 * }
 * ```
 */
export function useModelsByProvider() {
  return useQuery({
    queryKey: ["llm", "models", "grouped"],
    queryFn: async (): Promise<ModelsGroupedResponse> => {
      const response = await fetch("/api/llm/models/grouped");

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      return response.json();
    },
    select: (data) => {
      const whitelist = appConfig.models.allowedModelIds;

      // No whitelist = return all models
      if (whitelist.length === 0) return data;

      // Filter each provider's models by whitelist
      const filtered: Record<string, ModelRegistryEntry[]> = {};
      Object.entries(data.modelsByProvider).forEach(([provider, models]) => {
        const allowedModels = models.filter((m) => whitelist.includes(m.id));
        if (allowedModels.length > 0) {
          filtered[provider] = allowedModels;
        }
      });

      return { modelsByProvider: filtered };
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
  });
}

/**
 * Fetch single model details
 *
 * @param modelId - Model identifier (e.g., "gpt-4o")
 * @param enabled - Whether to enable the query (default: true)
 *
 * @example
 * ```tsx
 * const { data: model } = useModel("gpt-4o");
 * if (model) {
 *   console.log(`${model.displayName} supports temperature: ${model.supportsTemperature}`);
 * }
 * ```
 */
export function useModel(modelId: string, enabled = true) {
  return useQuery({
    queryKey: ["llm", "models", modelId],
    queryFn: async (): Promise<ModelRegistryEntry> => {
      const response = await fetch(`/api/llm/models/${modelId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Model not found: ${modelId}`);
        }
        throw new Error(`Failed to fetch model: ${response.status}`);
      }

      const data = await response.json();
      return data.model;
    },
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
  });
}
