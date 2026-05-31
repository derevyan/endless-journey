// ============================================================================
// @journey/llm - LLM Service using LangChain's initChatModel
// ============================================================================
// Provider should be provided in LLMConfig from model configuration.
// Falls back to model registry lookup, then prefix detection.
//
// Features:
// - Provider from config (preferred) or auto-detection (fallback)
// - Structured output with Zod validation
// - Model fallback on errors
// - Model instance caching
// - Proper error wrapping
// ============================================================================

// LLM Service (main API)
export {
  // Core functions
  generateStructuredOutput,
  generateChatResponse,
  // Streaming APIs
  generateChatResponseStream,
  generateChatResponseIterator,
  // Utilities
  clearModelCache,
  // Types
  type LLMConfig,
  type LLMResponse,
  type TokenUsage,
  type ChatMessage,
  type StreamCallbacks,
} from "./services/llm-service";

// Unified Agent Engine (new architecture)
// For full agent engine API, import from "@journey/llm/agent"
export {
  runAgent,
  type AgentEngineConfig,
  type AgentEngineResult,
} from "./agent";

// Mock provider (for testing)
export {
  MockProvider,
  createMockWithResponse,
  createMockWithError,
  createMockWithHandlers,
  type MockProviderConfig,
} from "./providers";

// Error types
export {
  LLMError,
  LLMRateLimitError,
  LLMAuthError,
  LLMTimeoutError,
} from "./types";

// Error Classification (provider-aware error detection)
export {
  classifyError,
  isRetryableError,
  getErrorType,
  getRetryAfterMs,
  type LLMErrorType,
  type ErrorClassification,
} from "./errors";

// Embedding Service (for semantic search)
export {
  generateEmbedding,
  generateEmbeddings,
  type EmbeddingConfig,
  type EmbeddingResult,
} from "./services/embedding-service";

// Built-in Tools (context-aware tools for agent nodes)
export {
  // Tool definition helper
  tool,
  type ToolConfig,
  // Tool name constants (single source of truth)
  SYSTEM_TOOL_NAMES,
  UTILITY_TOOL_NAMES,
  type SystemToolName,
  type UtilityToolName,
  // Types
  type BuiltinToolContext,
  type IVariableService,
  type IMindstateService,
  type IMessengerService,
  type IMemoryService,
  type SharedServiceContext,
  type SessionData,
  type ClientData,
} from "./tools";

// Agent Middleware (LangChain-inspired middleware system)
// For full middleware API, import from "@journey/llm/middleware"
// Note: executeAgentWithMiddleware has been removed. Use runAgent with middleware array instead.
export {
  createMiddleware,
  createModelCallLimitMiddleware,
  createModelFallbackMiddleware,
  createPIIMiddleware,
  createSummarizationMiddleware,
  createTodoListMiddleware,
  createHumanInTheLoopMiddleware,
  createLLMGuardMiddleware,
  type AgentMiddleware,
  type AgentMiddlewareHooks,
  type AgentState,
  type AgentRuntime,
  type HookReturn,
  type MiddlewarePipelineConfig,
  type LLMGuardMiddlewareConfig,
} from "./middleware";

// Question Understanding Service
export {
  executeQuestionUnderstanding,
  type WorkerContext,
  type WorkerOutput,
  type EvaluatorOutput,
} from "./services/question-understanding";

// Configuration (app-level, from @journey/schemas)
// Note: SupportedLLMProvider is now an alias for LLMProvider (canonical provider type)
export { llmConfig, type SupportedLLMProvider } from "./config";

// Sampling Configuration Utilities (reasoning vs temperature model detection)
export {
  buildModelSamplingConfig,
  isReasoningModel,
  type SamplingConfig,
  type SamplingOptions,
} from "./utils";

// Essential models (single source of truth for model whitelist, from @journey/schemas)
export {
  ESSENTIAL_MODELS,
  getEssentialModelIds,
  type EssentialModelId,
} from "@journey/schemas";

// Workflow Engine
export {
  runWorkflow,
  registerBuiltinExecutors,
  registerNodeExecutor,
  getNodeExecutor,
  buildAdjacencyMap,
  findNode,
  evaluateCondition,
  resolveTemplate,
  type WorkflowContext,
  type WorkflowResult,
  type NodeInput,
  type NodeOutput as WorkflowNodeOutput,
  type NodeExecutor,
  type NodeTrace,
} from "./workflow";
