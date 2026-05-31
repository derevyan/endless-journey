/**
 * Journey Engine Package
 *
 * Core engine for executing user journeys. This package provides:
 *
 * - SessionEngine: Main orchestrator for journey execution
 * - Handlers: Strategy pattern implementations for each node type
 * - Services: Reusable components (timer, webhook, conditions, etc.)
 * - Types: TypeScript interfaces for engine components
 *
 * @example
 * ```ts
 * import { SessionEngine } from "@journey/engine";
 *
 * const engine = new SessionEngine(session, journey, adapter);
 * await engine.start();
 * ```
 */

// Main engine export
export { SessionEngine } from "./session-engine";
export { GraphIndex } from "./graph-index";
export { MigrationRunner, createMigrationRunner } from "./version";
export { NodeLifecycleManager, createLifecycleManager } from "./lifecycle";
export type { ActivationContext, LifecycleHooks, LifecycleResult } from "./lifecycle";

// Type exports
export type {
  AdapterType,
  AgentWorkflowContext,
  AgentWorkflowInput,
  AgentWorkflowRunResult,
  AgentWorkflowService,
  LoadWorkflowOptions,
  ClientData,
  ConditionEvaluatorService,
  CrmService,
  EngineServices,
  EventLogger,
  EventQueueConfig,
  EventQueueFactory,
  ExecutionContext,
  // Follow-up AI service types (for engine-integrations)
  FollowUpAIGenerationConfig,
  FollowUpAIGenerationResult,
  FollowUpAIService,
  HandlerResult,
  HistoryRetentionPolicy,
  HttpRequestConfig,
  HttpResponseData,
  JourneyEvent,
  JourneyMessage,
  MessagingAdapter,
  MessengerService,
  MindstateAnalysisResult,
  MindstateService,
  NodeHandler,
  SendMessageResult,
  SessionEngineConfig,
  TagService,
  TemplateService,
  TimerService,
  VoiceConfig,
  WebhookExecutorService,
  WorkflowEventEmitterFn,
  WorkflowEventPayload,
} from "./types";

// Handler exports (for extensibility and testing)
export {
  HandlerRegistry,
  createHandlerRegistry,
  createHandlerRegistryWithOverrides,
  type HandlerRegistryConfig,
  agentHandler,
  conditionHandler,
  crmHandler,
  endHandler,
  messageHandler,
  questionnaireHandler,
  startHandler,
  teleportHandler,
  waitHandler,
  webhookHandler,
} from "./handlers";

// Service exports (for testing and custom implementations)
export {
  createConditionEvaluator,
  createConversationHistoryService,
  createTemplateService,
  createTimerService,
  createWebhookExecutor,
  EdgeSelector,
  evaluateExpressionSync,
  getPersistenceHealthStatus,
  getAgentConversationMetrics,
  getInteractionMetrics,
  initializePersistenceMonitoring,
  resetMetrics,
  trackAgentConversationPersistenceAttempt,
  trackInteractionPersistenceAttempt,
  assertServiceConfiguration,
  validateServiceConfiguration,
  getServiceRequirements,
  logServiceStatus,
  // AI Context Builder
  createAIContextBuilder,
  buildAIContext,
  buildUserProfileContext,
  buildNodeOutputContext,
  buildSessionContext,
  type AIContextBuilderOptions,
  type ConversationMessage,
  type TableRow,
  type FormatType,
  type SectionConfig,
  // Other types
  type ConditionEvaluatorOptions,
  type ConversationHistoryService,
  type ServiceValidationResult,
  type TimerServiceDeps,
  type WebhookExecutorOptions,
  type EdgeSelectionResult,
  type TwoPhaseEdgeSelectionResult,
} from "./services";

// Middleware exports (for custom middleware and extensibility)
export {
  // Core types
  type Middleware,
  type MiddlewareNext,
  type MiddlewareDefinition,
  // Pipeline
  MiddlewarePipeline,
  type MiddlewarePipelineConfig,
  // Built-in middleware
  createTagMiddleware,
  tagMiddlewareDefinition,
  createVariableMiddleware,
  createVariableMiddlewareDefinition,
  variableMiddlewareDefinition,
  type VariableMiddlewareConfig,
  createCrmMiddleware,
  crmMiddlewareDefinition,
  // Factory
  createMiddlewarePipeline,
} from "./middleware";

// Dead Letter Queue exports (for failed event handling)
export {
  createDlqService,
  type DlqService,
  type DlqServiceConfig,
  type FailedEventRecord,
  type FailedEventContext,
} from "./services/dlq-service";

// Utility exports (for testing and shared logic)
export {
  applyTagOperations,
  applyVariableOperations,
  buildFullContext,
  extractJsonPath,
  getNestedValue,
  setSleepScale,
  toExprEvalContext,
  type ContextOptions,
  type VariableOperation,
} from "./utils";

// Validation exports (for journey builder validation)
export {
  validateJourneyStructure,
  isValidJourney,
  getJourneyErrors,
  formatValidationResult,
  type ValidationSeverity,
  type ValidationErrorCode,
  type JourneyValidationIssue,
  type JourneyValidationResult,
  PathExplorer,
  PathRunner,
  MockMessagingAdapter,
  type PathRunnerResult,
  type PathExplorerOptions,
} from "./validation";

// Plugin system exports
export {
  // Debug state registry (for simulator)
  createPluginDebugStateRegistry,
  PluginDebugStateRegistry,
  // Follow-up plugin handler and provider
  createFollowUpPluginHandler,
  FollowUpPluginHandler,
  followUpDebugStateProvider,
  // Plugin orchestrator
  createPluginOrchestrator,
  PluginOrchestrator,
  // Backend plugin registry
  backendPluginRegistry,
  type BackendPluginDescriptor,
  type BackendPluginRegistry,
  // ID utilities
  generatePluginId,
  parsePluginId,
  // Node plugin types
  type PluginActivationContext,
  type PluginDebugStateProvider,
  type PluginExecuteResult,
  type PluginExecutionContext,
  type PluginFollowUpTimerContext,
  type PluginHandler,
  type PluginOrchestratorDeps,
  type PluginService,
  type PluginTimeoutResult,
  type FollowUpDebugState,
  // Note: Lifecycle plugin types (LifecyclePlugin, LifecycleEvent, etc.) are defined
  // in plugins/types.ts but not exported as they're not yet implemented.
  // If you need them for analytics/observability plugins, import from ./plugins/types directly.
} from "./plugins";

// State management exports
export {
  createSessionStateManager,
  SessionStateManager,
  type PendingTimer,
  type SessionStateManagerConfig,
  type SessionStatus,
  type StateUpdateResult,
} from "./state";

// Testing exports moved to "@journey/engine/testing" subpath
// Import from "@journey/engine/testing" for: VariationTester, testJourney, RaceConditionTester, etc.
