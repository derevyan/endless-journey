/**
 * Service Interfaces Module
 *
 * Provides unified service interfaces for cross-module communication.
 * All execution contexts (ExecutionContext, WorkflowContext, BuiltinToolContext)
 * access services through the SharedServiceContext interface.
 *
 * ## Service Architecture (12 Services)
 *
 * ### Core Services (Always Available)
 * | Service            | Purpose                          | Used By              |
 * |--------------------|----------------------------------|----------------------|
 * | IVariableService   | Variable read/write (3 scopes)   | Engine, Workflow, AI |
 * | ITemplateService   | {{variable}} resolution          | Engine, Workflow     |
 * | IMessengerService  | Send messages to users           | Engine, AI           |
 *
 * ### Optional Services (Check with `services.has()`)
 * | Service            | Purpose                          | Required Module      |
 * |--------------------|----------------------------------|----------------------|
 * | IMemoryService     | AI long-term memory (vectors)    | AI features          |
 * | ICrmService        | Pipeline/contact management      | CRM module           |
 * | ITagService        | User tag management              | Auth (usually avail) |
 * | IMindstateService  | Psychological state tracking     | Mindstate module     |
 * | IDlqService        | Failed message handling          | Error recovery       |
 * | IExpressionService | Expression evaluation            | Condition nodes      |
 * | IFollowUpService   | Reminder scheduling              | Follow-up nodes      |
 * | ICacheService      | Redis-backed caching             | Performance opt      |
 * | IJourneyService    | Journey routing/transfers        | Multi-journey flows  |
 *
 * ## Usage Example
 * ```typescript
 * // Core services - always available
 * const value = await services.variable.getValue("journey", "key");
 * const resolved = services.template.substitute("Hello {{name}}", { name: "World" });
 * await services.messenger.sendMessage("Hello!");
 *
 * // Optional services - check availability first
 * if (services.has("memory")) {
 *   await services.memory!.save({ key: "pref", content: "..." });
 * }
 * // Or use optional chaining
 * await services.crm?.moveToStage(userId, pipelineId, "qualified");
 * ```
 *
 * @module services
 */

// =============================================================================
// CORE SERVICES (Always Available)
// =============================================================================

/** Variable service - read/write variables in journey, global, and user scopes */
export type { IVariableService } from "./variable-service";
export type {
  IApiVariableService,
  VariableOperationEventContext,
  VariableOperationTrigger,
} from "./api-variable-service";

/** Messenger service - send text, media, and interactive messages to users */
export type {
  IMessengerService,
  SendResult,
  MessageOptions,
  ButtonOptions,
  MediaOptions,
  VoiceConfig,
} from "./messenger-service";

/** Template service - resolve {{variable}} placeholders in strings */
export type {
  ITemplateService,
  TemplateContext,
  TemplateOptions,
} from "./template-service";

// =============================================================================
// OPTIONAL SERVICES (Check availability with services.has())
// =============================================================================

/** Memory service - AI long-term memory with vector search (optional) */
export type {
  IMemoryService,
  MemoryType,
  MemoryMetadata,
  SaveMemoryParams,
  MemorySearchResult,
  MemoryResult,
} from "./memory-service";

/** CRM service - manage pipelines, stages, and contact data (optional) */
export type {
  ICrmService,
  AddToPipelineOptions,
  ContactData,
  NoteMetadata,
  UserPipelinePosition,
} from "./crm-service";

/** API CRM service - organization-scoped CRM operations */
export type {
  IApiCrmService,
  CrmOperationEventContext,
  CrmTimelineOptions,
  SendMessageResult,
} from "./api-crm-service";

/** API channel service - organization and session scoped channel operations */
export type { IApiChannelService } from "./api-channel-service";

/** API journey service - organization-scoped journey operations */
export type { IApiJourneyService } from "./api-journey-service";

/** API user service - organization-scoped user listing and activity */
export type { IApiUserService } from "./api-user-service";

/** API upload service - journey media library operations */
export type {
  IApiUploadService,
  SaveJourneyMediaParams,
  JourneyMediaSummary,
  JourneyMediaRecord,
} from "./api-upload-service";

/** API prompt service - prompt repository management */
export type { IApiPromptService, PromptCompileOptions } from "./api-prompt-service";

