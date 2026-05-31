/**
 * Core types for the Journey Engine
 *
 * This module defines the fundamental interfaces for:
 * - Messaging adapters (how the engine communicates with users)
 * - Node handlers (Strategy pattern for different node types)
 * - Services (reusable components for handlers)
 * - Execution context (dependency injection container)
 */

import type { createLogger } from "@journey/logger";
import type {
  ButtonConfig,
  AgentWorkflow,
  ClientMindstate,
  ConditionNodeData,
  ConversationMessage,
  EnhancedUserJourney,
  FollowUpSequence,
  HttpRetryConfig,
  InteractionEvent, // Engine-internal event type (simple)
  InteractionEventType, // Union of interaction event types
  JourneyConfig,
  JourneyEdgeData,
  JourneyMindstateConfig,
  JourneyNodeData,
  MessageOptions,
  NodeType,
  PipelineMetrics,
  SharedServiceContext,
  StateChange,
  StateParameter,
  StateParameterValue,
  ToolExecutionTiming,
  VariableAction,
  VariableScope,
  VoiceConfig,
  VoiceMode,
  WebhookNodeData,
} from "@journey/schemas";
import type { EventQueueConfig, EventQueueFactory } from "./event/event-queue";
import type { ConversationHistoryService } from "./services/conversation-history-service";
import type { ActivationContext } from "./lifecycle/types";
import type { PluginFollowUpTimerContext } from "./plugins/types";

// =============================================================================
// ADAPTER TYPES
// =============================================================================

/** Supported messaging platform types */
export type AdapterType = "simulator" | "telegram" | "whatsapp" | "email" | "mock";

// VoiceConfig is imported from @journey/schemas and re-exported from index.ts

/** Message payload sent to users */
export interface JourneyMessage {
  type: "text" | "buttons" | "media";
  content: string;
  buttons?: Array<{ id: string; label: string }>;
  media?: { type: "image" | "video"; url: string; mediaId?: string };
  /** Voice configuration for TTS output */
  voice?: VoiceConfig;
}

/** Event received from users or system (timeout) */
export interface JourneyEvent {
  type: "message" | "button_click" | "timeout";
  userId: string;
  sessionId: string;
  payload: {
    text?: string;
    buttonId?: string;
    timerId?: string;
    durationMs?: number;
    /** Edge ID for timeout events (from BullMQ job data) - used for routing when timer map is unavailable */
    edgeId?: string;
    /** Input type - how the user sent the message (voice transcribed to text, or direct text) */
    inputType?: "text" | "voice";
    /** Duration of voice message in seconds (for voice input) */
    voiceDuration?: number;
  };
  timestamp: string;
}

/** Result of sending a message via adapter */
export interface SendMessageResult {
  /** Whether the message was successfully sent */
  success: boolean;
  /** Platform-specific message IDs (can be multiple for media+buttons) */
  messageIds: Array<{
    platformMessageId: string;
    messageType: "text" | "photo" | "video" | "buttons";
  }>;
  /** Error message if send failed */
  error?: string;
}

/**
 * Messaging adapter interface
 *
 * Adapters handle communication between the engine and external platforms.
 * Each platform (Telegram, WhatsApp, etc.) implements this interface.
 */
export interface MessagingAdapter {
  readonly adapterType: AdapterType;

  /** Send a message to a user and return platform message IDs */
  sendMessage(userId: string, message: JourneyMessage): Promise<SendMessageResult>;

  /** Register callback for incoming events (messages, button clicks) */
  onMessage(callback: (event: JourneyEvent) => Promise<void>): void;

  /** Unregister callback for incoming events */
  offMessage?(callback: (event: JourneyEvent) => Promise<void>): void;

  /** Cleanup adapter resources when engine is destroyed */
  dispose?(): void | Promise<void>;

  /** Schedule a timer that will fire a timeout event */
  scheduleTimer(sessionId: string, durationMs: number, edgeId: string): Promise<string>;

  /**
   * Cancel a previously scheduled timer
   *
   * @param timerId - The timer ID returned from scheduleTimer
   * @param edgeId - The edge ID for fallback lookup in durableTimers (used when in-memory state is lost)
   * @param sessionId - The session ID for fallback lookup in durableTimers
   * @returns Promise that resolves to true if cancelled, false if not found
   */
  cancelTimer(timerId: string, edgeId: string, sessionId: string): Promise<boolean>;

  /**
   * Start typing indicator (will auto-refresh for long operations).
   * Call stopTypingIndicator() when done or on error.
   * Optional - only implemented by adapters that support typing indicators (e.g., Telegram).
   *
   * @param chatId - The chat/user ID to show typing indicator for
   */
  startTypingIndicator?(chatId: string): Promise<void>;

  /**
   * Stop typing indicator. Safe to call even if not started.
   * Optional - only implemented by adapters that support typing indicators (e.g., Telegram).
   *
   * @param chatId - The chat/user ID to stop typing indicator for
   */
  stopTypingIndicator?(chatId: string): void;
}

// =============================================================================
// HANDLER TYPES (Strategy Pattern)
// =============================================================================

/**
 * Result of executing a node handler
 *
 * Handlers return one of three actions:
 * - `wait`: Stay at current node, waiting for user input
 * - `transition`: Move to another node
 * - `complete`: Journey has ended
 */
export type HandlerResult = { action: "wait" } | { action: "transition"; targetNodeId: string; trigger: string } | { action: "complete" };

