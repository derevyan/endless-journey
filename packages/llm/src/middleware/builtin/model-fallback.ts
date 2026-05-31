/**
 * Model Fallback Middleware
 *
 * Automatically fallback to alternative models when the primary model fails.
 * Follows LangChain's ModelFallbackMiddleware API.
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#model-fallback
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   model: "gpt-4o",
 *   middleware: [
 *     createModelFallbackMiddleware(
 *       "gpt-4o-mini",           // First fallback
 *       "claude-3-5-sonnet",     // Second fallback
 *     ),
 *   ],
 * });
 * ```
 */

import { createMiddleware } from "../create-middleware";
import { createLogger, serializeError } from "@journey/logger";
import { isRetryableError } from "../../errors";

const log = createLogger("llm:middleware:model-fallback");

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create a Model Fallback middleware
 *
 * Automatically tries alternative models when the primary model fails with
 * retryable errors (rate limits, timeouts, server issues).
 *
 * @param fallbackModels - Models to try in order when primary fails
 *
 * @example Basic usage
 * ```typescript
 * // Try gpt-4o-mini if primary fails
 * createModelFallbackMiddleware("gpt-4o-mini")
 * ```
 *
 * @example Multiple fallbacks
 * ```typescript
 * // Try these models in order
 * createModelFallbackMiddleware(
 *   "gpt-4o-mini",
 *   "claude-3-5-sonnet",
 *   "gemini-1.5-flash"
 * )
 * ```
 */
export function createModelFallbackMiddleware(
  ...fallbackModels: string[]
): ReturnType<typeof createMiddleware> {
  if (fallbackModels.length === 0) {
    throw new Error("ModelFallbackMiddleware requires at least one fallback model");
  }

  return createMiddleware({
    name: "ModelFallbackMiddleware",
    priority: 5, // Run very early (outermost wrapper)

    wrapModelCall: async (request, handler) => {
      // Build list of models to try: primary + fallbacks
      const modelsToTry = [request.model, ...fallbackModels];
      let lastError: Error | undefined;

      for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i];
        const isPrimary = i === 0;
        const isFallback = i > 0;

        try {
          // Update request with current model
          // For fallbacks, provider is auto-detected based on model ID
          // in resolveProvider() when the model is created (no explicit provider here)
          const currentRequest = isPrimary
            ? request
            : request.override({ model });

          if (isFallback) {
            log.info(
              {
                originalModel: request.model,
                fallbackModel: model,
                attempt: i + 1,
                totalModels: modelsToTry.length,
              },
              "middleware:modelFallback:tryingFallback"
            );
          }

          const response = await handler(currentRequest);

          if (isFallback) {
            log.info(
              {
                originalModel: request.model,
                successfulModel: model,
              },
              "middleware:modelFallback:fallbackSucceeded"
            );
          }

          // Set modelUsed to track which model actually handled the request
          // This is CRITICAL for accurate usage tracking and billing
          return { ...response, modelUsed: model };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Check if error is retryable
          if (!isRetryableError(lastError)) {
            log.warn(
              {
                model,
                error: lastError.message,
              },
              "middleware:modelFallback:nonRetryableError"
            );
            throw lastError; // Non-retryable error, don't try fallbacks
          }

          // Log and continue to next model
          log.warn(
            {
              model,
              error: lastError.message,
              hasMoreFallbacks: i < modelsToTry.length - 1,
            },
            "middleware:modelFallback:retryableError"
          );
        }
      }

      // All models failed
      log.error(
        {
          originalModel: request.model,
          fallbackModels,
          err: lastError ? serializeError(lastError) : undefined,
        },
        "middleware:modelFallback:allModelsFailed"
      );

      throw lastError || new Error("All models failed");
    },
  });
}
