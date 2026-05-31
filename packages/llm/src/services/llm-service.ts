/**
 * Unified LLM Service using LangChain's initChatModel
 *
 * Provider should be provided in LLMConfig from model configuration.
 * Falls back to model registry lookup, then prefix detection.
 *
 * Features:
 * - Provider from config (preferred) or auto-detection (fallback)
 * - Structured output with Zod validation
 * - Streaming support (callbacks and async iterator)
 * - Model fallback on errors
 * - Model instance caching
 * - Proper error wrapping
 */

import { createCircuitBreaker, CircuitOpenError } from "@journey/infra";
import { createLogger } from "@journey/logger";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { initChatModel } from "langchain";
import { z } from "zod";
import { LLM_SERVICE_NAMES } from "@journey/schemas";
import { getModelRegistryAdapter } from "../adapters/model-registry-context";
import { getUsageTrackingAdapter } from "../adapters/usage-tracking-context";
import { sanitizeSchemaForGoogleGenAI, buildModelSamplingConfig } from "../utils";
import { extractTokenUsage, resolveProvider, getModelCacheKey, isMockModel } from "../runtime/model-runtime";
import { LLMAuthError, LLMError, LLMRateLimitError, LLMTimeoutError } from "../types";
import { classifyError } from "../errors";

const log = createLogger("llm:service");

// ============================================================================
// Circuit Breaker Setup
// ============================================================================

/**
 * Circuit breaker for LLM provider calls.
 * Protects against cascading failures when LLM providers are down.
 *
 * The circuit breaker wraps a generic async function and will:
 * - Open after 50% of requests fail (within 10 requests)
 * - Stay open for 60 seconds before trying again
 * - Throw CircuitOpenError when open (converted to LLMError in handlers)
 */
const llmInvoke = createCircuitBreaker(
  async <T>(fn: () => Promise<T>): Promise<T> => fn(),
  {
    name: "llm-service",
    serviceType: "llm",
  }
);

// ============================================================================
// Types - Import from centralized location
// ============================================================================

import type {
  LLMConfig,
  LLMResponse,
  ChatMessage,
  StreamCallbacks,
  TokenUsage,
} from "../types";

// Re-export for convenience
export type {
  LLMConfig,
  LLMResponse,
  ChatMessage,
  StreamCallbacks,
  TokenUsage,
} from "../types";

// Token extraction moved to model-runtime-utils.ts for code reuse

// Provider resolution and mock detection moved to model-runtime-utils.ts for code reuse

// ============================================================================
// Error Wrapping
// ============================================================================

/**
 * Wrap LangChain/provider errors into typed LLM errors
 *
 * Uses the centralized error classifier for provider-aware detection.
 * Converts classified errors into the appropriate LLMError subclass.
 */
function wrapLLMError(error: unknown, model: string): never {
  const classification = classifyError(error);

  log.debug(
    {
      model,
      errorType: classification.type,
      retryable: classification.retryable,
      provider: classification.provider,
    },
    "llm:errorClassified"
  );

  switch (classification.type) {
    case "circuit_open":
      throw new LLMError(classification.message, model, "CIRCUIT_OPEN", error);

    case "rate_limit":
      throw new LLMRateLimitError(model, classification.retryAfterMs, error);

    case "auth":
      throw new LLMAuthError(model, error);

    case "timeout":
      throw new LLMTimeoutError(model, classification.retryAfterMs, error);

    case "server":
    case "connection":
      // Server and connection errors use generic LLMError with specific code
      throw new LLMError(classification.message, model, classification.type.toUpperCase(), error);

    default:
      // Unknown errors
      throw new LLMError(classification.message, model, "UNKNOWN", error);
  }
}

// ============================================================================
// Model Caching
// ============================================================================

/** Cache for initialized model instances */
const modelCache = new Map<string, BaseChatModel>();

/**
 * Get or create a model instance (with caching)
 */
