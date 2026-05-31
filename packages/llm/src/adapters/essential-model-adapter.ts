import { createLogger } from "@journey/logger";
import { ESSENTIAL_MODELS } from "@journey/schemas";
import type { ModelRegistryAdapter, ModelMetadata } from "./model-registry-adapter";

const log = createLogger("llm:adapters:essentialModelAdapter");

/**
 * Essential model adapter with bundled essential models
 * For all environments (edge/browser and server).
 * Uses essential-models.ts which includes ~12 commonly used models.
 */
export class EssentialModelAdapter implements ModelRegistryAdapter {
  private registry: Map<string, ModelMetadata>;

  constructor() {
    this.registry = new Map(ESSENTIAL_MODELS.map((m) => [m.id, m]));
    log.info({ modelCount: this.registry.size }, "llm:adapters:static:initialized");
  }

  getModel(modelId: string): ModelMetadata | undefined {
    // Try exact match first
    const exact = this.registry.get(modelId);
    if (exact) return exact;

    // Try normalized fuzzy match
    const normalized = this.normalizeModelId(modelId);
    for (const [id, model] of this.registry) {
      if (this.normalizeModelId(id) === normalized) {
        return model;
      }
    }

    return undefined;
  }

  getModels(): ModelMetadata[] {
    return Array.from(this.registry.values());
  }

  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getModel(modelId);
    if (!model) {
      log.warn({ modelId }, "llm:adapters:static:modelNotFound");
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * model.pricing.input;
    const outputCost = (outputTokens / 1_000_000) * model.pricing.output;
    return inputCost + outputCost;
  }

  isReady(): boolean {
    return true;
  }

  /**
   * Normalize model ID for fuzzy matching
   * Removes special characters and converts to lowercase
   */
  private normalizeModelId(id: string): string {
    return id.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
}
