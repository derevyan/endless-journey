/**
 * LLM Package Types
 *
 * Centralized type definitions for the @journey/llm package.
 * This file is the single source of truth for LLM-related types.
 *
 * Types are organized into sections:
 * - Re-exports from @journey/schemas (canonical types)
 * - LLM Service Types (for basic LLM operations)
 * - Agent Types (for agent execution)
 * - Model Request/Response Types (for middleware)
 * - Agent Engine Config/Result Types
 * - Error Types
 *
 * @module types
 */

// =============================================================================
// Re-exports from @journey/schemas
// =============================================================================

import type { LLMRuntimeConfig, ConversationMessage } from "@journey/schemas";

export type {
  AgentTool,
  AgentToolAny,
  TokenUsage,
  ToolRetryConfig,
  ToolCapabilities,
  LLMRuntimeConfig,
  ConversationMessage,
  ToolCall,
} from "@journey/schemas";

// =============================================================================
// Error Types (from @journey/schemas)
// =============================================================================

export {
  LLMError,
  LLMRateLimitError,
  LLMAuthError,
  LLMTimeoutError,
} from "@journey/schemas";

// =============================================================================
// LLM Service Types
// =============================================================================

/**
 * Configuration for LLM operations
 *
 * Extends LLMRuntimeConfig from @journey/schemas with runtime-only fields.
 * This is the canonical config type for all LLM operations.
 *
 * Schema fields (all optional):
 * - model: model identifier (e.g., "gpt-4o", "claude-sonnet-4-5-20250929")
 * - provider: explicit provider override ("openai", "google-genai", "anthropic", "groq")
 * - temperature: sampling temperature (0-2)
 * - maxTokens: maximum tokens to generate
 * - topP: nucleus sampling (0-1)
 * - frequencyPenalty: repetition penalty (-2 to 2)
 * - presencePenalty: topic diversity penalty (-2 to 2)
 * - reasoningEffort: reasoning model depth ("low", "medium", "high")
 * - timeout: request timeout in seconds
 * - maxRetries: maximum retry attempts
 *
 * Runtime-only fields:
 * - fallbackModels: alternative models if primary fails
 * - structuredOutputMethod: method for structured outputs
 * - organizationId: for usage tracking attribution
 */
export interface LLMConfig extends LLMRuntimeConfig {
  /** Fallback models to try if primary fails (runtime-only) */
  fallbackModels?: string[];
  /** Preferred structured output method (runtime-only, provider-aware default if omitted) */
  structuredOutputMethod?: "jsonSchema" | "functionCalling";
  /** Organization ID for usage tracking (runtime-only, optional) */
  organizationId?: string;
}

/**
 * Response from LLM operations
 */
export interface LLMResponse<T> {
  /** The result data */
  result: T;
  /** Token usage statistics */
  tokenUsage?: import("@journey/schemas").TokenUsage;
  /** Which model was actually used (relevant when fallbacks are configured) */
  modelUsed?: string;
}

/**
 * Chat message format for conversations
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Callbacks for streaming LLM responses
 */
export interface StreamCallbacks {
  /** Called for each token/chunk received */
  onToken?: (token: string) => void;
  /** Called when streaming completes with full response */
  onComplete?: (fullResponse: string, tokenUsage?: import("@journey/schemas").TokenUsage) => void;
  /** Called on error */
  onError?: (error: import("@journey/schemas").LLMError) => void;
}

// =============================================================================
// Agent Types
// =============================================================================

/**
 * Response format for structured output
 *
 * Note: "json_object" was removed - only "json_schema" is supported for structured output.
 * json_schema provides strict validation and works across all providers.
 */
export interface ResponseFormat {
  type: "text" | "json_schema";
  name?: string;
  schema?: Record<string, unknown>;
  strict?: boolean;
  method?: "jsonSchema" | "functionCalling";
}

/**
 * Tool call information stored in assistant messages.
 *
 * Note: Identical to ToolCall from @journey/schemas.
 * Kept as a local alias for LLM package internal use.
 */