/**
 * Result from a handler's event processing (optional handleEvent method)
 *
 * Used by handlers that maintain internal state machines (questionnaire, agent).
 * When EventRouter receives an event, it first checks if the current node's handler
 * implements handleEvent. If so, the handler can consume the event and return
 * instructions for how to proceed.
 */
export interface NodeEventResult {
  /** Whether the event was consumed (true = don't proceed to normal routing) */
  handled: boolean;

  /** What action to take after handling */
  action: "continue" | "transition" | "validation_failed";

  /** If action is "transition", the target node ID */
  targetNodeId?: string;

  /** Trigger name for the transition */
  trigger?: string;

  /** Whether to re-execute the node handler (e.g., after recording user response) */
  reExecute: boolean;

  /** Which timers to cancel: "none" or "all" */
  timerAction: "none" | "all";

  /** Optional validation error message to send to user */
  validationError?: string;
}

/**
 * Execution context passed to node handlers
 *
 * Contains all dependencies needed to execute a node:
 * - Session state
 * - Current node and journey config
 * - Outgoing edges for routing decisions
 * - Services for common operations
 * - Logger for observability
 */
export interface ExecutionContext<TState = unknown> {
  /** Current session state (for reads - prefer stateManager for mutations) */
  session: EnhancedUserJourney;

  /** State manager for centralized session mutations with version tracking */
  stateManager: import("./state/session-state-manager").SessionStateManager;

  /** Current node being executed */
  node: JourneyNodeData;

  /**
   * Full journey configuration.
   * Optional for event handling contexts where the full config isn't needed.
   */
  journey?: JourneyConfig;

  /** Outgoing edges from current node */
  outgoingEdges: JourneyEdgeData[];

  /** Injectable services */
  services: EngineServices;

  /** Logger instance */
  log: ReturnType<typeof createLogger>;

  /** Client data for template bindings */
  clientData?: ClientData;

  /** Organization ID for scoped operations (memory, global variables, etc.) */
  organizationId?: string;

  /**
   * Mindstate configuration for this journey.
   * When present, mindstate values are included in evaluation context as {{mindstate.key.param}}.
   */
  mindstateConfig?: JourneyMindstateConfig;

  /**
   * Cached evaluation context for this node execution.
   * Built lazily on first access via getOrBuildEvaluationContext().
   * Prevents multiple variable fetches within the same node execution.
   * @internal - use getOrBuildEvaluationContext() helper instead
   */
  _cachedEvaluationContext?: Record<string, unknown>;

  // ==========================================================================
  // Handler State Management
  // ==========================================================================

  /**
   * Get handler state for current node.
   * Used by stateful handlers (questionnaire, agent) to persist state across interactions.
   *
   * @example
   * ```ts
   * const state = context.getState<QuestionnaireState>();
   * if (!state) {
   *   // Initialize state
   *   context.setState({ currentIndex: 0, responses: [] });
   * }
   * ```
   */
  getState<T = TState>(): T | undefined;

  /**
   * Set handler state for current node.
   * State is stored in nodeOutputs and persists across interactions.
   *
   * @example
   * ```ts
   * context.setState({ currentIndex: 1, responses: [answer] });
   * ```
   */
  setState<T = TState>(state: T): void;

  /**
   * Check if state exists for current node.
   */
  hasState(): boolean;

  /**
   * Clear state for current node.
   * Should be called when the handler completes and state is no longer needed.
   */
  clearState(): void;
}

/**
 * Node handler interface (Strategy pattern)
 *
 * Each node type (start, message, condition, etc.) has its own handler
 * that implements this interface. Handlers are registered in the registry
 * and looked up by node type during execution.
 */
export interface NodeHandler<TState = unknown> {
  /** The node type this handler processes */
  readonly nodeType: NodeType;

  /**
   * Execute the node and return the result action
   *
   * @param context - Execution context with all dependencies
   * @returns Handler result indicating next action
   */
  execute(context: ExecutionContext<TState>): Promise<HandlerResult>;

  /**
   * Optional: Handle incoming events during node execution
   *
   * Used by nodes that maintain internal state machines (questionnaire, agent).
   * When defined, EventRouter calls this before normal edge-based routing.
   * This allows the handler to consume events (user responses, button clicks)
   * and update internal state before deciding whether to re-execute or transition.
   *
   * @param event - The incoming event (message, button_click, timeout)
   * @param context - Execution context with all dependencies
   * @returns null if event not handled (fall through to normal routing)
   * @returns NodeEventResult with instructions for EventRouter
   */
  handleEvent?(event: JourneyEvent, context: ExecutionContext<TState>): Promise<NodeEventResult | null>;

  /**
   * Optional lifecycle hook - called when a journey is activated.
   */
  onActivate?(context: ActivationContext): Promise<void>;

  /**
   * Optional lifecycle hook - called when a journey is deactivated.
   */
  onDeactivate?(context: ActivationContext): Promise<void>;
}

// =============================================================================
// SERVICE INTERFACES
// =============================================================================

/**
 * Options for sending messages with voice support.
 * Extends MessageOptions from schemas for full compatibility.
 */
export interface SendMessageOptions extends MessageOptions {
  // Engine can add additional options here if needed in the future
}

/**
 * Messenger service for sending messages to users
 */