/** API mindstate service - definitions, client mindstates, and analysis */
export type {
  IApiMindstateService,
  MindstateAnalysisResult,
  PreviewMindstateAnalysisInput,
  PreviewMindstateAnalysisResult,
  MindstateAnalysisLogEntry,
} from "./api-mindstate-service";

/** API workflow service - workflow CRUD, versions, approvals, and event emitters */
export type {
  IApiWorkflowService,
  WorkflowListParams,
  WorkflowListResult,
  WorkflowSummary,
  ApprovalStatus,
  ApprovalRecord,
  ApprovalResponse,
  ApprovalListParams,
  ApprovalListResult,
  WorkflowEventPayload,
  WorkflowEventEmitterFn,
  WorkflowEmitterContext,
} from "./api-workflow-service";

/** API event service - interactions, CRM, LLM usage, and replay */
export type {
  IApiEventService,
  EventListFilters,
  InteractionEventListItem,
  EventStats,
  CrmEventFilters,
  CrmEventListItem,
  LlmEventFilters,
  LlmMessage,
  LlmToolCall,
  LlmUsageEvent,
  LlmUsageStats,
  ReplayFilters,
  ReplayEventRecord,
} from "./api-event-service";

/** API simulator service - sessions, personas, and timers */
export type {
  IApiSimulatorService,
  SimulatorSessionInfo,
  SimulatorTimerRecord,
  PersonaProfile,
  Persona,
  ResetResult,
  BulkCleanupResult,
} from "./api-simulator-service";

/** Tag service - add/remove user tags for segmentation (optional) */
export type { ITagService, Tag, TagResult } from "./tag-service";

/** API tag service - organization-scoped tag management */
export type {
  IApiTagService,
  ClientTagRecord,
  TagDefinition,
  CreateTagDefinitionParams,
  UpdateTagDefinitionParams,
  TagOperations,
  TagOperationEventContext,
  TagOperationTrigger,
} from "./api-tag-service";

/** Cache service - Redis-backed caching for performance (optional) */
export type {
  ICacheService,
  CacheEntry,
  CacheOptions,
  CacheStats,
  VariableCacheTTL,
} from "./cache-service";
export { DEFAULT_VARIABLE_CACHE_TTL, VARIABLE_CACHE_KEYS } from "./cache-service";

/** Journey service - route users between journeys (optional) */
export type {
  IJourneyService,
  StartJourneyOptions,
  StartJourneyResult,
  UserJourneySession,
  JourneyInfo,
  JourneyListFilters,
  EndSessionOptions,
} from "./journey-service";

// =============================================================================
// SHARED CONTEXT & ADDITIONAL SERVICES
// =============================================================================

/**
 * SharedServiceContext - The unified service access layer.
 * Also exports additional service interfaces defined inline:
 * - IMindstateService: Psychological state tracking
 * - IDlqService: Dead letter queue handling
 * - IExpressionService: Expression evaluation
 * - IFollowUpService: Reminder scheduling
 */
export type {
  SharedServiceContext,
  OptionalServiceName,
  IMindstateService,
  IDlqService,
  IExpressionService,
  IFollowUpService,
} from "./shared-context";

// =============================================================================
// NO-OP FACTORY (Testing & Defaults)
// =============================================================================

/**
 * Factory functions for creating no-op service implementations.
 * Used for testing and as default implementations when services aren't configured.
 */
export {
  createNoOpVariableService,
  createNoOpApiVariableService,
  createNoOpApiTagService,
  createNoOpApiCrmService,
  createNoOpApiChannelService,
  createNoOpApiJourneyService,
  createNoOpApiUserService,
  createNoOpApiUploadService,
  createNoOpApiPromptService,
  createNoOpApiMindstateService,
  createNoOpApiWorkflowService,
  createNoOpApiEventService,
  createNoOpApiSimulatorService,
  createNoOpMessengerService,
  createNoOpTemplateService,
  createNoOpMemoryService,
  createNoOpTagService,
  createNoOpCrmService,
  createNoOpMindstateService,
  createNoOpDlqService,
  createNoOpExpressionService,
  createNoOpFollowUpService,
  createNoOpCacheService,
  createNoOpJourneyService,
  createNoOpServiceContext,
  createMinimalServiceContext,
  createPartialServiceContext,
} from "./noop-factory";
