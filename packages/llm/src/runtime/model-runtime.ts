/**
 * Model Runtime - Unified Core Runtime Module
 *
 * Consolidates all model creation, caching, and resilience patterns.
 * Eliminates duplication between agent/model-runtime.ts and utils/model-runtime-utils.ts
 *
 * Features:
 * - Model creation with provider detection and 3-tier resolution
 * - Model instance caching with complete sampling parameter keys (fixes F2 cache key bug)
 * - Circuit breaker protection for all model invocations
 * - Token usage extraction with cost calculation
 * - Structured output support (jsonSchema and functionCalling methods)
 * - Tool binding and conversion utilities
 * - Mock mode support for testing
 *
 * **Key Bug Fixes:**
 * - F1: Cache key now includes topP, frequencyPenalty, presencePenalty (was missing in utils version)
 * - F2: Token usage extraction now calculates cost using model registry adapter
 *
 * @module runtime/model-runtime
 */

import { createCircuitBreaker } from "@journey/infra";
import { createLogger, serializeError } from "@journey/logger";
import type { TokenUsage, LLMProvider, AgentTool } from "@journey/schemas";
import { buildModelSamplingConfig } from "../utils/sampling-config";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { initChatModel, tool } from "langchain";

import { sanitizeSchemaForGoogleGenAI } from "../utils";
import { getModelRegistryAdapter } from "../adapters/model-registry-context";

const log = createLogger("llm:runtime");

// =============================================================================
// Circuit Breaker
// =============================================================================

/**
 * Circuit breaker for model calls.
 * Protects against cascading failures when LLM providers are down.
 */
const agentModelInvoke = createCircuitBreaker(
  async <T>(fn: () => Promise<T>): Promise<T> => fn(),
  {
    name: "agent-engine",
    serviceType: "llm",
  }
);

// =============================================================================
// Types
// =============================================================================

/**
 * Model configuration for agent execution
 */
export interface ModelConfig {
  /** Model name (e.g., "gpt-4o", "claude-sonnet-4-5-20250929") */
  model: string;
  /** Provider identifier */
  provider?: LLMProvider;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Nucleus sampling (0-1) - controls diversity via cumulative probability */
  topP?: number;
  /** Frequency penalty (-2 to 2) - reduces repetition of tokens */
  frequencyPenalty?: number;
  /** Presence penalty (-2 to 2) - encourages exploring new topics */
  presencePenalty?: number;
  /** Request timeout in seconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Reasoning effort for reasoning models (o1, o3, etc.) */
  reasoningEffort?: "low" | "medium" | "high";
}

/**
 * Result from a model invocation
 */
export interface ModelInvocationResult {
  /** The raw AIMessage from LangChain */
  message: AIMessage;
  /** Extracted token usage */
  usage: TokenUsage;
  /** Actual model used (may differ if fallback occurred) */
  modelUsed: string;
}

/**
 * Result from a structured output invocation
 */
export interface StructuredOutputResult {
  /** The parsed structured response */
  parsed: Record<string, unknown>;
  /** The raw AIMessage from LangChain */
  raw: AIMessage;
  /** Extracted token usage */
  usage: TokenUsage;
  /** Model name used */
  modelUsed: string;
}

// =============================================================================
// Provider Resolution (2-tier strategy - simplified)
// =============================================================================

/**
 * Resolve provider using 2-tier strategy (simplified).
 *
 * Resolution order:
 * 1. Explicit provider parameter (highest priority)
 * 2. Model registry lookup (authoritative for known models)
 *
 * For unknown models, returns undefined and lets LangChain handle it.
 * This eliminates fragile prefix-based detection that caused model name
 * conflicts (e.g., "llama" models on both Groq and Cerebras).
 *
 * @param model Model identifier (e.g., "gpt-4o", "claude-sonnet-4-5-20250929")
 * @param explicitProvider Optional provider override
 * @returns Provider identifier or undefined if no match found
 */