export interface MessengerService {
  /**
   * Send a message to the current user
   *
   * @param content - Message text
   * @param buttons - Optional button configurations with { id, text, edgeId }
   * @param media - Optional media object with type and URL
   * @param prebuiltContext - Optional pre-built evaluation context (from EdgeSelector.withFullContext)
   *                          to avoid re-fetching variables. If not provided, variables are fetched.
   * @param options - Optional send options (voiceMode, etc.)
   * @returns Result with platform message IDs
   */
  sendMessage(
    content: string,
    buttons?: ButtonConfig[],
    media?: { type: "image" | "video"; url: string },
    prebuiltContext?: Record<string, unknown>,
    options?: SendMessageOptions
  ): Promise<SendMessageResult>;
}

/**
 * Timer service for scheduling and canceling timers
 * All operations are async to ensure proper awaiting of I/O operations
 */
export interface TimerService {
  /**
   * Schedule a timer for a specific edge
   *
   * @param delayMs - Delay in milliseconds
   * @param edgeId - Edge ID to associate with timer
   * @returns Promise resolving to timer ID for cancellation
   */
  scheduleTimer(delayMs: number, edgeId: string): Promise<string>;

  /**
   * Cancel a timer by ID
   *
   * @param timerId - Timer ID to cancel
   * @returns Promise resolving to true if cancelled, false if not found
   */
  cancelTimer(timerId: string): Promise<boolean>;

  /**
   * Cancel all timers for edges from a specific node
   *
   * @param nodeId - Node ID whose timers should be cancelled
   */
  cancelTimersForNode(nodeId: string): Promise<void>;

  /**
   * Get the edge ID associated with a timer
   *
   * @param timerId - Timer ID
   * @returns Edge ID or undefined if not found
   */
  getEdgeForTimer(timerId: string): string | undefined;

  /**
   * Mark a timer as fired (cleanup after timeout event)
   * Call this when processing a timeout event to prevent memory leak
   *
   * @param timerId - Timer ID that fired
   */
  markTimerFired(timerId: string): void;

  /**
   * Clear all timers from the internal map
   * Call this when destroying the engine to prevent memory leaks
   */
  clearAll(): void;

  // =========================================================================
  // PLUGIN FOLLOW-UP METHODS
  // =========================================================================

  /**
   * Schedule a plugin follow-up timer for a sequence step
   *
   * @param pluginId - Plugin node ID
   * @param parentNodeId - Parent node ID that the plugin is attached to
   * @param stepIndex - Step index in the sequence (0-based)
   * @param delayMs - Delay in milliseconds
   * @param sequence - The full follow-up sequence configuration
   * @param timerType - "send" (delay before sending) or "response" (wait after sending)
   * @returns Promise resolving to timer ID
   */
  schedulePluginFollowUpTimer(
    pluginId: string,
    parentNodeId: string,
    stepIndex: number,
    delayMs: number,
    sequence: FollowUpSequence,
    timerType?: "send" | "response"
  ): Promise<string>;

  /**
   * Get plugin follow-up context for a timer
   *
   * @param timerId - Timer ID
   * @returns Plugin follow-up context or undefined if not a plugin follow-up timer
   */
  getPluginFollowUpContext(timerId: string): PluginFollowUpTimerContext | undefined;

  /**
   * Check if a timer is a plugin follow-up timer
   *
   * @param timerId - Timer ID
   * @returns True if this is a plugin follow-up timer
   */
  hasPluginFollowUp(timerId: string): boolean;

  /**
   * Mark a plugin follow-up timer as fired (cleanup after processing)
   *
   * @param timerId - Timer ID that fired
   */
  markPluginFollowUpFired(timerId: string): void;

  /**
   * Cancel all plugin follow-up timers for a parent node
   * Called when user responds to the main message
   *
   * @param parentNodeId - Parent node ID whose plugin follow-up timers should be cancelled
   */
  cancelPluginFollowUpsForNode(parentNodeId: string): Promise<void>;

  /**
   * Cancel all plugin follow-up timers across all nodes
   * Called during engine destroy to prevent stray timers after teardown
   */
  cancelAllPluginFollowUps(): Promise<void>;

  /**
   * Check if plugin follow-ups for a parent node should be cancelled on any user response
   *
   * @param parentNodeId - Parent node ID to check
   * @returns True if plugin follow-ups should be cancelled on user response
   */
  shouldCancelPluginFollowUpsOnResponse(parentNodeId: string): boolean;

  /**
   * Get response behavior for active follow-up step.
   * Returns step-level onResponse if set, otherwise derives from sequence-level setting.
   *
   * @param parentNodeId - Parent node ID to check
   * @returns Response behavior and optional exit target, or null if no active follow-up
   */
  getPluginFollowUpResponseBehavior(parentNodeId: string): {
    behavior: "cancel" | "continue" | "exit";
    exitTargetNodeId?: string;
  } | null;
}

/**
 * Event logger service for recording interaction events
 */
export interface EventLogger {
  /**
   * Log an interaction event
   *
   * @param event - Event data (id and timestamp are auto-generated)
   * @returns The complete interaction event with generated id and timestamp
   */
  logEvent(event: Omit<InteractionEvent, "id" | "timestamp">): InteractionEvent;
}

/**
 * History retention policy for session events.
 */