export interface StoredToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Agent runtime context (for middleware)
 */
export interface AgentRuntime {
  context: Record<string, unknown>;
  store?: unknown;
  nodeId?: string;
  sessionId?: string;
  orgId?: string;
  journeyId?: string; // Indicates real journey session context (vs workflow tests)
  /**
   * Tool timing overrides from UI configuration.
   *
   * When a configurable tool's timing is toggled in the UI,
   * the override is passed here: toolName -> timing.
   * Only respected if the tool's timingConfig.configurable is true.
   */
  toolTimingOverrides?: Record<string, import("@journey/schemas").ToolExecutionTiming>;
}

/**
 * Agent state (for middleware)
 */
export interface AgentState {
  messages: ConversationMessage[];
  systemPrompt: string;
  model: string;
  [key: string]: unknown;
}

// =============================================================================
// Model Request/Response Types (for middleware)
// =============================================================================

/**
 * Model request (for wrapModelCall middleware)
 */
export interface ModelRequest {
  state: AgentState;
  runtime: AgentRuntime;
  model: string;
  tools: import("@journey/schemas").AgentTool[];
  systemPrompt: string;
  messages: ConversationMessage[];
  override(changes: Partial<Omit<ModelRequest, "override">>): ModelRequest;
}

/**
 * Model response (from model invocation)
 */
export interface ModelResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    args: unknown;
  }>;
  usage?: import("@journey/schemas").TokenUsage;
  /** Actual model used (may differ from request if fallback occurred) */
  modelUsed?: string;
}

/**
 * Tool call request (for wrapToolCall middleware)
 */
export interface ToolCallRequest {
  state: AgentState;
  runtime: AgentRuntime;
  toolName: string;
  toolArgs: unknown;
  toolCallId: string;
  tool: import("@journey/schemas").AgentTool;
}

/**
 * Tool call response
 */
export interface ToolCallResponse {
  result: unknown;
  error?: Error;
  skipMessage?: boolean;
}

// =============================================================================
// Middleware Hooks Types
// =============================================================================

/**
 * Return type for middleware hooks
 */
export type HookReturn =
  | {
      messages?: ConversationMessage[];
      jumpTo?: "end" | "tools" | "model";
      [key: string]: unknown;
    }
  | void
  | undefined;

/**
 * Middleware hooks interface
 */
export interface AgentMiddlewareHooks {
  beforeAgent?: (state: AgentState, runtime: AgentRuntime) => Promise<HookReturn> | HookReturn;
  beforeModel?: (state: AgentState, runtime: AgentRuntime) => Promise<HookReturn> | HookReturn;
  wrapModelCall?: (
    request: ModelRequest,
    handler: (req: ModelRequest) => Promise<ModelResponse>
  ) => Promise<ModelResponse>;
  afterModel?: (
    state: AgentState,
    runtime: AgentRuntime,
    response: ModelResponse
  ) => Promise<HookReturn> | HookReturn;
  wrapToolCall?: (
    request: ToolCallRequest,
    handler: (req: ToolCallRequest) => Promise<ToolCallResponse>
  ) => Promise<ToolCallResponse>;
  afterAgent?: (state: AgentState, runtime: AgentRuntime) => Promise<HookReturn> | HookReturn;
}

// =============================================================================
// Deferred Tool Execution
// =============================================================================

/**
 * Deferred tool call for post-message execution.
 *
 * When a tool has timing="deferred", it's not executed during the agent loop.
 * Instead, it's collected and returned to be executed after the message
 * is sent to the user.
 *
 * The execute function is a bound closure that includes the validated args
 * and all context needed for execution.
 *
 * @example
 * // After message is sent, execute deferred tools:
 * for (const deferred of result.deferredToolCalls) {
 *   try {
 *     await deferred.execute();
 *   } catch (error) {
 *     log.error({ toolName: deferred.name, err }, "deferred:failed");
 *   }
 * }
 */
