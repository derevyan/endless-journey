/**
 * Built-in Middleware
 *
 * Ready-to-use middleware following LangChain patterns.
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/built-in
 *
 * @example
 * ```typescript
 * import {
 *   createModelCallLimitMiddleware,
 *   createModelFallbackMiddleware,
 *   createPIIMiddleware,
 *   createSummarizationMiddleware,
 *   createTodoListMiddleware,
 *   createHumanInTheLoopMiddleware,
 * } from "@journey/llm/middleware";
 *
 * const agent = createAgent({
 *   model: "gpt-4o",
 *   middleware: [
 *     createModelFallbackMiddleware("gpt-4o-mini"),
 *     createModelCallLimitMiddleware({ runLimit: 10 }),
 *     createPIIMiddleware("email", { strategy: "redact" }),
 *     createSummarizationMiddleware({
 *       model: "gpt-4o-mini",
 *       trigger: { messages: 20 },
 *     }),
 *   ],
 * });
 * ```
 */

// ============================================================================
// Model Call Limit
// ============================================================================

export {
  createModelCallLimitMiddleware,
  type ModelCallLimitConfig,
} from "./model-call-limit";

// ============================================================================
// Model Fallback
// ============================================================================

export { createModelFallbackMiddleware } from "./model-fallback";

// ============================================================================
// PII Detection
// ============================================================================

export {
  createPIIMiddleware,
  type PIIMiddlewareConfig,
  type PIIStrategy,
  type PIIType,
} from "./pii-detection";

// ============================================================================
// Summarization
// ============================================================================

export {
  createSummarizationMiddleware,
  type SummarizationMiddlewareConfig,
  type SummarizationTrigger,
  type SummarizationKeep,
} from "./summarization";

// ============================================================================
// Todo List
// ============================================================================

export {
  createTodoListMiddleware,
  type TodoListMiddlewareConfig,
  type TodoItem,
} from "./todo-list";

// ============================================================================
// Human-in-the-Loop
// ============================================================================

export {
  createHumanInTheLoopMiddleware,
  type HITLMiddlewareConfig,
  type HITLInterruptConfig,
  type HITLDecision,
  type HITLRequest,
  type HITLResponse,
  type HITLEvent,
} from "./human-in-the-loop";

// ============================================================================
// Usage Tracking
// ============================================================================

export {
  createUsageTrackingMiddleware,
  type UsageTrackingMiddlewareConfig,
} from "./usage-tracking";

// ============================================================================
// LLM Guard
// ============================================================================

export {
  createLLMGuardMiddleware,
  type LLMGuardMiddlewareConfig,
} from "./llm-guard";