export interface HistoryRetentionPolicy {
  /** Maximum number of events to retain (drop oldest when exceeded). */
  maxEvents?: number;
  /** Maximum age (ms) to retain (drop events older than now - maxAgeMs). */
  maxAgeMs?: number;
  /** Optional callback when events are trimmed. */
  onTrim?: (params: { removed: InteractionEvent[]; retained: InteractionEvent[] }) => void | Promise<void>;
}

/**
 * Condition evaluator service for evaluating condition nodes
 */
export interface ConditionEvaluatorService {
  /**
   * Evaluate a condition node and return the matching branch ID
   *
   * @param conditionData - Condition node data with expression/rules
   * @param context - Evaluation context (session context + metadata)
   * @returns Branch ID that should be taken
   */
  evaluate(conditionData: ConditionNodeData, context: Record<string, unknown>): string;
}

/**
 * HTTP request configuration for generic executors.
 */
export interface HttpRequestConfig {
  /** Target URL (template variables can be applied by executor) */
  url: string;
  /** HTTP method */
  method: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Optional request body */
  body?: string;
  /** Request timeout override (ms) */
  timeoutMs?: number;
  /** Optional max response size override (bytes) */
  maxResponseBytes?: number;
}

/**
 * HTTP response returned by executor.
 */
export interface HttpResponseData {
  /** HTTP status code */
  statusCode: number;
  /** Parsed response body (JSON or text wrapper) */
  body: unknown;
  /** Response headers as key-value pairs */
  headers: Record<string, string>;
}

/**
 * Webhook executor service for making HTTP requests
 */
export interface WebhookExecutorService {
  /**
   * Execute a webhook request
   *
   * @param webhookData - Webhook node configuration
   * @param context - Context for template variable substitution
   * @returns Response data (possibly extracted via JSONPath)
   * @throws Error if request fails and error handling is not "continue"
   */
  execute(webhookData: WebhookNodeData, context: Record<string, unknown>): Promise<unknown>;

  /**
   * Execute a generic HTTP request with optional retries.
   *
   * @param request - HTTP request configuration
   * @param context - Context for template variable substitution
   * @param retryConfig - Optional retry configuration
   * @returns Parsed response payload + headers
   */
  executeRequest(request: HttpRequestConfig, context: Record<string, unknown>, retryConfig?: HttpRetryConfig): Promise<HttpResponseData>;
}

/**
 * Template service for variable substitution
 */
export interface TemplateService {
  /**
   * Substitute template variables in a string
   *
   * @param template - Template string with {{variable}} placeholders
   * @param context - Context object with variable values
   * @returns String with variables substituted
   *
   * @example
   * ```ts
   * substitute("Hello {{user.name}}", { user: { name: "John" } });
   * // "Hello John"
   * ```
   */
  substitute(template: string, context: Record<string, unknown>): string;
}

/**
 * Tag service for applying/removing tags to users
 *
 * Tags are stored in client_tags table and follow users across all journeys.
 */
export interface TagService {
  /**
   * Execute tag operations
   *
   * @param add - Tags to add
   * @param remove - Tags to remove
   */
  executeTagAction(add?: string[], remove?: string[]): Promise<void>;

  /**
   * Get all tags for the user
   *
   * @returns Array of tag strings
   */
  getTags(): Promise<string[]>;
}

/**
 * Variable service for reading/writing journey and global variables
 *
 * Variables can be stored at two scopes:
 * - "journey": Scoped to a specific journey
 * - "global": Organization-wide, shared across all journeys
 */
export interface VariableService {
  /**
   * Execute variable operations from a variableAction
   *
   * @param action - Variable action with operations and scope
   */
  executeAction(action: VariableAction): Promise<void>;

  /**
   * Get all variables for a scope as a key-value map.
   * Implements IVariableService.getAll from SharedServiceContext.
   *
   * @param scope - "journey", "global", or "user"
   * @returns Key-value map of variables
   */
  getAll(scope: VariableScope): Promise<Record<string, unknown>>;
}

/**
 * CRM service for managing client stages in pipelines
 */
export interface CrmService {
  /**
   * Update client's CRM position (simplified interface)
   *
   * Service determines whether to create or move based on current state:
   * - If client not in pipeline → add to pipeline at stage
   * - If client in pipeline → move to new stage
   *
   * @param clientId - Client ID
   * @param pipelineId - Optional target pipeline ID (uses default if not specified)
   * @param stageId - Optional target stage ID (uses default/Unassigned if not specified)
   * @param notes - Optional notes for the activity log
   */
  updateClientPosition(clientId: string, pipelineId?: string, stageId?: string, notes?: string): Promise<void>;

  /**
   * Add client to a pipeline at the specified stage (or default stage)
   *
   * @param clientId - Client ID
   * @param pipelineId - Optional pipeline ID (uses default if not specified)
   * @param stageId - Optional stage ID (uses default/Unassigned if not specified)
   * @param notes - Optional notes for the activity log
   */
  addToPipeline(clientId: string, pipelineId?: string, stageId?: string, notes?: string): Promise<void>;

  /**
   * Move client to a different stage
   *
   * @param clientId - Client ID
   * @param stageId - Target stage ID
   * @param notes - Optional notes for the activity log
   */
  moveToStage(clientId: string, stageId: string, notes?: string): Promise<void>;

  /**
   * Remove client from a pipeline
   *
   * @param clientId - Client ID
   * @param pipelineId - Pipeline ID to remove from
   */
  removeFromPipeline(clientId: string, pipelineId: string): Promise<void>;
}

