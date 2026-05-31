/**
 * Engine Services
 *
 * Reusable service implementations for the engine.
 * Each service handles a single responsibility.
 */

export { createConditionEvaluator, type ConditionEvaluatorOptions } from "./condition-evaluator";
export { createExpressionService, evaluateExpression, evaluateExpressionSync, expressionEngine, getAvailableFunctions } from "./expression-service";
export { getExpressionFunctionNames, registerExpressionFunctions, type ExpressionRegistryEngine } from "./expression-registry";
export { createTemplateService, type TemplateServiceOptions } from "./template-service";
export { createTimerService, type TimerServiceDeps } from "./timer-service";
export { createWebhookExecutor, type WebhookExecutorOptions } from "./webhook-executor";
export { SSRFBlockedError, validateWebhookUrl } from "./url-validator";
export {
  createVariableService,
  createNoOpVariableService,
  type VariableService,
  type VariableServiceCallbacks,
  type VariableServiceDeps,
} from "./variable-service";
// Re-export callback types from canonical source (types.ts)
export type { VariableOperationCallback, GetVariablesCallback, GetUserVariablesCallback, UserVariableOperationCallback } from "../types";
export { createDlqService, type DlqService, type DlqServiceConfig, type FailedEventRecord, type FailedEventContext } from "./dlq-service";
export { EdgeSelector, type EdgeSelectionResult, type TwoPhaseEdgeSelectionResult } from "./edge-selector";
export { createConversationHistoryService, type ConversationHistoryService } from "./conversation-history-service";
export {
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
} from "./ai-context-builder";
export {
  initializePersistenceMonitoring,
  trackInteractionPersistenceAttempt,
  trackAgentConversationPersistenceAttempt,
  getInteractionMetrics,
  getAgentConversationMetrics,
  getPersistenceHealthStatus,
  resetMetrics,
} from "./persistence-monitoring";
export {
  validateServiceConfiguration,
  assertServiceConfiguration,
  getServiceRequirements,
  logServiceStatus,
  type ServiceValidationResult,
} from "./service-configuration-validator";

// Factory types for service configuration
export type {
  ServiceCallbacks,
  ServiceOptions,
  ExternalServices,
  ServiceFactoryConfig,
  EventCallbacks,
  TagCallbacks,
  VariableCallbacks,
  MessageCallbacks,
} from "./factories";