async function getOrCreateModel(config: LLMConfig): Promise<BaseChatModel> {
  const cacheKey = getModelCacheKey(config);

  const cached = modelCache.get(cacheKey);
  if (cached) {
    log.debug({ model: config.model, cached: true }, "llm:modelFromCache");
    return cached;
  }

  const modelProvider = resolveProvider(config.model, config.provider);
  log.debug({ model: config.model, provider: modelProvider, fromConfig: !!config.provider }, "llm:initModel");

  const modelOptions: Record<string, unknown> = {
    modelProvider,
    maxRetries: config.maxRetries ?? 2,
    // Convert timeout from seconds (schema definition) to milliseconds (LangChain expectation)
    timeout: config.timeout ? config.timeout * 1000 : undefined,
    maxTokens: config.maxTokens,
    // Support GEMINI_API_KEY as alternative to GOOGLE_API_KEY
    ...(modelProvider === "google-genai" && process.env.GEMINI_API_KEY && { apiKey: process.env.GEMINI_API_KEY }),
  };

  // Wire schema fields into model creation (NEW in Phase 2)
  // These fields control various aspects of model behavior across providers
  if (config.topP !== undefined) {
    modelOptions.topP = config.topP;
  }
  if (config.frequencyPenalty !== undefined) {
    modelOptions.frequencyPenalty = config.frequencyPenalty;
  }
  if (config.presencePenalty !== undefined) {
    modelOptions.presencePenalty = config.presencePenalty;
  }

  // Use centralized sampling config helper to determine temperature vs reasoning
  const samplingConfig = buildModelSamplingConfig({
    model: config.model,
    temperature: config.temperature,
    reasoningEffort: config.reasoningEffort,
  });

  // Apply the appropriate sampling mode (either temperature OR reasoningEffort)
  Object.assign(modelOptions, samplingConfig);

  const llm = await initChatModel(config.model, modelOptions);

  modelCache.set(cacheKey, llm as BaseChatModel);
  return llm as BaseChatModel;
}

/**
 * Clear the model cache (useful for testing or when API keys change)
 */
export function clearModelCache(): void {
  modelCache.clear();
  log.debug("llm:modelCacheCleared");
}

// ============================================================================
// Model Fallback
// ============================================================================

/**
 * Execute with fallback models on error
 */
async function executeWithFallback<T>(
  config: LLMConfig,
  executor: (model: string, config: LLMConfig) => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  const models = [config.model, ...(config.fallbackModels ?? [])];
  let lastError: Error | undefined;
  let lastModelAttempted = config.model;

  for (const model of models) {
    lastModelAttempted = model;
    try {
      // FIX (Phase 3): Clear provider to allow auto-detection for fallback models
      // This enables cross-provider fallback (e.g., gpt-4o → claude-sonnet)
      const fallbackConfig = {
        ...config,
        model,
        provider: undefined, // Let resolveProvider detect from model name or registry
      };
      const result = await executor(model, fallbackConfig);
      return { result, modelUsed: model };
    } catch (error) {
      lastError = error as Error;
      log.warn({ model, err: error, remainingFallbacks: models.length - models.indexOf(model) - 1 }, "llm:fallbackTriggered");

      // Don't fallback for auth errors - they'll fail on all models
      if (error instanceof LLMAuthError) {
        throw error;
      }
    }
  }

  // All models failed - attach the actual failing model to the error for proper attribution
  const errorWithModel = lastError ?? new Error("All fallback models failed");
  (errorWithModel as Error & { failingModel?: string }).failingModel = lastModelAttempted;
  throw errorWithModel;
}

// ============================================================================
// Structured Output
// ============================================================================

function resolveStructuredOutputMethod(
  config: LLMConfig,
  provider: string | undefined
): "jsonSchema" | "functionCalling" {
  if (config.structuredOutputMethod) {
    return config.structuredOutputMethod;
  }

  if (provider === "openai") {
    return "jsonSchema";
  }

  return "functionCalling";
}

