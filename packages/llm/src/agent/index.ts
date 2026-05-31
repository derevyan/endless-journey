/**
 * Unified Agent Module
 *
 * Single source of truth for LLM agent execution.
 * Consolidates logic from llm-agent-service.ts and execute-with-middleware.ts.
 *
 * @module agent
 */

// Main agent engine
export {
  runAgent,
  // Testing utilities
  getEffectiveTiming,
  DEFERRED_TOOL_RESULT,
  type AgentEngineConfig,
  type AgentEngineResult,
  type AgentMiddlewareHooks,
  type AgentRuntime,
  type AgentState,
  type ConversationMessage,
  type HookReturn,
  type ModelRequest,
  type ModelResponse,
  type ResponseFormat,
  type ToolCallRequest,
  type ToolCallResponse,
} from "./agent-engine";

// Agent service config (server-only with fallback/tracking features)
export type { AgentServiceConfig } from "../types";

// Model runtime utilities
export {
  createModel,
  createModelWithTools,
  createStructuredOutputModel,
  extractTokenUsage,
  invokeModelProtected,
  toLangChainTools,
  buildModelConfig,
  resolveStructuredOutputMethod,
  resolveProvider,
  clearAgentModelCache,
  type ModelConfig,
  type ModelInvocationResult,
} from "../runtime/model-runtime";
