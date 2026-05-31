import type {
  StateParameter,
  SystemAgent,
  MainAgent,
  AgentInsight,
  PipelineMetrics,
  TokenUsage,
  MindstateMessage,
} from "@journey/schemas";

// Re-export from schemas for convenience
export type {
  StateParameter,
  SystemAgent,
  MainAgent,
  AgentInsight,
  PipelineMetrics,
  TokenUsage,
  StateChange,
  StateParameterValue,
  MindstateMessage,
} from "@journey/schemas";

// =============================================================================
// MESSAGE TYPES
// =============================================================================

/**
 * Message in mindstate conversation history
 * Canonical type defined in @journey/schemas
 */
export type Message = MindstateMessage;

// =============================================================================
// PIPELINE CONTEXT
// =============================================================================

/**
 * Immutable snapshot of the ECS state at pipeline start
 */
export interface PipelineContext {
  readonly userState: StateParameter[];
  readonly systemAgents: SystemAgent[];
  readonly mainAgent: MainAgent;
  readonly messages: Message[];
}

/**
 * Input to start the pipeline
 */
export interface PipelineInput {
  userMessage: string;
  context: PipelineContext;
}

// =============================================================================
// STEP OUTPUTS
// =============================================================================

export interface IngestOutput {
  message: Message;
}

export interface ContextOutput {
  conversationContext: string;
  recentMessages: Message[];
}

export interface WorkloadOutput {
  agentWorkload: Map<string, StateParameter[]>;
  agentCount: number;
}

/**
 * Parameter update from agent
 */
export interface ParameterUpdate {
  id: string;
  newValue: string | number | boolean;
  reasoning: string;
  agentId: string;
  agentName?: string;
}

export interface AgentBatchResult {
  agent: SystemAgent;
  analysis: string[];
  updates: ParameterUpdate[];
  tokenUsage?: TokenUsage;
}

/**
 * Information about a failed agent dispatch
 */
export interface AgentDispatchFailure {
  agentId: string;
  agentName: string;
  error: Error;
  affectedParams: string[];
}

export interface DispatchOutput {
  batchResults: AgentBatchResult[];
  failedAgents?: AgentDispatchFailure[];
  partialSuccess?: boolean;
  allAgentsFailed?: boolean;
}

export interface AggregateOutput {
  flatUpdates: ParameterUpdate[];
  conflicts?: Array<{
    parameterId: string;
    parameterName: string;
    agentIds: string[];
    selectedAgentId: string;
  }>;
}

export interface InsightsOutput {
  insights: AgentInsight[];
}

export interface StateUpdateOutput {
  updatedState: StateParameter[];
  changes: Array<{
    parameterId: string;
    parameterName: string;
    oldValue: string | number | boolean;
    newValue: string | number | boolean;
    reasoning: string;
    agentId: string;
  }>;
}

export interface ResponseOutput {
  response: string;
  assistantMessage: Message;
  tokenUsage?: TokenUsage;
}

// =============================================================================
// PIPELINE RESULT
// =============================================================================

export interface PipelineResult {
  userMessage: Message;
  assistantMessage: Message;
  updatedState: StateParameter[];
  newInsights: AgentInsight[];
  changes: StateUpdateOutput["changes"];
  metrics: PipelineMetrics;
  failedAgents?: AgentDispatchFailure[];
  partialSuccess?: boolean;
  allAgentsFailed?: boolean;
  conflicts?: AggregateOutput["conflicts"];
  mainAgentError?: Error;
}

export interface PipelineError {
  step: string;
  error: Error;
  partial?: Partial<PipelineResult>;
}

// =============================================================================
// HOOKS / CALLBACKS
// =============================================================================

export interface PipelineHooks {
  onStepStart?: (stepName: string) => void;
  onStepComplete?: (stepName: string, durationMs: number) => void;
  onAgentProcessing?: (agentId: string, agentName: string) => void;
  onAgentComplete?: (agentId: string, updates: number) => void;
  onError?: (error: PipelineError) => void;
}

// =============================================================================
// PIPELINE OPTIONS
// =============================================================================

export interface PipelineOptions {
  contextMessageLimit?: number;
  insightsLimit?: number;
  hooks?: PipelineHooks;
  fallbackAgentId?: string;
}