function sanitizeStructuredSchema<T>(
  schema: z.ZodType<T>,
  provider: string | undefined
): z.ZodType<T> {
  if (provider !== "google-genai") {
    return schema;
  }

  const result = sanitizeSchemaForGoogleGenAI(schema);
  if (!result.schema) {
    log.warn(
      { reason: result.reason, typeName: result.typeName },
      "llm:structuredSchemaUnsupported"
    );
    throw new Error("Structured output schema is not supported for google-genai");
  }

  if (result.changed) {
    log.debug(
      { typeName: result.typeName },
      "llm:structuredSchemaSanitized"
    );
  }

  return result.schema as z.ZodType<T>;
}

/**
 * Internal implementation of structured output generation
 */
async function generateStructuredOutputInternal<T>(
  systemPrompt: string,
  userContent: string,
  schema: z.ZodType<T>,
  config: LLMConfig
): Promise<LLMResponse<T>> {
  const startTime = Date.now();

  const provider = resolveProvider(config.model, config.provider);
  const llm = await getOrCreateModel({ ...config, temperature: config.temperature ?? 0.3 });
  const outputMethod = resolveStructuredOutputMethod(config, provider);
  const outputSchema = sanitizeStructuredSchema(schema, provider);

  const structuredLlm = llm.withStructuredOutput(outputSchema, {
    name: "structured_response",
    strict: true,
    method: outputMethod,
    includeRaw: true,
  });

  // Wrap LLM invocation with circuit breaker for resilience
  const response = await llmInvoke(() =>
    structuredLlm.invoke([new SystemMessage(systemPrompt), new HumanMessage(userContent)])
  );

  const tokenUsage = extractTokenUsage(response.raw as AIMessage);

  // Add cost tracking if token usage available
  const tokenUsageWithCost = tokenUsage ? {
    ...tokenUsage,
    costUSD: getModelRegistryAdapter().calculateCost(config.model, tokenUsage.promptTokens, tokenUsage.completionTokens),
  } : undefined;

  log.info(
    {
      model: config.model,
      durationMs: Date.now() - startTime,
      tokens: tokenUsage?.totalTokens,
      costUSD: tokenUsageWithCost?.costUSD,
    },
    "llm:structuredResponse"
  );

  // Track usage for analytics/billing (if organizationId provided)
  if (config.organizationId && tokenUsageWithCost) {
    const adapter = getUsageTrackingAdapter();
    if (adapter.isReady?.()) {
      adapter.recordUsage(tokenUsageWithCost, {
        organizationId: config.organizationId,
        service: LLM_SERVICE_NAMES.LLM_SERVICE,
        module: "structured-output",
        model: config.model,
        provider: provider ?? "unknown",
        durationMs: Date.now() - startTime,
      });
    }
  }

  return {
    result: response.parsed as T,
    tokenUsage: tokenUsageWithCost,
  };
}

/**
 * Generate structured output using LangChain's initChatModel
 * Provider should be provided in config from model configuration
 *
 * Features:
 * - Provider from config or auto-detection
 * - Model caching for performance
 * - Optional fallback models
 * - Proper error wrapping
 */
export async function generateStructuredOutput<T>(systemPrompt: string, userContent: string, schema: z.ZodType<T>, config: LLMConfig): Promise<LLMResponse<T>> {
  // Mock mode for testing
  if (isMockModel(config.model)) {
    log.debug({ model: config.model }, "llm:structuredRequest:mock");
    throw new Error("Use MockProvider for mock mode");
  }

  log.debug({ model: config.model, hasFallbacks: !!config.fallbackModels?.length }, "llm:structuredRequest");

  try {
    // Use fallback logic if fallback models configured
    if (config.fallbackModels?.length) {
      const { result, modelUsed } = await executeWithFallback(config, async (model, cfg) => {
        return generateStructuredOutputInternal(systemPrompt, userContent, schema, cfg);
      });
      return { ...result, modelUsed };
    }

    // Direct execution without fallback
    return await generateStructuredOutputInternal(systemPrompt, userContent, schema, config);
  } catch (error) {
    // Wrap errors into typed LLM errors - use actual failing model if available (from fallback)
    const failingModel = (error as Error & { failingModel?: string }).failingModel ?? config.model;
    wrapLLMError(error, failingModel);
  }
}

