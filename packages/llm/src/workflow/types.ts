/**
 * Workflow Types - Core interfaces for workflow execution
 *
 * This module defines the contract between the graph runner and node executors.
 * Uses SharedServiceContext from @journey/schemas for unified service access
 * across all execution contexts.
 */

import type { WorkflowNodeType, WorkflowEventTypeValue, SharedServiceContext, ConversationMessage, ToolCall, AggregatedUsage, VoiceMode, ToolExecutionTiming } from "@journey/schemas";
import type { ClientData } from "../tools/builtin/types";

// ============================================================
// Logger Interface
// ============================================================

/**
 * Logger interface matching what createLogger() returns.
 * We define this locally to avoid pino dependency in types.
 */
export interface WorkflowLogger {
  trace: (payload?: Record<string, unknown> | string, message?: string) => void;
  debug: (payload?: Record<string, unknown> | string, message?: string) => void;
  info: (payload?: Record<string, unknown> | string, message?: string) => void;
  warn: (payload?: Record<string, unknown> | string, message?: string) => void;
  error: (payload?: Record<string, unknown> | string, message?: string) => void;
  fatal: (payload?: Record<string, unknown> | string, message?: string) => void;
  child: (childExtras: Record<string, unknown>) => WorkflowLogger;
}

// ============================================================
// Workflow Events
// ============================================================

/**
 * Workflow event structure for emission.
 * Matches the event bus pattern used in the API.
 */
export interface WorkflowEvent {
  type: WorkflowEventTypeValue;
  payload: Record<string, unknown>;
}

/**
 * Event emitter function type.
 * Called by the runner to emit workflow lifecycle events.
 */
export type WorkflowEventEmitter = (event: WorkflowEvent) => void;

// ============================================================
// Node Input/Output
// ============================================================

/**
 * Input provided to each node executor.
 */
export interface NodeInput {
  /** Current user message */
  message: string;

  /** Conversation history */
  conversationHistory: ConversationMessage[];

  /** Accumulated workflow variables */
  variables: Record<string, unknown>;

  /** Outputs from previously executed nodes (keyed by nodeId) */
  previousNodeOutputs: Map<string, NodeOutput>;
}

/**
 * Pause state for user approval nodes.
 * Contains all information needed to resume the workflow after approval.
 */
export interface PauseState {
  nodeId: string;
  approvalMessage: string;
  timeoutSeconds?: number;
  timeoutAction?: "approve" | "reject" | "skip";
  allowedRoles?: string[];
}

/**
 * Output returned by each node executor.
 */
export interface NodeOutput {
  /** Which output handle to follow (for branching nodes) */
  outHandle?: string;

  /** Data to merge into workflow variables */
  data?: Record<string, unknown>;

  /** Response text (for agent nodes) */
  response?: string;

  /** Tool calls made (for agent nodes) */
  toolCalls?: ToolCall[];

  /** Whether execution was blocked (for guard nodes) */
  blocked?: boolean;

  /** Message when blocked */
  blockedMessage?: string;

  /** Whether execution should pause (for user_approval nodes) */
  paused?: boolean;

  /** Reason for pause when paused=true */
  pauseReason?: "user_approval";

  /** Pause configuration when paused=true */
  pauseState?: PauseState;

  /** Execution time in milliseconds */
  executionTimeMs: number;

  /** Additional metadata for debugging */
  metadata?: Record<string, unknown>;

  /**
   * Deferred tool calls for post-message execution.
   * Passed through from agent engine for execution after message sent.
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

// ============================================================
// Workflow Context
// ============================================================

/**
 * Context passed to all node executors.
 *
 * When running within a journey, optional services are injected by the engine,
 * enabling built-in tools (messaging, memory, variables) to function.
 */
export interface WorkflowContext {
  /** Organization ID */
  orgId: string;

  /** Session/conversation ID */
  sessionId: string;

  /** Current user info */
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  };

  /** Journey context (if running within a journey) */
  journey?: {
    journeyId: string;
    currentNodeId: string;
    variables: Record<string, unknown>;
    tags?: string[];
  };