/**
 * Result from mindstate analysis pipeline
 */
export interface MindstateAnalysisResult {
  /** Updated state parameters after analysis */
  updatedState: StateParameter[];
  /** Parameter changes that occurred */
  changes: StateChange[];
  /** Pipeline execution metrics */
  metrics?: PipelineMetrics;
}

// =============================================================================
// FOLLOW-UP AI SERVICE (for core/integration boundary separation)
// =============================================================================

/**
 * Configuration for AI content generation in follow-up plugins.
 */
export interface FollowUpAIGenerationConfig {
  /** Model ID to use (e.g., "gemini-3-flash", "claude-haiku") */
  model?: string;
  /** Temperature for non-reasoning models (0-1) */
  temperature?: number;
  /** Reasoning effort for reasoning models */
  reasoningEffort?: "low" | "medium" | "high";
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Fallback model IDs if primary fails */
  fallbackModels?: string[];
  /** Organization ID for usage tracking */
  organizationId?: string;
}

/**
 * Result from AI content generation.
 */
export interface FollowUpAIGenerationResult {
  /** Generated content text */
  content: string;
  /** Model that was actually used (may differ from requested if fallback was used) */
  modelUsed?: string;
  /** Token usage for billing/analytics */
  tokenUsage?: {
    totalTokens?: number;
    costUSD?: number;
  };
}

/**
 * Follow-up AI service for generating AI-enhanced follow-up messages.
 *
 * This service abstracts the LLM dependency from the engine core.
 * The engine defines this interface; @journey/engine-integrations provides
 * the implementation that uses @journey/llm.
 *
 * When this service is not provided, follow-up plugins fall back to
 * static content (step.fallbackContent or step.content).
 */
export interface FollowUpAIService {
  /**
   * Generate AI-enhanced content for a follow-up message.
   *
   * @param systemPrompt - System prompt with persona/voice and context
   * @param userMessage - The task instructions (step.content)
   * @param config - Optional generation configuration
   * @returns Generated content and metadata
   */
  generateContent(
    systemPrompt: string,
    userMessage: string,
    config?: FollowUpAIGenerationConfig
  ): Promise<FollowUpAIGenerationResult>;
}

// =============================================================================
// MINDSTATE SERVICE
// =============================================================================

/**
 * Mindstate service for tracking and analyzing user psychological/situational state
 *
 * Integrates with @journey/mindstate pipeline for AI-powered state analysis.
 */
export interface MindstateService {
  /**
   * Get or create a mindstate for a client
   *
   * @param clientId - Client ID
   * @param mindstateKey - Mindstate definition key (e.g., "onboarding-progress")
   * @returns The client's mindstate instance
   */
  getOrCreateMindstate(clientId: string, mindstateKey: string): Promise<ClientMindstate>;

  /**
   * Run the analysis pipeline on a user message
   *
   * @param clientMindstateId - Client mindstate instance ID
   * @param message - User message to analyze
   * @param sessionId - Optional session ID for event logging
   * @returns Analysis result with updated state and changes
   */
  analyzeMessage(clientMindstateId: string, message: string, sessionId?: string): Promise<MindstateAnalysisResult>;

  /**
   * Get the current value of a specific parameter
   *
   * @param clientId - Client ID
   * @param mindstateKey - Mindstate definition key
   * @param parameterName - Name of the parameter
   * @returns Current value or null if not found
   */
  getParameterValue(clientId: string, mindstateKey: string, parameterName: string): Promise<StateParameterValue | null>;

  /**
   * Get current values from multiple parameters across mindstates
   * Used for cross-mindstate conditions
   *
   * @param clientId - Client ID
   * @param queries - Array of {mindstateKey, parameterName} pairs
   * @returns Map of "mindstateKey.parameterName" to values
   */
  getMultipleParameterValues(clientId: string, queries: Array<{ mindstateKey: string; parameterName: string }>): Promise<Map<string, StateParameterValue>>;

  /**
   * Manually set a parameter value
   *
   * @param clientId - Client ID
   * @param mindstateKey - Mindstate definition key
   * @param parameterName - Name of the parameter
   * @param value - New value
   * @param reasoning - Optional reasoning for the update (for auditing)
   */
  setParameterValue(clientId: string, mindstateKey: string, parameterName: string, value: StateParameterValue, reasoning?: string): Promise<void>;
}

// =============================================================================
// AGENT WORKFLOW TYPES
// =============================================================================

/**
 * Input payload for agent workflow execution.
 */
export interface AgentWorkflowInput {
  message: string;
  conversationHistory: ConversationMessage[];
}

/**
 * Workflow event structure for emission.
 * Matches the pattern used by @journey/llm workflow runner.
 */
