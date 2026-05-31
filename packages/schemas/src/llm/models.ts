/**
 * Zod Schemas for LLM Model Registry
 *
 * Validates the comprehensive model metadata structure
 * Supports runtime type safety for model metadata from multiple providers
 */

import { z } from "zod";

/**
 * Model schema - represents a single LLM model
 * Model metadata structure used throughout the application
 */
export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string().optional(),
  attachment: z.boolean().optional(),
  reasoning: z.boolean(), // Capability flag for reasoning models
  tool_call: z.boolean(), // Supports tool/function calling
  structured_output: z.boolean().optional(),
  temperature: z.boolean().optional(), // CRITICAL: Whether model supports temperature parameter
  knowledge: z.string().optional(), // Knowledge cutoff date
  release_date: z.string().optional(),
  last_updated: z.string().optional(),
  modalities: z
    .object({
      input: z.array(z.enum(["text", "image", "audio", "video", "pdf"])),
      output: z.array(z.enum(["text", "image", "audio", "video"])),
    })
    .optional(),
  open_weights: z.boolean().optional(),
  cost: z
    .object({
      input: z.number(), // Cost per 1M tokens
      output: z.number(), // Cost per 1M tokens
      cache_read: z.number().optional(),
      cache_write: z.number().optional(),
      reasoning: z.number().optional(), // Special cost for reasoning tokens (o1 models)
    })
    .optional(), // Some models don't have pricing data
  limit: z
    .object({
      context: z.number(), // Context window size
      output: z.number(), // Max output tokens
    })
    .optional(), // Some models don't have limit data
});

export type Model = z.infer<typeof ModelSchema>;

/**
 * Provider schema - represents an LLM provider (e.g., OpenAI, Anthropic, Google)
 */
export const ProviderSchema = z.object({
  id: z.string(),
  env: z.array(z.string()).optional(), // Environment variable names (e.g., ["OPENAI_API_KEY"])
  npm: z.string().optional(), // NPM package name
  api: z.string().optional(), // API endpoint URL
  name: z.string(),
  doc: z.string().optional(), // Documentation URL
  models: z.record(z.string(), ModelSchema), // Map of model ID to Model
});

export type Provider = z.infer<typeof ProviderSchema>;

/**
 * Root schema for model registry validation
 * Map of provider ID to Provider
 */
export const ModelsJsonSchema = z.record(z.string(), ProviderSchema);

export type ModelsJson = z.infer<typeof ModelsJsonSchema>;

/**
 * Helper to validate a single model
 */
export function validateModel(data: unknown): Model {
  return ModelSchema.parse(data);
}

/**
 * Helper to validate a provider
 */
export function validateProvider(data: unknown): Provider {
  return ProviderSchema.parse(data);
}

/**
 * Helper to validate the entire models JSON
 */
export function validateModelsJson(data: unknown): ModelsJson {
  return ModelsJsonSchema.parse(data);
}
