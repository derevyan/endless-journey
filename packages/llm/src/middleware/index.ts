/**
 * Agent Middleware Module
 *
 * LangChain-inspired middleware system for agent execution pipeline.
 * Provides composable hooks around model calls, tool execution, and agent lifecycle.
 *
 * @example
 * ```typescript
 * import { runAgent } from "@journey/llm/agent";
 * import {
 *   createModelCallLimitMiddleware,
 *   createPIIMiddleware,
 *   createSummarizationMiddleware,
 * } from "@journey/llm/middleware";
 *
 * const result = await runAgent(
 *   "You are a helpful assistant",
 *   messages,
 *   {
 *     model: "gpt-4o",
 *     tools: [...],
 *     // Pass middleware array directly - it's composed internally
 *     middleware: [
 *       createModelCallLimitMiddleware({ runLimit: 10 }),
 *       createPIIMiddleware("email", { strategy: "redact" }),
 *       createSummarizationMiddleware({ model: "gpt-4o-mini", trigger: { messages: 20 } }),
 *     ],
 *   }
 * );
 * ```
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/built-in
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Core types
  AgentMiddleware,
  AgentMiddlewareHooks,
  AgentRuntime,
  AgentState,
  AgentTool,
  ConversationMessage,
  HookReturn,
  ToolRetryConfig,

  // Request/Response types
  ModelRequest,
  ModelResponse,
  ToolCall,
  ToolCallRequest,
  ToolCallResponse,
  TokenUsage,

  // Configuration types
  AgentResult,
  AgentWithMiddlewareConfig,
  MiddlewarePipelineConfig,
} from "./types";

// ============================================================================
// Factory Functions
// ============================================================================

export {
  createMiddleware,
  createModelRequest,
  // Decorator-style helpers
  beforeModel,
  afterModel,
  wrapModelCall,
  wrapToolCall,
} from "./create-middleware";

export type { CreateMiddlewareConfig } from "./create-middleware";

// ============================================================================
// Pipeline
// ============================================================================

export { AgentMiddlewarePipeline, composeMiddlewareHooks } from "./middleware-pipeline";

// ============================================================================
// Utility Functions
// ============================================================================

export {
  getStateNumber,
  getStateString,
  getStateBoolean,
  getStateArray,
} from "./utils";

// ============================================================================
// Built-in Middleware
// ============================================================================

export {
  // Model Call Limit
  createModelCallLimitMiddleware,
  type ModelCallLimitConfig,

  // Model Fallback
  createModelFallbackMiddleware,

  // PII Detection
  createPIIMiddleware,
  type PIIMiddlewareConfig,
  type PIIStrategy,
  type PIIType,

  // Summarization
  createSummarizationMiddleware,
  type SummarizationMiddlewareConfig,
  type SummarizationTrigger,
  type SummarizationKeep,

  // Todo List
  createTodoListMiddleware,
  type TodoListMiddlewareConfig,

  // Human-in-the-Loop
  createHumanInTheLoopMiddleware,
  type HITLMiddlewareConfig,
  type HITLInterruptConfig,
  type HITLDecision,

  // Usage Tracking
  createUsageTrackingMiddleware,
  type UsageTrackingMiddlewareConfig,

  // LLM Guard
  createLLMGuardMiddleware,
  type LLMGuardMiddlewareConfig,
} from "./builtin";