export interface WorkflowEventPayload {
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Workflow event emitter callback type.
 * Provided by the API layer to emit workflow lifecycle events to the event bus.
 */
export type WorkflowEventEmitterFn = (event: WorkflowEventPayload) => void;

/**
 * Minimal workflow context for agent execution.
 * Mirrors the LLM workflow context without coupling to @journey/llm types.
 */
export interface AgentWorkflowContext {
  orgId: string;
  sessionId: string;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  };
  journey?: {
    journeyId: string;
    currentNodeId: string;
    variables: Record<string, unknown>;
    tags?: string[];
  };
  clientData?: ClientData;
  log: ReturnType<typeof createLogger>;
  settings: {
    maxExecutionTimeMs: number;
    nodeTimeoutMs: number;
    /** Force mock responses for agent nodes (testing only). */
    mockLlm?: boolean;
  };
  services?: SharedServiceContext;
  abortSignal?: AbortSignal;
  currentNodeId?: string;
  workflowRunId?: string;
  /** Optional event emitter for real-time workflow updates via SSE */
  emit?: WorkflowEventEmitterFn;
  /**
   * Full evaluation context with all namespaces for template/expression evaluation.
   * Includes: vars.journey.*, vars.global.*, vars.user.*, nodes.*, session.*, user.*
   */
  evalContext?: Record<string, unknown>;
  /** Voice output mode from journey agent node (for TTS) */
  voiceMode?: VoiceMode;
  /** Voice profile (TTS voice) to use for voice responses */
  voiceProfile?: string;
  /** Voice provider (openai or elevenlabs) */
  voiceProvider?: "openai" | "elevenlabs";
  /** ElevenLabs model to use for TTS (when voiceProvider is elevenlabs) */
  elevenLabsModel?: string;
  /**
   * Additional context to append to agent system prompts.
   * Built from journey agent node's AI context settings.
   */
  additionalSystemContext?: string;
  /**
   * Tool timing overrides from journey node config.
   * Allows users to configure whether tools execute before or after message.
   * Key format: "system:tool_name" or "tool_name"
   */
  toolTimingOverrides?: Record<string, ToolExecutionTiming>;
}

/**
 * Result of an agent workflow run (subset of LLM workflow result).
 *
 * Note: `usage` is `AggregatedUsage` (not `TokenUsage`) because a workflow
 * execution involves multiple LLM calls that are aggregated together.
 */
export interface AgentWorkflowRunResult {
  success: boolean;
  blocked?: boolean;
  blockedMessage?: string;
  response?: string;
  toolCalls?: Array<{ name: string }>;
  trace: Array<{
    nodeId: string;
    nodeType?: string;
    status?: string;
    outHandle?: string;
    durationMs?: number;
    error?: string;
    metadata?: Record<string, unknown>;
  }>;
  totalDurationMs: number;
  usage?: import("@journey/schemas").AggregatedUsage;
  /**
   * Deferred tool calls for post-message execution.
   *
   * These tools have timing="deferred" and should be executed
   * AFTER the message is sent to the user (fire-and-forget).
   */
  deferredToolCalls?: Array<{
    name: string;
    args: unknown;
    execute: () => Promise<unknown>;
  }>;
  /**
   * Explicit exit signal from agent.
   * Set when exit_to_next_node tool is called.
   * Used for reliable exit detection in handler.
   */
  exitRequested?: boolean;
}

/**
 * Options for loading workflows.
 */
export interface LoadWorkflowOptions {
  /** Allow loading draft workflows (default: false) */
  allowDrafts?: boolean;
  /** Allow loading archived workflows (default: false) */
  allowArchived?: boolean;
}

/**
 * Agent workflow service for loading and executing workflows.
 */
export interface AgentWorkflowService {
  /** Optional one-time initialization (e.g., register executors) */
  initialize?: () => void | Promise<void>;
  loadWorkflow(params: {
    organizationId: string;
    workflowKey: string;
    options?: LoadWorkflowOptions;
  }): Promise<AgentWorkflow | null>;
  runWorkflow(params: {
    workflow: AgentWorkflow;
    input: AgentWorkflowInput;
    context: AgentWorkflowContext;
  }): Promise<AgentWorkflowRunResult>;
}


/**
 * Container for all engine services
 *
 * Extends SharedServiceContext for unified service access, plus
 * engine-specific services (timer, eventLogger, conditionEvaluator, webhookExecutor).
 *
 * This is the main dependency injection point for handlers.
 * All services are injected through this container.
 *
 * @see SharedServiceContext from @journey/schemas for common services
 */
export interface EngineServices extends SharedServiceContext {
  // =========================================================================
  // Engine-Specific Services (not in SharedServiceContext)
  // =========================================================================

  /** Timer service for scheduling and canceling timers */
  timer: TimerService;

  /** Event logger for recording interaction events */
  eventLogger: EventLogger;

  /** Condition evaluator for routing decisions */
  conditionEvaluator: ConditionEvaluatorService;

  /** Webhook executor for HTTP requests */
  webhookExecutor: WebhookExecutorService;

  // =========================================================================
  // Overrides for Engine-Specific Implementations
  // =========================================================================

  /** Messenger service (engine-specific implementation) */
  messenger: MessengerService;

  /** Template service (engine-specific implementation) */
  template: TemplateService;

  /** Tag service (engine-specific implementation) */
  tag: TagService;

  /** Variable service (engine-specific implementation) */
  variable: VariableService;

  /** Optional CRM service - if not provided, CRM nodes will be no-ops */
  crm?: CrmService;

  /** Optional Mindstate service - if not provided, mindstate nodes will be no-ops */
  mindstate?: MindstateService;

  /** Optional agent workflow service for agent nodes */
  agentWorkflow?: AgentWorkflowService;

  /** Optional workflow event emitter for real-time SSE updates */
  workflowEventEmitter?: WorkflowEventEmitterFn;