// ============================================================================
// Chat Response
// ============================================================================

/**
 * Build LangChain messages from system prompt and chat messages
 *
 * Note: Empty system prompt is skipped to support text classification models
 * that require only a single user message (e.g., llama-prompt-guard).
 */
function buildLangChainMessages(systemPrompt: string, messages: ChatMessage[]) {
  const chatMessages = messages.map((m) =>
    m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
  );

  // Skip system message if empty (required for text classification models)
  if (!systemPrompt) {
    return chatMessages;
  }

  return [new SystemMessage(systemPrompt), ...chatMessages];
}

/**
 * Internal implementation of chat response generation
 */
async function generateChatResponseInternal(systemPrompt: string, messages: ChatMessage[], config: LLMConfig): Promise<LLMResponse<string>> {
  const startTime = Date.now();

  const llm = await getOrCreateModel({ ...config, temperature: config.temperature ?? 0.7 });
  const langchainMessages = buildLangChainMessages(systemPrompt, messages);

  // Wrap LLM invocation with circuit breaker for resilience
  const response = await llmInvoke(() => llm.invoke(langchainMessages));
  const tokenUsage = extractTokenUsage(response);

  // Add cost tracking if token usage available
  const tokenUsageWithCost = tokenUsage ? {
    ...tokenUsage,
    costUSD: getModelRegistryAdapter().calculateCost(config.model, tokenUsage.promptTokens, tokenUsage.completionTokens),
  } : undefined;

  log.info(
    {
      model: config.model,
      durationMs: Date.now() - startTime,
      tokens: tokenUsage?.totalTokens,
      costUSD: tokenUsageWithCost?.costUSD,
    },
    "llm:chatResponse"
  );

  // Extract content first (needed for usage tracking)
  const content = typeof response.content === "string" ? response.content : String(response.content);

  // Track usage for analytics/billing (if organizationId provided)
  if (config.organizationId && tokenUsageWithCost) {
    const adapter = getUsageTrackingAdapter();
    if (adapter.isReady?.()) {
      adapter.recordUsage(tokenUsageWithCost, {
        organizationId: config.organizationId,
        service: LLM_SERVICE_NAMES.LLM_SERVICE,
        module: "chat-response",
        model: config.model,
        provider: config.provider ?? "unknown",
        durationMs: Date.now() - startTime,
        // I/O Content for debugging (matching middleware pattern)
        systemPrompt,
        inputMessages: messages.map((msg) => ({
          role: msg.role as "user" | "assistant" | "system" | "tool",
          content: msg.content,
        })),
        outputContent: content,
        finishReason: "stop",
      });
    }
  }

  return {
    result: content,
    tokenUsage: tokenUsageWithCost,
  };
}

/**
 * Generate chat response using LangChain's initChatModel
 * Provider should be provided in config from model configuration
 *
 * Features:
 * - Provider from config or auto-detection
 * - Model caching for performance
 * - Optional fallback models
 * - Proper error wrapping
 */
export async function generateChatResponse(systemPrompt: string, messages: ChatMessage[], config: LLMConfig): Promise<LLMResponse<string>> {
  // Mock mode for testing
  if (isMockModel(config.model)) {
    log.debug({ model: config.model }, "llm:chatRequest:mock");
    throw new Error("Use MockProvider for mock mode");
  }

  // Validate messages array is not empty - LLM APIs require at least one user/assistant message
  if (!messages || messages.length === 0) {
    throw new Error(
      "generateChatResponse requires at least one message. " +
        "LLM APIs require a user or assistant message, not just a system prompt."
    );
  }

  log.debug({ model: config.model, messageCount: messages.length, hasFallbacks: !!config.fallbackModels?.length }, "llm:chatRequest");

  try {
    // Use fallback logic if fallback models configured
    if (config.fallbackModels?.length) {
      const { result, modelUsed } = await executeWithFallback(config, async (model, cfg) => {
        return generateChatResponseInternal(systemPrompt, messages, cfg);
      });
      return { ...result, modelUsed };
    }

    // Direct execution without fallback
    return await generateChatResponseInternal(systemPrompt, messages, config);
  } catch (error) {
    // Wrap errors into typed LLM errors - use actual failing model if available (from fallback)
    const failingModel = (error as Error & { failingModel?: string }).failingModel ?? config.model;
    wrapLLMError(error, failingModel);
  }
}

