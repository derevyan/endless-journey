/**
 * @journey/llm/core
 * Portable LLM runtime with no server dependencies
 * Can be used in Node.js, Edge, and Browser environments
 */

// Core LLM services (portable - no server dependencies)
export {
  generateChatResponse,
  generateStructuredOutput,
  generateChatResponseIterator,
  clearModelCache,
} from "../services/llm-service";

export { generateEmbedding, generateEmbeddings } from "../services/embedding-service";

export { runAgent } from "../agent/agent-engine";

// Adapters (for dependency injection)
export * from "../adapters";

// Types
export type {
  LLMConfig,
  LLMRuntimeConfig,
  AgentEngineConfig,
} from "../types";

// Errors
export * from "../errors";

// Middleware (portable pieces only - no server dependencies)
// Note: Usage tracking middleware is server-only, import from @journey/llm/server instead
export { createMiddleware } from "../middleware/create-middleware";
export { composeMiddlewareHooks } from "../middleware/middleware-pipeline";
export type { AgentMiddleware, AgentMiddlewareHooks } from "../middleware/types";

// Portable middleware factories (no server dependencies)
export {
  createModelCallLimitMiddleware,
  type ModelCallLimitConfig,
  createModelFallbackMiddleware,
  createPIIMiddleware,
  type PIIMiddlewareConfig,
  type PIIStrategy,
  type PIIType,
  createSummarizationMiddleware,
  type SummarizationMiddlewareConfig,
  type SummarizationTrigger,
  type SummarizationKeep,
  createTodoListMiddleware,
  type TodoListMiddlewareConfig,
  createHumanInTheLoopMiddleware,
  type HITLMiddlewareConfig,
  type HITLInterruptConfig,
  type HITLDecision,
  createLLMGuardMiddleware,
  type LLMGuardMiddlewareConfig,
} from "../middleware/builtin";

// Usage tracking context (allows portable code to inject custom usage tracking)
export { setUsageTrackingAdapter, getUsageTrackingAdapter } from "../adapters/usage-tracking-context";
export { NoopUsageAdapter } from "../services/usage-tracking-adapter";

// Tools (portable)
export * from "../tools";

// Mock provider (for testing)
export { MockProvider, createMockWithResponse, createMockWithError, createMockWithHandlers } from "../providers/mock";

// Essential models (browser-safe configuration, from @journey/schemas)
export {
  ESSENTIAL_MODELS,
  getEssentialModelIds,
  type EssentialModelId,
} from "@journey/schemas";

// Note: Workflow is NOT exported from core (it has different ToolCall type)
// For workflow functionality, import from main package: @journey/llm/workflow
