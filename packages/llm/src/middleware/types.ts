/**
 * Agent Middleware Types
 *
 * LangChain-inspired middleware system for agent execution pipeline.
 * Provides composable hooks around model calls, tool execution, and agent lifecycle.
 *
 * Core types (AgentState, ConversationMessage, etc.) are imported from ../types.
 * This file only contains middleware-specific types.
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/built-in
 */

import type { z } from "zod";
import type { LLMProvider } from "@journey/schemas";

// =============================================================================
// Re-export core types from centralized location
// =============================================================================

export type {
  AgentTool,
  AgentToolAny,
  ToolRetryConfig,
  ToolCapabilities,
  TokenUsage,
  ConversationMessage,
  AgentRuntime,
  AgentState,
  ModelRequest,
  ModelResponse,
  ToolCallRequest,
  ToolCallResponse,
  HookReturn,
  AgentMiddlewareHooks,
} from "../types";

// =============================================================================
// Middleware-Specific Types
// =============================================================================

/**
 * Tool call format (simple version for ModelResponse.toolCalls)
 */
export interface ToolCall {
  /** Unique ID for this tool call */
  id: string;
  /** Name of the tool to call */
  name: string;
  /** Arguments passed to the tool */
  args: unknown;
}

/**
 * Full middleware definition
 *
 * @example
 * ```typescript
 * const loggingMiddleware: AgentMiddleware = {
 *   name: "LoggingMiddleware",
 *   priority: 100,
 *   hooks: {
 *     beforeModel: (state, runtime) => {
 *       console.log(`Model call with ${state.messages.length} messages`);
 *     },
 *   },
 * };
 * ```
 */
export interface AgentMiddleware {
  /** Unique name for debugging and logging */
  name: string;

  /**
   * Custom state schema (optional)
   *
   * Fields defined here are merged into AgentState at top level.
   * Use Zod schemas with defaults for proper initialization.
   */
  stateSchema?: z.ZodObject<z.ZodRawShape>;

  /** Middleware hooks implementation */
  hooks: import("../types").AgentMiddlewareHooks;

  /**
   * Priority for execution order (lower = runs first)
   *
   * Suggested ranges:
   * - 0-10: Critical wrappers (fallback, retry)
   * - 10-20: Input processing (PII, validation)
   * - 20-30: Context management (summarization)
   * - 30-40: Limit checking
   * - 40-50: Tool injection
   * - 50+: Custom middleware
   *
   * @default 100
   */
  priority?: number;
}

/**
 * Configuration for middleware pipeline execution
 */
export interface MiddlewarePipelineConfig {
  /** Middleware instances to use */
  middleware: AgentMiddleware[];

  /** Whether to stop pipeline on middleware error */
  stopOnError?: boolean;

  /** Initial custom state values */
  initialState?: Record<string, unknown>;
}

/**
 * Result from agent execution with middleware
 */
export interface AgentResult {
  /** Final response content */
  content: string;

  /** All tool calls made during execution */
  toolCalls?: Array<{
    name: string;
    args: unknown;
    result?: unknown;
    id: string;
  }>;

  /** Number of model iterations */
  iterations: number;

  /** Token usage and cost */
  usage?: import("@journey/schemas").TokenUsage;

  /** Final state (includes middleware state) */
  finalState?: import("../types").AgentState;
}

/**
 * Configuration for agent execution with middleware
 */
export interface AgentWithMiddlewareConfig {
  /** Model to use */
  model: string;

  /** Model provider - derived from supported providers in config */
  provider?: LLMProvider;

  /** Temperature for generation */
  temperature?: number;

  /** Reasoning effort for reasoning models (o1, o3, etc.) */
  reasoningEffort?: "low" | "medium" | "high";

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Request timeout in seconds */
  timeout?: number;

  /** Maximum retry attempts for model calls */
  maxRetries?: number;

  /** Maximum agent loop iterations */
  maxIterations?: number;

  /** Tools available to the agent */
  tools: import("@journey/schemas").AgentTool[];

  /** Middleware configuration */
  middleware?: MiddlewarePipelineConfig;

  /** Runtime context to pass to middleware */
  runtime?: Partial<import("../types").AgentRuntime>;
}