  /**
   * Optional follow-up AI service for generating AI-enhanced follow-up messages.
   * When not provided, follow-up plugins fall back to static content.
   * Implementation is provided by @journey/engine-integrations.
   */
  followUpAI?: FollowUpAIService;

  /** Conversation history service for building and managing conversation history */
  conversationHistory: ConversationHistoryService;

  /**
   * Optional messaging adapter for platform-specific features like typing indicators.
   * Provides access to startTypingIndicator/stopTypingIndicator when available.
   */
  adapter?: MessagingAdapter;
}

// =============================================================================
// ENGINE CONFIGURATION
// =============================================================================

/**
 * Tag operations for add/remove
 */
export interface TagOperations {
  add?: string[];
  remove?: string[];
}

/**
 * Callback for executing tag operations
 * This is called by the engine when a node has tagAction
 *
 * @param clientId - The client ID to apply tags to
 * @param operations - add/remove tag arrays
 */
export type TagOperationCallback = (clientId: string, operations: TagOperations) => Promise<void>;

/**
 * Callback for getting tag values
 * Returns all tags for a user as a string array
 *
 * @param clientId - The client ID to get tags for
 */
export type GetTagsCallback = (clientId: string) => Promise<string[]>;

/**
 * Callback for executing variable operations
 * This is called by the engine when a node has variableAction
 */
export type VariableOperationCallback = (scope: VariableScope, scopeId: string, operations: VariableAction["journeyOperations"]) => Promise<void>;

/**
 * Callback for getting variable values
 * Returns all variables for a given scope as a key-value map
 */
export type GetVariablesCallback = (scope: VariableScope, scopeId: string) => Promise<Record<string, unknown>>;

/**
 * Variable operation type for user variables
 * Uses VariableOperation from @journey/schemas (single source of truth)
 */
export type { VariableOperation as UserVariableOperation } from "@journey/schemas";
export type { EventQueueConfig, EventQueueFactory };

// Re-export VoiceConfig from schemas for consumers who import from engine
export type { VoiceConfig, MessageOptions } from "@journey/schemas";

/**
 * Callback for executing user variable operations
 * This is called by the engine when a node has variableAction with userOperations
 * User variables are stored in the unified variables table (user scope)
 */
export type UserVariableOperationCallback = (userId: string, operations: import("@journey/schemas").VariableOperation[]) => Promise<void>;

/**
 * Callback for getting user variable values
 * Returns all user variables as a key-value map
 */
export type GetUserVariablesCallback = (userId: string) => Promise<Record<string, unknown>>;

/**
 * Client profile data (from database)
 * Used for building execution context with user information
 */
export interface ClientData {
  id: string;
  platform: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

/**
 * Configuration options for SessionEngine
 */
export interface SessionEngineConfig {
  /** Optional external event callback */
  onEvent?: (event: InteractionEvent) => void;

  /** Optional custom logger */
  logger?: ReturnType<typeof createLogger>;

  /** Optional event queue factory for multi-instance runtimes */
  eventQueueFactory?: EventQueueFactory;

  /** Optional event queue config (metrics/backpressure hooks) */
  eventQueueConfig?: Omit<EventQueueConfig, "log" | "dlq" | "dlqContext">;

  /** Optional callback for executing tag operations */
  onTagOperation?: TagOperationCallback;

  /** Optional callback for getting tag values */
  onGetTags?: GetTagsCallback;

  /** Optional callback for executing variable operations */
  onVariableOperation?: VariableOperationCallback;

  /** Optional callback for getting variable values */
  onGetVariables?: GetVariablesCallback;

  /** Optional callback for executing user variable operations (persists on channel_users) */
  onUserVariableOperation?: UserVariableOperationCallback;

  /** Optional callback for getting user variable values */
  onGetUserVariables?: GetUserVariablesCallback;

  /** Organization ID for global variable scope */
  organizationId?: string;

  /** Client profile data (for template bindings) */
  clientData?: ClientData;

  /** Optional CRM service for managing client pipeline stages */
  crmService?: CrmService;

  /** Journey's default pipeline ID (used when CRM node doesn't specify pipeline) */
  defaultPipelineId?: string;

  /** Optional Mindstate service for AI-powered state tracking */
  mindstateService?: MindstateService;

  /**
   * Mindstate configuration for this journey
   * Contains keys of mindstate definitions to track and analysis mode
   */
  mindstateConfig?: JourneyMindstateConfig;

  /** Optional history retention policy for session events */
  historyRetention?: HistoryRetentionPolicy;

  /**
   * Optional agent workflow service (DB + LLM integration).
   * Required for agent nodes to execute workflows.
   */
  agentWorkflowService?: AgentWorkflowService;

  /**
   * Optional memory service for agent tools.
   * When provided, workflow tools can store and recall memories.
   */
  memoryService?: SharedServiceContext["memory"];

  /**
   * Optional follow-up AI service for generating AI-enhanced follow-up messages.
   * When not provided, follow-up plugins fall back to static content.
   * Implementation is provided by @journey/engine-integrations.
   */
  followUpAIService?: FollowUpAIService;

  /**
   * Callback when messages are sent - for persisting sent message records
   * Called with platform message IDs for edit/delete and reply threading
   */
  onMessageSent?: (params: {
    sessionId: string;
    nodeId: string;
    interactionEventId: string;
    platform: string;
    chatId: string;
    content?: string;
    messages: Array<{ platformMessageId: string; messageType: string }>;
  }) => Promise<void>;

