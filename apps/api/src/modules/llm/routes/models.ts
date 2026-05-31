/**
 * LLM Models Routes
 *
 * REST API for retrieving available LLM models with dynamic pricing and capabilities.
 * Data is fetched from models.dev on server startup and merged with manual capability metadata.
 *
 * Endpoints:
 * - GET /api/llm/models - List all available models with pricing and capabilities
 * - GET /api/llm/models/grouped - Get models grouped by provider
 * - GET /api/llm/models/:modelId - Get single model details
 *
 * Auth: Public (no auth required)
 *
 * @module modules/llm/routes/models
 */

import type { Context } from "hono";

import { modelRegistryService } from "@journey/llm/server";
import { createLogger, serializeError } from "@journey/logger";
import { NotFoundError, ServiceUnavailableError } from "@journey/schemas";
import { Hono } from "hono";

const log = createLogger("api:llm:models");

export const models = new Hono();

// =============================================================================
// MODEL REGISTRY ENDPOINTS (public - no auth required)
// =============================================================================

/**
 * GET /api/llm/models - List all available models
 *
 * Returns all LLM models with pricing, capabilities, and temperature support info.
 * Used by frontend to populate model selection dropdowns.
 *
 * Response:
 * {
 *   models: ModelRegistryEntry[],
 *   metadata: {
 *     count: number,
 *     lastFetch: string | null
 *   }
 * }
 */
models.get("/", async (c: Context) => {
  try {
    const allModels = modelRegistryService.getModels();
    const lastLoad = modelRegistryService.getLastLoadTime();

    log.debug({ count: allModels.length }, "models:list");

    return c.json({
      models: allModels,
      metadata: {
        count: allModels.length,
        lastLoad: lastLoad?.toISOString() || null,
      },
    });
  } catch (error) {
    log.error({ err: serializeError(error) }, "models:list:error");
    throw new ServiceUnavailableError("Failed to fetch models", error);
  }
});

/**
 * GET /api/llm/models/grouped - Get models grouped by provider
 *
 * Returns models organized by provider (openai, anthropic, google-genai).
 * Useful for displaying provider-specific model groups in UI.
 *
 * Response:
 * {
 *   modelsByProvider: {
 *     openai: ModelRegistryEntry[],
 *     anthropic: ModelRegistryEntry[],
 *     "google-genai": ModelRegistryEntry[]
 *   }
 * }
 */
models.get("/grouped", async (c: Context) => {
  try {
    const grouped = modelRegistryService.getModelsByProvider();

    log.debug(
      {
        providers: Object.keys(grouped),
        counts: Object.entries(grouped).map(([provider, models]) => ({
          provider,
          count: models.length,
        })),
      },
      "models:grouped"
    );

    return c.json({ modelsByProvider: grouped });
  } catch (error) {
    log.error({ err: serializeError(error) }, "models:grouped:error");
    throw new ServiceUnavailableError("Failed to fetch models", error);
  }
});

/**
 * GET /api/llm/models/:modelId - Get single model details
 *
 * Returns detailed information about a specific model including:
 * - Pricing (input, output, reasoning, cache)
 * - Capabilities (reasoning, vision, toolCalling)
 * - Temperature support and range
 * - Context window size
 *
 * Params:
 * - modelId: Model identifier (e.g., "gpt-4o", "claude-3-5-sonnet-20241022")
 *
 * Response:
 * {
 *   model: ModelRegistryEntry
 * }
 */
models.get("/:modelId", async (c: Context) => {
  const modelId = c.req.param("modelId");

  try {
    const model = modelRegistryService.getModel(modelId);

    if (!model) {
      log.warn({ modelId }, "models:get:notFound");
      throw new NotFoundError("Model", modelId);
    }

    log.debug({ modelId }, "models:get");

    return c.json({ model });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    log.error({ modelId, err: serializeError(error) }, "models:get:error");
    throw new ServiceUnavailableError("Failed to fetch model", error);
  }
});