export function resolveProvider(model: string, explicitProvider?: LLMProvider): LLMProvider | undefined {
  // 1. Use explicit provider if provided (highest priority)
  if (explicitProvider) {
    return explicitProvider;
  }

  // 2. Try model registry adapter (authoritative for known models)
  const adapter = getModelRegistryAdapter();
  const modelMetadata = adapter.getModel(model);
  if (modelMetadata?.provider) {
    // Skip audio-only providers - they use different services
    if (modelMetadata.category === "audio") {
      log.debug({ model, provider: modelMetadata.provider }, "runtime:skippingAudioProvider");
      return undefined;
    }
    log.debug({ model, provider: modelMetadata.provider }, "runtime:providerFromRegistry");
    return modelMetadata.provider as LLMProvider;
  }

  // 3. For unknown models, return undefined
  // LangChain's initChatModel() handles provider inference internally
  log.debug({ model }, "runtime:providerNotResolved:deferToLangChain");
  return undefined;
}

/**
 * Check if model is mock mode (for testing)
 */
export function isMockModel(model: string): boolean {
  return model === "mock" || process.env.FORCE_MOCK_LLM === "true";
}

// =============================================================================
// Token Usage Extraction with Cost Calculation
// =============================================================================

/**
 * Extract token usage from AIMessage metadata with cost calculation.
 * Compatible with all major providers (OpenAI, Anthropic, Google).
 *
 * Uses canonical TokenUsage with promptTokens/completionTokens naming.
 * Calculates cost using the model registry adapter if available.
 *
 * **FIX (F2):** Includes cost calculation which was missing in utils version.
 */