  /**
   * If true, variable operation failures will stop journey execution
   * and set session status to "error". Default: false (graceful degradation).
   *
   * When enabled:
   * - Errors are logged with full context
   * - Session status is set to "error"
   * - Session errorMessage is populated
   * - A variable_error event is emitted
   * - Journey execution stops
   *
   * When disabled (default):
   * - Errors are logged but journey continues
   * - Graceful degradation pattern
   */
  strictVariableOperations?: boolean;

  /**
   * Callback to persist failed events to the Dead Letter Queue.
   * Called when event processing fails in the EventQueue.
   *
   * If not provided, failed events are logged but not persisted.
   *
   * @example
   * ```ts
   * const engine = new SessionEngine(session, journey, adapter, {
   *   onFailedEvent: async (record) => {
   *     await db.insert(failedEvents).values({
   *       sessionId: record.sessionId,
   *       eventType: record.eventType,
   *       eventPayload: record.eventPayload,
   *       errorMessage: record.errorMessage,
   *       errorStack: record.errorStack,
   *     });
   *   },
   * });
   * ```
   */
  onFailedEvent?: (record: import("./services/dlq-service").FailedEventRecord) => Promise<void>;

  /**
   * Custom node handlers to register in addition to built-in handlers.
   * Enables adding new node types without modifying the core engine.
   * Use handlerOverrides to replace built-in handlers.
   *
   * @example
   * ```ts
   * const engine = new SessionEngine(session, journey, adapter, {
   *   customHandlers: [myCustomHandler],
   * });
   * ```
   */
  customHandlers?: NodeHandler[];

  /**
   * Explicit overrides for built-in handlers (replace by nodeType).
   * Use this when you need to swap a core handler implementation.
   *
   * @example
   * ```ts
   * const engine = new SessionEngine(session, journey, adapter, {
   *   handlerOverrides: [myMessageHandler],
   * });
   * ```
   */
  handlerOverrides?: NodeHandler[];

  /**
   * Custom middleware to add to the post-handler pipeline.
   * Middleware runs after node handlers complete, in priority order.
   *
   * Built-in middleware (tags, variables, CRM) runs at priorities 20, 25, 50.
   * Use priorities 100+ for custom middleware to run after built-ins.
   *
   * @example
   * ```ts
   * const engine = new SessionEngine(session, journey, adapter, {
   *   customMiddleware: [
   *     { name: "audit", middleware: auditMiddleware, priority: 90 },
   *     { name: "analytics", middleware: analyticsMiddleware, priority: 100 },
   *   ],
   * });
   * ```
   */
  customMiddleware?: import("./middleware").MiddlewareDefinition[];

  /**
   * Validate journey structure before starting execution.
   *
   * When enabled, the engine runs validateJourneyStructure() in start().
   * - `true` or `{}`: Logs warnings/errors but continues execution
   * - `{ strict: true }`: Throws if validation finds errors
   *
   * This is useful for catching structural issues early in development
   * rather than encountering them at runtime.
   *
   * @example
   * ```ts
   * // Log validation issues but continue
   * const engine = new SessionEngine(session, journey, adapter, {
   *   validateOnStart: true,
   * });
   *
   * // Fail fast if journey is invalid
   * const engine = new SessionEngine(session, journey, adapter, {
   *   validateOnStart: { strict: true },
   * });
   * ```
   */
  validateOnStart?: boolean | { strict?: boolean };

  /**
   * Optional workflow event emitter for real-time SSE updates.
   * When provided, agent workflows emit lifecycle events (started, step.started, etc.)
   * that can be forwarded to the event bus for SSE consumers.
   *
   * The callback receives a WorkflowEventPayload with type and payload,
   * and should publish it to the event bus in a non-blocking manner.
   */
  workflowEventEmitter?: WorkflowEventEmitterFn;

  /**
   * Scale factor for timer delays (1 = real time, 0.01 = 100x faster).
   * Applied by TimerService when scheduling timers.
   */
  timerScale?: number;

  /**
   * Maximum number of auto-transition iterations allowed before stopping.
   * Prevents infinite loops in journey graphs with auto-transitioning nodes.
   *
   * Default: 100
   *
   * @example
   * ```ts
   * // Allow more iterations for complex branching journeys
   * const engine = new SessionEngine(session, journey, adapter, {
   *   maxLoopIterations: 200,
   * });
   * ```
   */
  maxLoopIterations?: number;

  /**
   * Pre-built GraphIndex to use instead of creating a new one.
   * Useful for testing where many engine instances share the same journey.
   *
   * @example
   * ```ts
   * // Share graph index across multiple engine instances
   * const graphIndex = new GraphIndex(journey);
   * const engine1 = new SessionEngine(session1, journey, adapter, { graphIndex });
   * const engine2 = new SessionEngine(session2, journey, adapter, { graphIndex });
   * ```
   */
  graphIndex?: import("./graph-index").GraphIndex;

  /**
   * Pre-built HandlerRegistry to use instead of creating a new one.
   * Useful for testing where many engine instances share the same handlers.
   *
   * @example
   * ```ts
   * // Share handler registry across multiple engine instances
   * const handlerRegistry = createHandlerRegistryWithOverrides({});
   * const engine = new SessionEngine(session, journey, adapter, { handlerRegistry });
   * ```
   */
  handlerRegistry?: import("./handlers").HandlerRegistry;

}