// ============================================================================
// Streaming Chat Response
// ============================================================================

/**
 * Generate chat response with streaming using callbacks
 * Provides real-time token-by-token updates
 *
 * @example
 * await generateChatResponseStream(systemPrompt, messages, config, {
 *   onToken: (token) => process.stdout.write(token),
 *   onComplete: (response) => console.log('\nDone:', response),
 *   onError: (error) => console.error('Error:', error),
 * });
 */
export async function generateChatResponseStream(systemPrompt: string, messages: ChatMessage[], config: LLMConfig, callbacks: StreamCallbacks): Promise<void> {
  // Mock mode for testing
  if (isMockModel(config.model)) {
    log.debug({ model: config.model }, "llm:streamRequest:mock");
    throw new Error("Use MockProvider for mock mode");
  }

  const startTime = Date.now();
  log.debug({ model: config.model, messageCount: messages.length }, "llm:streamRequest");

  try {
    const llm = await getOrCreateModel({ ...config, temperature: config.temperature ?? 0.7 });
    const langchainMessages = buildLangChainMessages(systemPrompt, messages);

    let fullResponse = "";

    // Wrap stream creation with circuit breaker for resilience
    // Note: Circuit breaker protects the initial connection, not individual chunks
    const stream = await llmInvoke(() => llm.stream(langchainMessages));

    for await (const chunk of stream) {
      const content = typeof chunk.content === "string" ? chunk.content : String(chunk.content);
      fullResponse += content;
      callbacks.onToken?.(content);
    }

    log.info(
      {
        model: config.model,
        durationMs: Date.now() - startTime,
        responseLength: fullResponse.length,
      },
      "llm:streamComplete"
    );

    callbacks.onComplete?.(fullResponse, undefined);
  } catch (error) {
    const wrappedError = (() => {
      try {
        wrapLLMError(error, config.model);
      } catch (e) {
        return e as LLMError;
      }
    })();

    callbacks.onError?.(wrappedError);

    // Re-throw if no error handler
    if (!callbacks.onError) {
      throw wrappedError;
    }
  }
}

/**
 * Generate chat response with streaming using async iterator
 * Allows processing tokens with for-await-of
 *
 * @example
 * const iterator = generateChatResponseIterator(systemPrompt, messages, config);
 * for await (const token of iterator) {
 *   process.stdout.write(token);
 * }
 */
export async function* generateChatResponseIterator(
  systemPrompt: string,
  messages: ChatMessage[],
  config: LLMConfig
): AsyncGenerator<string, LLMResponse<string>, unknown> {
  // Mock mode for testing
  if (isMockModel(config.model)) {
    log.debug({ model: config.model }, "llm:iteratorRequest:mock");
    throw new Error("Use MockProvider for mock mode");
  }

  const startTime = Date.now();
  log.debug({ model: config.model, messageCount: messages.length }, "llm:iteratorRequest");

  try {
    const llm = await getOrCreateModel({ ...config, temperature: config.temperature ?? 0.7 });
    const langchainMessages = buildLangChainMessages(systemPrompt, messages);

    let fullResponse = "";

    // Wrap stream creation with circuit breaker for resilience
    const stream = await llmInvoke(() => llm.stream(langchainMessages));

    for await (const chunk of stream) {
      const content = typeof chunk.content === "string" ? chunk.content : String(chunk.content);
      fullResponse += content;
      yield content;
    }

    log.info(
      {
        model: config.model,
        durationMs: Date.now() - startTime,
        responseLength: fullResponse.length,
      },
      "llm:iteratorComplete"
    );

    return {
      result: fullResponse,
      tokenUsage: undefined, // Token usage not available in streaming mode for most providers
    };
  } catch (error) {
    wrapLLMError(error, config.model);
  }
}