  /** Client data for messaging */
  clientData?: ClientData;

  /** Logger instance */
  log: WorkflowLogger;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Workflow-level settings */
  settings: {
    maxExecutionTimeMs: number;
    nodeTimeoutMs: number;
    /** Force mock responses for agent nodes (testing only). */
    mockLlm?: boolean;
  };

  /** Current node being executed (set by runner) */
  currentNodeId?: string;

  /** Unique run ID for this workflow execution */
  workflowRunId?: string;

  /**
   * Unified service context for accessing all services.
   * Injected when running within journey context.
   * Enables built-in tools (messaging, memory, variables) to function.
   *
   * @see SharedServiceContext from @journey/schemas
   */
  services?: SharedServiceContext;

  /**
   * Optional event emitter for workflow lifecycle events.
   * When provided, the runner emits events for workflow/step start/complete.
   */
  emit?: WorkflowEventEmitter;

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
   * Injected from journey agent node's AI context settings.
   * Contains user profile, node outputs, session state, and custom context.
   */
  additionalSystemContext?: string;

  /**
   * Tool timing overrides from journey node config.
   * Allows users to configure whether tools execute before or after message.
   * Key format: "system:tool_name" or "tool_name"
   */
  toolTimingOverrides?: Record<string, ToolExecutionTiming>;
}

// ============================================================
// Node Executor Interface
// ============================================================

/**
 * Interface that all node executors must implement.
 */
export interface NodeExecutor<TConfig = unknown> {
  /**
   * Execute the node logic.
   *
   * @param input - Input data from previous nodes
   * @param config - Node-specific configuration
   * @param context - Workflow execution context
   * @returns Output including routing handle and data
   */
  execute(input: NodeInput, config: TConfig, context: WorkflowContext): Promise<NodeOutput>;
}

// ============================================================
// Execution Trace
// ============================================================

export interface NodeTrace {
  nodeId: string;
  nodeType: WorkflowNodeType;
  status: "completed" | "blocked" | "error" | "skipped" | "paused";
  outHandle?: string;
  durationMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Serializable version of NodeInput for persistence.
 * Used to store workflow state when pausing for user approval.
 */
export interface SerializableNodeInput {
  message: string;
  conversationHistory: ConversationMessage[];
  variables: Record<string, unknown>;
  /** Serialized from Map to Record for JSON storage */
  previousNodeOutputs: Record<string, NodeOutput>;
}

/**
 * Pause state for workflow result.
 * Contains everything needed to resume workflow execution.
 */
export interface WorkflowPauseState {
  currentNodeId: string;
  nodeInput: SerializableNodeInput;
  pauseData: PauseState;
}

export interface WorkflowResult {
  success: boolean;
  blocked?: boolean;
  blockedMessage?: string;
  response?: string;
  toolCalls?: ToolCall[];
  trace: NodeTrace[];
  totalDurationMs: number;
  variables: Record<string, unknown>;

  /** Whether workflow is paused (for user_approval nodes) */
  paused?: boolean;

  /** Reason for pause */
  pauseReason?: "user_approval";

  /** Approval ID (set by caller after creating approval record) */
  approvalId?: string;

  /** Internal pause state for resume (serializable) */
  _pauseState?: WorkflowPauseState;

  /** Token usage metrics aggregated from all LLM calls during workflow execution */
  usage?: AggregatedUsage;

  /**
   * Deferred tool calls for post-message execution.
   * Passed through from agent node for execution after message sent.
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

// ============================================================
// Graph Types
// ============================================================

export interface GraphEdge {
  target: string;
  handle: string;
}

export interface AdjacencyMap {
  /** Get outgoing edges from a node */
  getOutgoing(nodeId: string): GraphEdge[];

  /** Get specific edge by source and handle */
  getOutgoingByHandle(nodeId: string, handle: string): GraphEdge | undefined;

  /** Get incoming edges to a node */
  getIncoming(nodeId: string): Array<{ source: string; handle: string }>;
}