export interface DeferredToolCall {
  /** Tool name (for logging) */
  name: string;
  /** Validated arguments (for logging/debugging) */
  args: unknown;
  /** Tool call ID from LLM (for correlation) */
  toolCallId: string;
  /**
   * Bound execute function with context.
   *
   * Call this after message is sent. The closure contains:
   * - Validated arguments
   * - Tool context (services, session, etc.)
   *
   * Returns the tool result (for logging), but typically ignored
   * since deferred tools are fire-and-forget.
   */
  execute: () => Promise<unknown>;
}

// =============================================================================
// Agent Engine Config/Result
// =============================================================================

/**
 * Agent middleware definition
 *
 * Full middleware type with stateSchema and hooks.
 * See middleware/types.ts for the complete interface.
 */
export interface AgentMiddleware {
  /** Unique name for debugging and logging */
  name: string;
  /** Custom state schema (optional) */
  stateSchema?: import("zod").ZodObject<import("zod").ZodRawShape>;
  /** Middleware hooks implementation */
  hooks: AgentMiddlewareHooks;
  /** Priority for execution order (lower = runs first) */
  priority?: number;
}

/**
 * Configuration for agent execution
 */
/**
 * Base agent engine configuration (portable - no server dependencies)
 *
 * Contains only fields used by the agent engine for execution.
 * Does NOT include runtime/server-only fields like fallbackModels or organizationId.
 *
 * Use this type when building agents in edge/portable environments.
 * Use AgentServiceConfig in backend services for access to fallback/tracking features.
 */
export interface AgentEngineConfig extends LLMRuntimeConfig {
  /** Tools available to the agent */
  tools: import("@journey/schemas").AgentTool[];
  /** Maximum agent loop iterations */
  maxIterations?: number;
  /** Response format for structured output */
  responseFormat?: ResponseFormat;
  /**
   * Middleware array or pre-composed hooks.
   * If an array is provided, it will be composed internally using composeMiddlewareHooks().
   * This is the preferred way to use middleware - just pass the array directly.
   */
  middleware?: AgentMiddleware[] | AgentMiddlewareHooks;
  /** Runtime context for middleware */
  runtime?: Partial<AgentRuntime>;
  /** Execute tools in parallel (default: true) */
  parallelToolExecution?: boolean;
}

/**
 * Extended agent service configuration (server-only)
 *
 * Extends AgentEngineConfig with runtime/server features:
 * - fallbackModels: Alternative models if primary fails
 * - structuredOutputMethod: Method for structured outputs
 * - organizationId: For usage tracking attribution
 *
 * Use this type only in backend services (@journey/llm/server).
 */
export interface AgentServiceConfig extends AgentEngineConfig {
  /** Fallback models to try if primary fails (server runtime feature) */
  fallbackModels?: string[];
  /** Preferred structured output method (provider-aware default if omitted) */
  structuredOutputMethod?: "jsonSchema" | "functionCalling";
  /** Organization ID for usage tracking */
  organizationId?: string;
}

/**
 * Result from agent execution
 */
export interface AgentEngineResult {
  /** Final response content */
  content: string;
  /** Parsed structured response (when responseFormat is json_schema) */
  structuredResponse?: Record<string, unknown>;
  /** All tool calls made during execution */
  toolCalls?: Array<{
    name: string;
    args: unknown;
    result?: unknown;
    id: string;
  }>;
  /** Number of model invocations (iterations) */
  iterations: number;
  /** Token usage and cost */
  usage: import("@journey/schemas").TokenUsage;
  /** Which model was actually used (may differ if fallback occurred) */
  modelUsed: string;
  /** Final state (when middleware is used) */
  finalState?: AgentState;
  /**
   * Deferred tool calls for post-message execution.
   *
   * These tools have timing="deferred" and should be executed
   * AFTER the message is sent to the user (fire-and-forget).
   */
  deferredToolCalls?: DeferredToolCall[];
  /**
   * Explicit exit signal from agent.
   * Set when exit_to_next_node tool is called.
   * Used for reliable exit detection in handler.
   */
  exitRequested?: boolean;
}