export function extractTokenUsage(message: AIMessage, modelId?: string): TokenUsage {
  try {
    let usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    // LangChain standard: usage_metadata (preferred)
    const usageMeta = message.usage_metadata;
    if (usageMeta) {
      usage = {
        promptTokens: usageMeta.input_tokens || 0,
        completionTokens: usageMeta.output_tokens || 0,
        totalTokens:
          usageMeta.total_tokens ||
          (usageMeta.input_tokens || 0) + (usageMeta.output_tokens || 0),
      };
    } else {
      // Fallback: response_metadata (older format / some providers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseMeta = (message as any).response_metadata;
      if (responseMeta?.tokenUsage) {
        const tokenUsage = responseMeta.tokenUsage;
        usage = {
          promptTokens: tokenUsage.promptTokens || 0,
          completionTokens: tokenUsage.completionTokens || 0,
          totalTokens: tokenUsage.totalTokens || 0,
        };
      }
    }

    // Calculate cost if modelId provided
    if (modelId && usage.totalTokens > 0) {
      try {
        const adapter = getModelRegistryAdapter();
        const cost = adapter.calculateCost(
          modelId,
          usage.promptTokens,
          usage.completionTokens
        );

        if (cost > 0) {
          usage.costUSD = cost;
        }
      } catch (error) {
        log.warn(
          { err: serializeError(error), modelId },
          "runtime:costCalculationFailed"
        );
        // Continue without cost - don't fail the operation
      }
    }

    return usage;
  } catch (err) {
    log.warn({ err: serializeError(err) }, "runtime:tokenExtractionFailed");
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
}

// =============================================================================
// Model Configuration Builder
// =============================================================================

/**
 * Build LangChain model configuration from our config interface
 */
export function buildModelConfig(config: ModelConfig): Record<string, unknown> {
  const modelConfig: Record<string, unknown> = {
    modelProvider: config.provider,
    maxTokens: config.maxTokens,
    timeout: config.timeout ? config.timeout * 1000 : undefined,
    maxRetries: config.maxRetries ?? 2,
  };

  // Support GEMINI_API_KEY as alternative for Google
  if (config.provider === "google-genai" && process.env.GEMINI_API_KEY) {
    modelConfig.apiKey = process.env.GEMINI_API_KEY;
  }

  // Support CEREBRAS_API_KEY for Cerebras provider
  if (config.provider === "cerebras" && process.env.CEREBRAS_API_KEY) {
    modelConfig.apiKey = process.env.CEREBRAS_API_KEY;
  }

  // Use centralized sampling config helper to determine temperature vs reasoning
  const samplingConfig = buildModelSamplingConfig({
    model: config.model,
    temperature: config.temperature,
    reasoningEffort: config.reasoningEffort,
    defaultTemperature: 0.7,
    defaultReasoningEffort: "high",
  });

  // Apply the appropriate sampling mode
  if (samplingConfig.reasoningEffort) {
    modelConfig.reasoningEffort = samplingConfig.reasoningEffort;
    log.debug(
      { model: config.model, reasoningEffort: samplingConfig.reasoningEffort },
      "runtime:usingReasoningEffort"
    );
  } else if (samplingConfig.temperature !== undefined) {
    modelConfig.temperature = samplingConfig.temperature;
  }

  // Add optional sampling parameters if provided
  if (config.topP !== undefined) {
    modelConfig.topP = config.topP;
  }

  if (config.frequencyPenalty !== undefined) {
    modelConfig.frequencyPenalty = config.frequencyPenalty;
  }

  if (config.presencePenalty !== undefined) {
    modelConfig.presencePenalty = config.presencePenalty;
  }

  return modelConfig;
}

// =============================================================================
// Model Caching
// =============================================================================

/**
 * Cache for base model instances (NOT tool-bound models).
 * Keyed by model name + behavioral config to enable reuse across agent runs.
 */
const agentModelCache = new Map<string, BaseChatModel>();

/**
 * Generate cache key for a model configuration.
 * Includes all parameters that affect model behavior.
 *
 * **FIX (F1):** Now includes topP, frequencyPenalty, presencePenalty
 * (was missing in utils version, causing cache collisions).
 */
export function getModelCacheKey(config: ModelConfig): string {
  return JSON.stringify({
    model: config.model,
    provider: config.provider,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    topP: config.topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    timeout: config.timeout,
    maxRetries: config.maxRetries,
    reasoningEffort: config.reasoningEffort,
  });
}

/**
 * Clear the model cache (useful for testing)
 */
export function clearAgentModelCache(): void {
  agentModelCache.clear();
  log.debug("runtime:modelCacheCleared");
}

// =============================================================================
// Model Creation
// =============================================================================

/**
 * Create a chat model instance with proper configuration.
 * Uses caching to reuse model instances across agent runs.
 *
 * FIX: Resolves provider before building config to ensure models are routed
 * to the correct SDK (same pattern as llm-service.ts:316).
 */
export async function createModel(config: ModelConfig): Promise<BaseChatModel> {
  // Resolve provider BEFORE building config (fixes routing to wrong SDK)
  const resolvedProvider = resolveProvider(config.model, config.provider);
  const configWithProvider = { ...config, provider: resolvedProvider };

  const cacheKey = getModelCacheKey(configWithProvider);

  // Check cache first
  let model = agentModelCache.get(cacheKey);
  if (model) {
    log.debug({ model: config.model, provider: resolvedProvider }, "runtime:modelCacheHit");
    return model;
  }

  // Create new model and cache it
  const modelConfig = buildModelConfig(configWithProvider);
  model = (await initChatModel(config.model, modelConfig)) as BaseChatModel;
  agentModelCache.set(cacheKey, model);

  log.debug({ model: config.model, provider: resolvedProvider, cacheSize: agentModelCache.size }, "runtime:modelCacheMiss");
  return model;
}

/**
 * Create a model with tools bound
 *
 * Returns the model as BaseChatModel for type compatibility.
 * The actual return type from bindTools is more complex but works as BaseChatModel.
 */
export async function createModelWithTools(
  config: ModelConfig,
  tools: AgentTool[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const model = await createModel(config);

  if (!model.bindTools) {
    throw new Error(
      `Model ${config.model} does not support tool calling. Use a model that supports function calling.`
    );
  }

  // Use centralized provider resolution (includes model registry lookup)
  const resolvedProvider = resolveProvider(config.model, config.provider as LLMProvider);
  const langchainTools = toLangChainTools(tools, resolvedProvider);

  return model.bindTools(langchainTools);
}

// =============================================================================
// Tool Conversion
// =============================================================================

/**
 * Convert AgentTool array to LangChain tool format
 */
export function toLangChainTools(
  tools: AgentTool[],
  provider: string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  return tools.flatMap((toolDef) => {
    let schema = toolDef.schema;

    // Sanitize schema for Google GenAI (has stricter requirements)
    if (provider === "google-genai") {
      const sanitized = sanitizeSchemaForGoogleGenAI(toolDef.schema);

      if (!sanitized.schema) {
        // Don't drop tools with non-Zod schemas (e.g., MCP tools with JSON Schema).
        // Keep the original schema and let the provider handle any compatibility issues.
        // This prevents silent tool dropping which breaks MCP integrations.
        log.warn(
          {
            toolName: toolDef.name,
            reason: sanitized.reason,
            typeName: sanitized.typeName,
          },
          "runtime:toolSchemaNotSanitized:keepingOriginal"
        );
        // schema stays as toolDef.schema (original)
      } else {
        if (sanitized.changed) {
          log.debug(
            { toolName: toolDef.name, typeName: sanitized.typeName },
            "runtime:toolSchemaSanitized"
          );
        }
        schema = sanitized.schema;
      }
    }

    return [
      tool(toolDef.execute, {
        name: toolDef.name,
        description: toolDef.description,
        schema,
      }),
    ];
  });
}

/**
 * Resolve the best structured output method for a provider
 */
export function resolveStructuredOutputMethod(
  provider: string | undefined,
  explicitMethod?: "jsonSchema" | "functionCalling"
): "jsonSchema" | "functionCalling" {
  if (explicitMethod) {
    return explicitMethod;
  }

  // OpenAI supports native JSON schema mode
  if (provider === "openai") {
    return "jsonSchema";
  }

  // Others use function calling approach
  return "functionCalling";
}

/**
 * Create a structured output model (no tools)
 *
 * Returns a model that produces structured output with includeRaw=true.
 * The response will have { parsed, raw } structure.
 */
export async function createStructuredOutputModel(
  config: ModelConfig,
  schema: Record<string, unknown>,
  schemaName: string,
  strict: boolean = true,
  method?: "jsonSchema" | "functionCalling"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const model = await createModel(config);
  // Use centralized provider resolution (includes model registry lookup)
  const resolvedProvider = resolveProvider(config.model, config.provider as LLMProvider);
  const resolvedMethod = resolveStructuredOutputMethod(resolvedProvider, method);

  return model.withStructuredOutput(schema, {
    name: schemaName,
    strict,
    method: resolvedMethod,
    includeRaw: true, // CRITICAL: preserves token tracking
  });
}

// =============================================================================
// Protected Model Invocation
// =============================================================================

/**
 * Invoke a model with circuit breaker protection
 *
 * This wraps the model call in a circuit breaker to prevent cascading failures.
 */
export async function invokeModelProtected(
  model: BaseChatModel,
  messages: BaseMessage[],
  modelName: string
): Promise<ModelInvocationResult> {
  const message = await agentModelInvoke(async () => {
    return (await model.invoke(messages)) as AIMessage;
  });

  // Extract token usage and calculate cost with model name
  const usage = extractTokenUsage(message, modelName);

  return {
    message,
    usage,
    modelUsed: modelName,
  };
}

/**
 * Invoke a structured output model with circuit breaker protection
 *
 * This wraps the structured output call in a circuit breaker to prevent cascading failures.
 * Uses the same protection as invokeModelProtected for consistency.
 */
export async function invokeStructuredOutputProtected(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structuredModel: any,
  messages: BaseMessage[],
  modelName: string
): Promise<StructuredOutputResult> {
  const response = await agentModelInvoke(async () => {
    return await structuredModel.invoke(messages);
  });

  // Structured output with includeRaw=true returns { parsed, raw }
  const parsed = response.parsed as Record<string, unknown>;
  const raw = response.raw as AIMessage;
  // Extract token usage and calculate cost with model name
  const usage = extractTokenUsage(raw, modelName);

  return {
    parsed,
    raw,
    usage,
    modelUsed: modelName,
  };
}

