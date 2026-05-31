import type { ModelMetadata } from "@journey/schemas";

// Re-export for convenience (adapters are the primary users)
export type { ModelMetadata };

/**
 * Model registry adapter interface
 * Abstracts model metadata lookup from storage mechanism.
 * Enables core services to query models without Node.js dependencies.
 */
export interface ModelRegistryAdapter {
  /**
   * Get single model by ID (fuzzy matching)
   * @param modelId - Model ID (e.g., "gpt-4o", "claude-sonnet-4-5-20250929")
   * @returns Model metadata or undefined if not found
   */
  getModel(modelId: string): ModelMetadata | undefined;

  /**
   * Get all available models
   * @returns Array of all model metadata entries
   */
  getModels(): ModelMetadata[];

  /**
   * Calculate cost for token usage
   * @param modelId - Model ID
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @returns Cost in USD
   */
  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number;

  /**
   * Initialize the adapter (optional, for async loading)
   */
  initialize?(): Promise<void>;

  /**
   * Check if adapter is ready
   */
  isReady?(): boolean;
}

/**
 * No-op adapter (fallback when registry unavailable)
 * Used in edge/browser environments or when adapter not initialized
 */
export class NoopModelAdapter implements ModelRegistryAdapter {
  getModel(modelId: string): undefined {
    return undefined;
  }

  getModels(): ModelMetadata[] {
    return [];
  }

  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    return 0; // No pricing data available
  }

  isReady(): boolean {
    return true;
  }
}
