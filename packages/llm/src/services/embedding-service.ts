/**
 * Embedding Service - Text embeddings using OpenAI
 *
 * Generates vector embeddings for semantic search and similarity matching.
 * Uses text-embedding-3-small (1536 dimensions) for cost-effective embeddings.
 *
 * Features:
 * - Single text embedding generation
 * - Batch embedding for multiple texts
 * - Configurable model and dimensions
 * - Proper error handling consistent with LLM service
 */

import { createLogger } from "@journey/logger";
import { EMBEDDING_CONFIG } from "@journey/schemas/config";
import { LLM_SERVICE_NAMES } from "@journey/schemas";
import { LLMError, LLMAuthError } from "../types";
import { classifyError } from "../errors";
import { getOpenAIClient } from "../clients/openai";
import { getModelRegistryAdapter } from "../adapters/model-registry-context";
import { getUsageTrackingAdapter } from "../adapters/usage-tracking-context";

const log = createLogger("llm:embedding");

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingConfig {
  /** Model to use. Default: "text-embedding-3-small" */
  model?: string;
  /** Number of dimensions for the embedding. Default: 1536 */
  dimensions?: number;
  /** Organization ID for usage tracking (optional) */
  organizationId?: string;
}

export interface EmbeddingResult {
  /** The embedding vector */
  embedding: number[];
  /** Token count used */
  tokenCount: number;
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding for a single text
 *
 * @param text - The text to embed
 * @param config - Optional configuration
 * @returns The embedding vector and token count
 */
export async function generateEmbedding(text: string, config?: EmbeddingConfig): Promise<EmbeddingResult> {
  const startTime = Date.now();
  const client = getOpenAIClient();
  const model = config?.model ?? EMBEDDING_CONFIG.model.id;
  const dimensions = config?.dimensions ?? EMBEDDING_CONFIG.model.dimensions;

  try {
    log.debug({ textLength: text.length, model, dimensions }, "embedding:generate:start");

    const response = await client.embeddings.create({
      model,
      input: text,
      dimensions,
    });

    const embedding = response.data[0].embedding;
    const tokenCount = response.usage?.total_tokens ?? 0;

    log.debug({ tokenCount, embeddingDim: embedding.length }, "embedding:generate:complete");

    // Track usage for analytics/billing (if organizationId provided)
    if (config?.organizationId && tokenCount > 0) {
      const costUSD = getModelRegistryAdapter().calculateCost(model, tokenCount, 0);
      const adapter = getUsageTrackingAdapter();
      if (adapter.isReady?.()) {
        adapter.recordUsage(
          {
            promptTokens: tokenCount,
            completionTokens: 0,
            totalTokens: tokenCount,
            costUSD,
          },
          {
            organizationId: config.organizationId,
            service: LLM_SERVICE_NAMES.EMBEDDING_SERVICE,
            model,
            provider: "openai",
            durationMs: Date.now() - startTime,
          }
        );
      }
    }

    return { embedding, tokenCount };
  } catch (err) {
    log.error({ err, model }, "embedding:generate:error");
    wrapEmbeddingError(err, model);
  }
}

/**
 * Generate embeddings for multiple texts in a single API call
 *
 * More efficient than calling generateEmbedding multiple times.
 *
 * @param texts - Array of texts to embed
 * @param config - Optional configuration
 * @returns Array of embedding results (same order as input)
 */
export async function generateEmbeddings(texts: string[], config?: EmbeddingConfig): Promise<EmbeddingResult[]> {
  if (texts.length === 0) {
    return [];
  }

  const startTime = Date.now();
  const client = getOpenAIClient();
  const model = config?.model ?? EMBEDDING_CONFIG.model.id;
  const dimensions = config?.dimensions ?? EMBEDDING_CONFIG.model.dimensions;

  try {
    log.debug({ count: texts.length, model, dimensions }, "embedding:batch:start");

    const response = await client.embeddings.create({
      model,
      input: texts,
      dimensions,
    });

    // OpenAI returns embeddings in the same order as input
    const results = response.data.map((d) => ({
      embedding: d.embedding,
      tokenCount: 0, // Individual token counts not available in batch
    }));

    // Total tokens for the batch
    const totalTokens = response.usage?.total_tokens ?? 0;
    log.debug({ count: texts.length, totalTokens }, "embedding:batch:complete");

    // Track usage for analytics/billing (if organizationId provided)
    if (config?.organizationId && totalTokens > 0) {
      const costUSD = getModelRegistryAdapter().calculateCost(model, totalTokens, 0);
      const adapter = getUsageTrackingAdapter();
      if (adapter.isReady?.()) {
        adapter.recordUsage(
          {
            promptTokens: totalTokens,
            completionTokens: 0,
            totalTokens,
            costUSD,
          },
          {
            organizationId: config.organizationId,
            service: LLM_SERVICE_NAMES.EMBEDDING_SERVICE,
            module: "batch",
            model,
            provider: "openai",
            durationMs: Date.now() - startTime,
            metadata: { batchSize: texts.length },
          }
        );
      }
    }

    return results;
  } catch (err) {
    log.error({ err, model, count: texts.length }, "embedding:batch:error");
    wrapEmbeddingError(err, model);
  }
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Wrap embedding errors into typed LLM errors
 *
 * Uses the centralized error classifier for provider-aware detection.
 */
function wrapEmbeddingError(error: unknown, model: string): never {
  const classification = classifyError(error);

  // Auth errors get specific treatment
  if (classification.type === "auth") {
    throw new LLMAuthError(model, error);
  }

  // All other embedding errors use generic LLM error with EMBEDDING_ERROR code
  throw new LLMError(classification.message, model, "EMBEDDING_ERROR", error);
}
