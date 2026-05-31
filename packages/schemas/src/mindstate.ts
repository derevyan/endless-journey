import { z } from "zod";

import { SystemPromptRefSchema, type SystemPromptRef } from "./agents/workflow/nodes/shared";
import { JourneyStatusValues } from "./common/status";

// Re-export for consumers
export { SystemPromptRefSchema };
export type { SystemPromptRef };

// =============================================================================
// MINDSTATE STATUS
// =============================================================================

/**
 * MindstateStatus - uses same values as JourneyStatus for consistency
 * - draft: Work in progress
 * - active: Live and running
 * - archived: No longer active
 */
export const MindstateStatusValues = JourneyStatusValues;
export const MindstateStatusSchema = z.enum(MindstateStatusValues);
export type MindstateStatus = z.infer<typeof MindstateStatusSchema>;

// =============================================================================
// PROMPT SOURCE
// =============================================================================

/**
 * PromptSource - determines whether the agent uses inline or repository prompts
 * - inline: systemPrompt is defined directly in the agent config
 * - repository: promptRef references a prompt from the prompt repository
 */
export const PromptSourceSchema = z.enum(["inline", "repository"]);
export type PromptSource = z.infer<typeof PromptSourceSchema>;

// =============================================================================
// SCALE TYPES
// =============================================================================

/**
 * ScaleType enum - defines how parameter values are constrained
 */
export const ScaleTypeValues = ["NUMERIC", "CATEGORICAL", "BOOLEAN"] as const;
export const ScaleTypeSchema = z.enum(ScaleTypeValues);
export type ScaleType = z.infer<typeof ScaleTypeSchema>;

// =============================================================================
// LLM CONFIG FOR MINDSTATE AGENTS
// =============================================================================

import { LLMProviderSchema, ReasoningEffortSchema } from "./llm/providers";
import { llmConfig } from "./config";

/**
 * LLM Configuration for mindstate agents
 *
 * Provider can be explicitly specified or auto-detected from model name.
 * Uses canonical LLMProviderSchema for consistent provider naming.
 *
 * Examples:
 * - "gemini-2.0-flash" → auto-detects google-genai
 * - "gpt-4o" → auto-detects openai
 * - "claude-sonnet-4-5-20250929" → auto-detects anthropic
 * - "mock" → Mock provider for testing
 */
export const AgentLLMConfigSchema = z.object({
  /** Model name (e.g., "gemini-2.0-flash", "gpt-4o", "claude-sonnet-4-5-20250929") */
  model: z.string().min(1),
  /** Provider - optional, auto-detected from model name if omitted */
  provider: LLMProviderSchema.optional(),
  /** Temperature for non-reasoning models (0-2). Ignored for reasoning models. */
  temperature: z.number().min(0).max(2).optional(),
  /** Reasoning effort for reasoning models (o1, o3). Replaces temperature. */
  reasoningEffort: ReasoningEffortSchema.optional(),
  maxTokens: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(), // seconds
  maxRetries: z.number().int().min(0).max(10).optional(),
});
export type AgentLLMConfig = z.infer<typeof AgentLLMConfigSchema>;

// =============================================================================
// STATE PARAMETER VALUE
// =============================================================================

/**
 * Union type for state parameter values
 */
export const StateParameterValueSchema = z.union([z.number(), z.string(), z.boolean()]);
export type StateParameterValue = z.infer<typeof StateParameterValueSchema>;

// =============================================================================
// STATE PARAMETER HISTORY
// =============================================================================

/**
 * Single entry in state history
 */
export const StateHistoryEntrySchema = z.object({
  timestamp: z.number().int().positive(),
  value: StateParameterValueSchema,
  reasoning: z.string(),
});
export type StateHistoryEntry = z.infer<typeof StateHistoryEntrySchema>;

// =============================================================================
// MINDSTATE MESSAGE
// =============================================================================

/**
 * Message in mindstate conversation history
 * Uses numeric timestamp for serialization safety across API boundaries
 */
export const MindstateMessageSchema = z.object({
  id: z.string().min(1).describe("Unique message identifier"),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestampMs: z.number().int().positive().describe("Unix timestamp in milliseconds"),
});
export type MindstateMessage = z.infer<typeof MindstateMessageSchema>;

// =============================================================================
// DETECTION HINTS
// =============================================================================

/**
 * Detection hints for AI to recognize state changes
 */
export const DetectionHintsSchema = z.object({
  phrasesRaise: z.array(z.string()).optional(),
  phrasesLower: z.array(z.string()).optional(),
  observations: z.array(z.string()).optional(),
});
export type DetectionHints = z.infer<typeof DetectionHintsSchema>;

// =============================================================================
// UPDATE POLICY
// =============================================================================

/**
 * Update policy governs how state values change
 */
export const UpdatePolicySchema = z.object({
  hysteresis: z.number().min(0).max(1).optional(),
});
export type UpdatePolicy = z.infer<typeof UpdatePolicySchema>;

// =============================================================================
// STATE PARAMETER
// =============================================================================

/**
 * Semantic direction values for state parameters
 */
export const SemanticDirections = {
  LOW_IS_GOOD: "low_is_good",
  HIGH_IS_GOOD: "high_is_good",
} as const;

export const SemanticDirectionValues = ["low_is_good", "high_is_good"] as const;
export const SemanticDirectionSchema = z.enum(SemanticDirectionValues);
export type SemanticDirection = z.infer<typeof SemanticDirectionSchema>;

/**
 * StateParameter - represents a "Component" in ECS terms
 * A single trackable aspect of the user's state
 *
 * @example
 * const moodParam: StateParameter = {
 *   id: "mood",
 *   name: "Mood",
 *   category: "Emotional",
 *   description: "Current emotional mood level",
 *   scaleType: "NUMERIC",
 *   min: 0,
 *   max: 10,
 *   currentValue: 5,
 *   responsibleAgentId: "emotional_agent",
 *   semanticDirection: "high_is_good",
 *   history: [],
 * };
 */
export const StateParameterSchema = z
  .object({
    // Identity
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    category: z.string().min(1),
    description: z.string(),

    // Data Structure Config
    scaleType: ScaleTypeSchema,
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(z.string()).optional(),

    // AI Control Config
    responsibleAgentId: z.string().min(1),
    updatePolicy: UpdatePolicySchema.optional(),
    detectionHints: DetectionHintsSchema.optional(),

    // Display Config
    semanticDirection: SemanticDirectionSchema.optional(),

    // Runtime State
    currentValue: StateParameterValueSchema,
    history: z.array(StateHistoryEntrySchema).default([]),
  })
  .refine(
    (data) => {
      // Validate min <= max when both are provided
      if (data.min !== undefined && data.max !== undefined) {
        return data.min <= data.max;
      }
      return true;
    },
    {
      message: "min must be less than or equal to max",
      path: ["min"],
    }
  )
  .refine(
    (data) => {
      // For NUMERIC scale type, validate currentValue is within range if min/max are set
      if (data.scaleType === "NUMERIC" && typeof data.currentValue === "number") {
        if (data.min !== undefined && data.currentValue < data.min) {
          return false;
        }
        if (data.max !== undefined && data.currentValue > data.max) {
          return false;
        }
      }
      return true;
    },
    {
      message: "currentValue must be within min/max range for NUMERIC scale type",
      path: ["currentValue"],
    }
  )
  .refine(
    (data) => {
      // CATEGORICAL scale type must have at least one option
      if (data.scaleType === "CATEGORICAL") {
        return data.options && data.options.length > 0;
      }
      return true;
    },
    {
      message: "CATEGORICAL parameters must have options array with at least one value",
      path: ["options"],
    }
  )
  .refine(
    (data) => {
      // For CATEGORICAL scale type, currentValue must be one of the options
      if (data.scaleType === "CATEGORICAL") {
        if (data.currentValue && typeof data.currentValue === "string") {
          return data.options && data.options.includes(data.currentValue);
        }
      }
      return true;
    },
    {
      message: "CATEGORICAL parameters must have currentValue matching one of the options",
      path: ["currentValue"],
    }
  );
export type StateParameter = z.infer<typeof StateParameterSchema>;

/**
 * Schema for creating new parameters (without history)
 * Built separately to avoid omit() on schemas with refinements
 */
export const CreateStateParameterSchema = z
  .object({
    // Identity
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    category: z.string().min(1),
    description: z.string(),

    // Data Structure Config
    scaleType: ScaleTypeSchema,
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(z.string()).optional(),

    // AI Control Config
    responsibleAgentId: z.string().min(1),
    updatePolicy: UpdatePolicySchema.optional(),
    detectionHints: DetectionHintsSchema.optional(),

    // Display Config
    semanticDirection: SemanticDirectionSchema.optional(),

    // Runtime State
    currentValue: StateParameterValueSchema,
    history: z.array(StateHistoryEntrySchema).optional().default([]),
  })
  .refine(
    (data) => {
      // Validate min <= max when both are provided
      if (data.min !== undefined && data.max !== undefined) {
        return data.min <= data.max;
      }
      return true;
    },
    {
      message: "min must be less than or equal to max",
      path: ["min"],
    }
  )
  .refine(
    (data) => {
      // For NUMERIC scale type, validate currentValue is within range if min/max are set
      if (data.scaleType === "NUMERIC" && typeof data.currentValue === "number") {
        if (data.min !== undefined && data.currentValue < data.min) {
          return false;
        }
        if (data.max !== undefined && data.currentValue > data.max) {
          return false;
        }
      }
      return true;
    },
    {
      message: "currentValue must be within min/max range for NUMERIC scale type",
      path: ["currentValue"],
    }
  )
  .refine(
    (data) => {
      // CATEGORICAL scale type must have at least one option
      if (data.scaleType === "CATEGORICAL") {
        return data.options && data.options.length > 0;
      }
      return true;
    },
    {
      message: "CATEGORICAL parameters must have options array with at least one value",
      path: ["options"],
    }
  )
  .refine(
    (data) => {
      // For CATEGORICAL scale type, currentValue must be one of the options
      if (data.scaleType === "CATEGORICAL") {
        if (data.currentValue && typeof data.currentValue === "string") {
          return data.options && data.options.includes(data.currentValue);
        }
      }
      return true;
    },
    {
      message: "CATEGORICAL parameters must have currentValue matching one of the options",
      path: ["currentValue"],
    }
  );
export type CreateStateParameter = z.infer<typeof CreateStateParameterSchema>;

// =============================================================================
// SYSTEM AGENT
// =============================================================================

/**
 * SystemAgent - represents a "System" in ECS terms
 * An agent responsible for monitoring specific components
 *
 * Prompt can be provided inline via `systemPrompt` or referenced
 * from the prompt repository via `promptRef`. The `promptSource` field
 * determines which mode is active.
 */
export const SystemAgentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    role: z.string().min(1),
    /** Prompt mode: inline text or repository reference */
    promptSource: PromptSourceSchema.optional().default("inline"),
    /** Inline system prompt (required when promptSource="inline") */
    systemPrompt: z.string().optional(),
    /** Reference to prompt repository (required when promptSource="repository") */
    promptRef: SystemPromptRefSchema.optional(),
    /** Variable mappings for repository prompts (promptVar -> sourcePath) */
    promptVariables: z.record(z.string(), z.string()).optional(),
    avatar: z.string().optional(),
    color: z.string().optional(),
    llmConfig: AgentLLMConfigSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.promptSource === "repository") {
        return !!data.promptRef;
      }
      return !!data.systemPrompt && data.systemPrompt.length > 0;
    },
    { message: "Either systemPrompt (inline) or promptRef (repository) is required" }
  );
export type SystemAgent = z.infer<typeof SystemAgentSchema>;

// =============================================================================
// MAIN AGENT
// =============================================================================

/**
 * MainAgent - the primary interface agent (the "Face" of the system)
 *
 * Prompt can be provided inline via `systemPrompt` or referenced
 * from the prompt repository via `promptRef`. The `promptSource` field
 * determines which mode is active.
 */
export const MainAgentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    role: z.string().min(1),
    avatar: z.string().optional(),
    color: z.string().optional(),
    /** Prompt mode: inline text or repository reference */
    promptSource: PromptSourceSchema.optional().default("inline"),
    /** Inline system prompt (required when promptSource="inline") */
    systemPrompt: z.string().optional(),
    /** Reference to prompt repository (required when promptSource="repository") */
    promptRef: SystemPromptRefSchema.optional(),
    /** Variable mappings for repository prompts (promptVar -> sourcePath) */
    promptVariables: z.record(z.string(), z.string()).optional(),
    llmConfig: AgentLLMConfigSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.promptSource === "repository") {
        return !!data.promptRef;
      }
      return !!data.systemPrompt && data.systemPrompt.length > 0;
    },
    { message: "Either systemPrompt (inline) or promptRef (repository) is required" }
  );
export type MainAgent = z.infer<typeof MainAgentSchema>;

// =============================================================================
// AGENT INSIGHT
// =============================================================================

/**
 * AgentInsight - represents a single turn of analysis from a Sub-Agent
 */
export const AgentInsightSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  agentAvatar: z.string().optional(),
  agentColor: z.string().optional(),
  messageId: z.string().min(1),
  timestamp: z.number().int().positive(),
  analysis: z.array(z.string()),
  updatesMade: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
  ),
});
export type AgentInsight = z.infer<typeof AgentInsightSchema>;

// =============================================================================
// ANALYSIS MODE
// =============================================================================

/**
 * Analysis mode determines when mindstate analysis is triggered
 * - automatic: Analyze on every user message
 * - selective: Analyze based on node type rules
 * - node-triggered: Only analyze when explicitly triggered by a journey node
 * - manual: API-only, no automatic analysis
 */
export const AnalysisModeValues = ["automatic", "selective", "node-triggered", "manual"] as const;
export const AnalysisModeSchema = z.enum(AnalysisModeValues);
export type AnalysisMode = z.infer<typeof AnalysisModeSchema>;

// =============================================================================
// ANALYSIS START CONDITIONS
// =============================================================================

/**
 * Immediate start - begin analysis from the first message
 */
export const ImmediateStartConditionSchema = z.object({
  type: z.literal("immediate"),
});

/**
 * Start after N messages - warm-up period before analysis begins
 */
export const AfterMessagesStartConditionSchema = z.object({
  type: z.literal("after_messages"),
  count: z.number().int().min(1).max(100),
});

/**
 * Start after reaching a specific node - analysis begins when user reaches the node (inclusive)
 */
export const AfterNodeStartConditionSchema = z.object({
  type: z.literal("after_node"),
  nodeId: z.string().min(1),
});

/**
 * Analysis start condition - determines when analysis should begin
 */
export const AnalysisStartConditionSchema = z.discriminatedUnion("type", [
  ImmediateStartConditionSchema,
  AfterMessagesStartConditionSchema,
  AfterNodeStartConditionSchema,
]);
export type AnalysisStartCondition = z.infer<typeof AnalysisStartConditionSchema>;

// =============================================================================
// NODE TYPE RULES (for selective mode)
// =============================================================================

/**
 * Node types that can be used in analysis rules
 * Note: These are UPPERCASE versions of NodeTypeValues from nodes/index.ts.
 * The engine normalizes node types to uppercase before comparison.
 */
export const AnalyzableNodeTypeValues = ["START", "MESSAGE", "CONDITION", "WAIT", "WEBHOOK", "CRM", "TELEPORT", "END", "QUESTIONNAIRE", "AGENT"] as const;
export const AnalyzableNodeTypeSchema = z.enum(AnalyzableNodeTypeValues);
export type AnalyzableNodeType = z.infer<typeof AnalyzableNodeTypeSchema>;

/**
 * Node type rules for selective analysis mode
 * - analyzeTypes: Node types that trigger analysis (whitelist)
 * - skipTypes: Node types that skip analysis (takes precedence over analyzeTypes)
 */
export const NodeTypeRulesSchema = z.object({
  analyzeTypes: z.array(AnalyzableNodeTypeSchema).default(["MESSAGE", "CONDITION"]),
  skipTypes: z.array(AnalyzableNodeTypeSchema).default(["WAIT", "WEBHOOK", "CRM", "TELEPORT"]),
});
export type NodeTypeRules = z.infer<typeof NodeTypeRulesSchema>;

// =============================================================================
// MINDSTATE DEFINITION (Organization Template)
// =============================================================================

/**
 * MindstateDefinition - Organization-level template
 * Defines the structure and agents for a type of mindstate
 */
export const MindstateDefinitionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Key must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  mainAgentConfig: MainAgentSchema,
  defaultAgents: z.array(SystemAgentSchema),
  defaultParameters: z.array(StateParameterSchema),
  analysisMode: AnalysisModeSchema.default("automatic"),
  categories: z.array(z.string()).default([]),
  status: MindstateStatusSchema.default("draft"),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type MindstateDefinition = z.infer<typeof MindstateDefinitionSchema>;

// =============================================================================
// CLIENT MINDSTATE (Runtime Instance)
// =============================================================================

/**
 * ClientMindstate - Runtime instance per client
 * Stores the actual state values for each user
 */
export const ClientMindstateSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string(),
  definitionId: z.string().uuid(),
  stateParameters: z.array(StateParameterSchema),
  systemAgents: z.array(SystemAgentSchema),
  agentInsights: z.array(AgentInsightSchema).default([]),
  lastAnalyzedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type ClientMindstate = z.infer<typeof ClientMindstateSchema>;

// =============================================================================
// PIPELINE TYPES
// =============================================================================

// TokenUsage imported from canonical source (llm/token-usage.ts)
// NOTE: Exported via ./llm in main index.ts - no re-export here to avoid duplicates
import { TokenUsageSchema } from "./llm/token-usage";

/**
 * Pipeline metrics for analysis runs
 */
export const PipelineMetricsSchema = z.object({
  durationMs: z.number(),
  agentCount: z.number(),
  parameterCount: z.number(),
  changesCount: z.number(),
  tokenUsage: TokenUsageSchema.optional(),
  llmCallCount: z.number().optional(),
  perAgentUsage: z.array(z.object({
    agentId: z.string(),
    agentName: z.string(),
    tokenUsage: TokenUsageSchema,
  })).optional(),
});
export type PipelineMetrics = z.infer<typeof PipelineMetricsSchema>;

/**
 * Agent dispatch failure record
 * Records when an agent fails during pipeline execution
 */
export const AgentDispatchFailureSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  error: z.string(),
  affectedParams: z.array(z.string()).optional(),
});
export type AgentDispatchFailure = z.infer<typeof AgentDispatchFailureSchema>;

/**
 * State change record for auditing
 */
export const StateChangeSchema = z.object({
  parameterId: z.string(),
  parameterName: z.string(),
  previousValue: StateParameterValueSchema,
  newValue: StateParameterValueSchema,
  reasoning: z.string(),
  agentId: z.string(),
});
export type StateChange = z.infer<typeof StateChangeSchema>;

// =============================================================================
// ANALYSIS LOG TRIGGER
// =============================================================================

/**
 * Trigger types for analysis log
 */
export const AnalysisTriggerValues = ["message", "node", "api"] as const;
export const AnalysisTriggerSchema = z.enum(AnalysisTriggerValues);
export type AnalysisTrigger = z.infer<typeof AnalysisTriggerSchema>;

// =============================================================================
// API REQUEST/RESPONSE SCHEMAS
// =============================================================================

/**
 * Create mindstate definition request
 */
export const CreateMindstateDefinitionSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Key must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  analysisMode: AnalysisModeSchema.default("automatic"),
  mainAgentConfig: MainAgentSchema.optional(),
  defaultAgents: z.array(SystemAgentSchema).optional(),
  defaultParameters: z.array(CreateStateParameterSchema).optional(),
  categories: z.array(z.string()).optional(),
});
export type CreateMindstateDefinition = z.infer<typeof CreateMindstateDefinitionSchema>;

/**
 * Update mindstate definition request
 * Includes status field for status changes
 */
export const UpdateMindstateDefinitionSchema = CreateMindstateDefinitionSchema.partial().extend({
  status: MindstateStatusSchema.optional(),
});
export type UpdateMindstateDefinition = z.infer<typeof UpdateMindstateDefinitionSchema>;

/**
 * Manual parameter update request
 */
export const ManualParameterUpdateSchema = z.object({
  parameterName: z.string(),
  value: StateParameterValueSchema,
  reasoning: z.string().optional(),
});
export type ManualParameterUpdate = z.infer<typeof ManualParameterUpdateSchema>;

/**
 * Batch query for cross-mindstate conditions
 */
export const MindstateQuerySchema = z.object({
  mindstateKey: z.string(),
  parameterName: z.string(),
});
export type MindstateQuery = z.infer<typeof MindstateQuerySchema>;

export const BatchMindstateQuerySchema = z.object({
  queries: z.array(MindstateQuerySchema),
});
export type BatchMindstateQuery = z.infer<typeof BatchMindstateQuerySchema>;

/**
 * Preview analysis request (for Builder testing)
 */
export const PreviewAnalyzeRequestSchema = z.object({
  message: z.string().min(1, "Message is required"),
  currentState: z.array(StateParameterSchema),
  systemAgents: z.array(SystemAgentSchema),
  mainAgent: MainAgentSchema,
  messageHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});
export type PreviewAnalyzeRequest = z.infer<typeof PreviewAnalyzeRequestSchema>;

/**
 * Manual analysis request (for clients)
 */
export const AnalyzeMessageRequestSchema = z.object({
  message: z.string().min(1, "Message is required"),
  sessionId: z.string().uuid().optional(),
});
export type AnalyzeMessageRequest = z.infer<typeof AnalyzeMessageRequestSchema>;

// =============================================================================
// CONDITION SCHEMAS (for journey conditions)
// =============================================================================

/**
 * Operators for mindstate conditions
 */
export const MindstateConditionOperatorValues = [
  "equals",
  "notEquals",
  "greaterThan",
  "lessThan",
  "greaterThanOrEqual",
  "lessThanOrEqual",
  "contains",
] as const;
export const MindstateConditionOperatorSchema = z.enum(MindstateConditionOperatorValues);
export type MindstateConditionOperator = z.infer<typeof MindstateConditionOperatorSchema>;

/**
 * Single mindstate condition for journey evaluation
 */
export const MindstateConditionSchema = z.object({
  mindstateKey: z.string(),
  parameterName: z.string(),
  operator: MindstateConditionOperatorSchema,
  value: StateParameterValueSchema,
});
export type MindstateCondition = z.infer<typeof MindstateConditionSchema>;

// =============================================================================
// JOURNEY MINDSTATE CONFIG
// =============================================================================

/**
 * Default start condition for new configurations
 */
export const DEFAULT_START_CONDITION: AnalysisStartCondition = { type: "immediate" };

/**
 * Default node type rules for selective mode
 */
export const DEFAULT_NODE_TYPE_RULES: NodeTypeRules = {
  analyzeTypes: ["MESSAGE", "CONDITION"],
  skipTypes: ["WAIT", "WEBHOOK", "CRM", "TELEPORT"],
};

/**
 * Mindstate configuration for journeys
 *
 * @property keys - Array of mindstate definition keys to use
 * @property analysisMode - When to trigger analysis:
 *   - automatic: Every user message
 *   - selective: Based on node type rules
 *   - node-triggered: Only explicit triggers
 *   - manual: API-only
 * @property startCondition - When to start analyzing:
 *   - immediate: From first message
 *   - after_messages: After N messages
 *   - after_node: After reaching specific node (inclusive)
 * @property nodeTypeRules - Node type rules for selective mode
 */
export const JourneyMindstateConfigSchema = z.object({
  keys: z.array(z.string()).default([]),
  analysisMode: AnalysisModeSchema.default("automatic"),
  startCondition: AnalysisStartConditionSchema.optional(), // Defaults to "immediate" when undefined
  nodeTypeRules: NodeTypeRulesSchema.optional(),
});
export type JourneyMindstateConfig = z.infer<typeof JourneyMindstateConfigSchema>;

// =============================================================================
// MINDSTATE NODE DATA (for journey nodes)
// =============================================================================

/**
 * Actions available for mindstate nodes
 */
export const MindstateNodeActionValues = ["analyze", "get_state", "set_parameter"] as const;
export const MindstateNodeActionSchema = z.enum(MindstateNodeActionValues);
export type MindstateNodeAction = z.infer<typeof MindstateNodeActionSchema>;

/**
 * Mindstate node configuration (action-specific fields only)
 * Note: For full node data with base properties, use MindstateNodeData from nodes/mindstate.ts
 */
export const MindstateNodeConfigSchema = z.object({
  action: MindstateNodeActionSchema,
  mindstateKeys: z.array(z.string()).min(1),
  parameterUpdates: z
    .array(
      z.object({
        parameterName: z.string(),
        value: StateParameterValueSchema,
        reasoning: z.string().optional(),
      })
    )
    .optional(),
  outputKey: z.string().optional(),
});
export type MindstateNodeConfig = z.infer<typeof MindstateNodeConfigSchema>;

// =============================================================================
// EVENT PAYLOAD SCHEMAS
// =============================================================================

/**
 * Event payload for mindstate.analyzed
 */
export const MindstateAnalyzedEventSchema = z.object({
  clientId: z.string(),
  mindstateKey: z.string(),
  mindstateId: z.string().uuid(),
  trigger: AnalysisTriggerSchema,
  changesCount: z.number(),
  durationMs: z.number(),
  sessionId: z.string().uuid().optional(),
});
export type MindstateAnalyzedEvent = z.infer<typeof MindstateAnalyzedEventSchema>;

/**
 * Event payload for mindstate.parameter.changed
 */
export const MindstateParameterChangedEventSchema = z.object({
  clientId: z.string(),
  mindstateKey: z.string(),
  parameterName: z.string(),
  previousValue: StateParameterValueSchema,
  newValue: StateParameterValueSchema,
  reasoning: z.string(),
  agentId: z.string(),
});
export type MindstateParameterChangedEvent = z.infer<typeof MindstateParameterChangedEventSchema>;

/**
 * Event payload for mindstate.insight.generated
 */
export const MindstateInsightGeneratedEventSchema = z.object({
  clientId: z.string(),
  mindstateKey: z.string(),
  agentId: z.string(),
  agentName: z.string(),
  analysisCount: z.number(),
  updatesCount: z.number(),
});
export type MindstateInsightGeneratedEvent = z.infer<typeof MindstateInsightGeneratedEventSchema>;

// =============================================================================
// DEFAULT MINDSTATE CONFIGURATION
// =============================================================================

/**
 * Default main agent configuration for new mindstate definitions
 */
export const DEFAULT_MAIN_AGENT: MainAgent = {
  id: "main_agent",
  name: "Dr. Homa",
  role: "Primary Companion",
  avatar: "Bot",
  color: "indigo",
  promptSource: "inline",
  systemPrompt: `You are an adaptive AI companion designed to provide personalized support. Your role is to engage with users while being aware of their current state.

Based on the user's current state parameters:
- If cognitive load is high, simplify your language and break down complex topics
- If stress is elevated, be more supportive, calming, and reassuring
- If interest is low, be more engaging, use examples, and be concise
- If mood is low, show empathy and provide encouragement
- Mirror their energy level appropriately

Communication Guidelines:
- Maintain a professional yet warm tone
- Adapt your response length to match their engagement
- Ask clarifying questions when needed
- Acknowledge their feelings before problem-solving
- Provide actionable advice when appropriate`,
  llmConfig: {
    model: llmConfig.agent.model.id,
    temperature: 0.7,
    maxTokens: 2000,
  },
};

/**
 * Default system agents for mindstate analysis
 */
export const DEFAULT_SYSTEM_AGENTS: SystemAgent[] = [
  {
    id: "general_agent",
    name: "General Observer",
    role: "Baseline Analyzer",
    avatar: "Eye",
    color: "blue",
    promptSource: "inline",
    systemPrompt: `You are a general state observer. Analyze user messages for any notable patterns or state indicators that don't fit other specialized categories.

Focus on:
- Overall engagement level and communication style changes
- General sentiment shifts and tone variations
- Question frequency and depth of inquiry
- Response length patterns and verbosity
- Any unusual patterns or notable behavioral changes

Provide concise analysis with specific evidence from the message. Update relevant parameters when you detect clear signals.`,
    llmConfig: {
      model: llmConfig.agent.model.id,
      temperature: 0.3,
      maxTokens: 1000,
    },
  },
  {
    id: "emotional_agent",
    name: "Emotion Analyzer",
    role: "Emotional State Tracker",
    avatar: "Heart",
    color: "rose",
    promptSource: "inline",
    systemPrompt: `You are an emotional state analyzer. Monitor for emotional cues in user messages with sensitivity and accuracy.

Focus on:
- Mood indicators (happy, sad, frustrated, excited, anxious)
- Stress signals (rushed language, complaints, urgency, concern)
- Satisfaction levels (positive/negative feedback patterns)
- Emotional intensity and valence
- Defense mechanisms and coping language

Be sensitive but objective in your analysis. Look for both explicit statements and subtle linguistic cues.`,
    llmConfig: {
      model: llmConfig.agent.model.id,
      temperature: 0.3,
      maxTokens: 1000,
    },
  },
  {
    id: "cognitive_agent",
    name: "Cognitive Analyst",
    role: "Mental Load Tracker",
    avatar: "Boxes",
    color: "purple",
    promptSource: "inline",
    systemPrompt: `You are a cognitive state analyzer. Monitor for signs of mental load, focus, and comprehension.

Focus on:
- Cognitive load indicators (confusion, requests for simplification)
- Focus level (following threads, staying on topic vs. distraction)
- Comprehension signals (asking for clarification, misunderstandings)
- Mental fatigue signs (shorter responses, disengagement)
- Learning and retention patterns

Track how users process information and adjust assessments accordingly.`,
    llmConfig: {
      model: llmConfig.agent.model.id,
      temperature: 0.3,
      maxTokens: 1000,
    },
  },
  {
    id: "motivation_agent",
    name: "Motivation Tracker",
    role: "Intent Analyzer",
    avatar: "Target",
    color: "emerald",
    promptSource: "inline",
    systemPrompt: `You are a motivation and intent analyzer. Monitor for signs of user goals, urgency, and engagement.

Focus on:
- Interest level (curiosity, questions, engagement depth)
- Urgency signals (time pressure, deadline mentions, NOW/ASAP language)
- Goal clarity (specific objectives vs. vague exploration)
- Persistence (follow-up questions, staying on topic)
- Decision readiness (comparison seeking, final questions)

Track motivation patterns to help optimize the interaction flow.`,
    llmConfig: {
      model: llmConfig.agent.model.id,
      temperature: 0.4,
      maxTokens: 1000,
    },
  },
];

/**
 * Default state parameters for new mindstate definitions
 */
export const DEFAULT_STATE_PARAMETERS: StateParameter[] = [
  // Emotional parameters
  {
    id: "mood",
    name: "Mood",
    category: "Emotional",
    description: "Current emotional mood level from negative to positive",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 5,
    responsibleAgentId: "emotional_agent",
    semanticDirection: "high_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["great", "happy", "excited", "wonderful", "amazing", "love", "fantastic"],
      phrasesLower: ["sad", "frustrated", "upset", "angry", "disappointed", "terrible", "hate"],
      observations: ["Track emotional language, emoji usage, and overall tone"],
    },
  },
  {
    id: "stress",
    name: "Stress Level",
    category: "Mental",
    description: "Current stress or anxiety level",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 3,
    responsibleAgentId: "emotional_agent",
    semanticDirection: "low_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["worried", "anxious", "stressed", "overwhelmed", "urgent", "panic", "deadline"],
      phrasesLower: ["relaxed", "calm", "no rush", "at ease", "peaceful", "take my time"],
      observations: ["Watch for time pressure language, exclamation marks, all caps"],
    },
  },
  // Physical parameters
  {
    id: "energy",
    name: "Energy Level",
    category: "Physical",
    description: "Physical energy and vitality",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 6,
    responsibleAgentId: "general_agent",
    semanticDirection: "high_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["energetic", "ready", "pumped", "motivated", "rested"],
      phrasesLower: ["tired", "exhausted", "drained", "fatigued", "sleepy", "need coffee"],
      observations: ["Response speed, message length, engagement level"],
    },
  },
  // Cognitive parameters
  {
    id: "focus",
    name: "Focus Level",
    category: "Cognitive",
    description: "Ability to concentrate and stay on topic",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 7,
    responsibleAgentId: "cognitive_agent",
    semanticDirection: "high_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["let me focus", "specifically", "the key point", "exactly"],
      phrasesLower: ["distracted", "sorry what", "I forgot", "wait", "off topic"],
      observations: ["Thread coherence, response relevance, question specificity"],
    },
  },
  {
    id: "cognitive_load",
    name: "Cognitive Load",
    category: "Cognitive",
    description: "Mental processing burden",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 4,
    responsibleAgentId: "cognitive_agent",
    semanticDirection: "low_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["confusing", "too much", "overwhelmed", "complicated", "lost"],
      phrasesLower: ["makes sense", "got it", "clear", "simple", "understand"],
      observations: ["Requests for simplification, comprehension signals"],
    },
  },
  // Motivation parameters
  {
    id: "interest",
    name: "Interest Level",
    category: "Motivation",
    description: "Level of interest and engagement in the topic",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 6,
    responsibleAgentId: "motivation_agent",
    semanticDirection: "high_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["tell me more", "interesting", "curious", "fascinating", "how does"],
      phrasesLower: ["whatever", "don't care", "boring", "skip", "not relevant"],
      observations: ["Question frequency, follow-up engagement, exploration depth"],
    },
  },
  {
    id: "urgency",
    name: "Urgency",
    category: "Motivation",
    description: "Time pressure and need for quick resolution",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 3,
    responsibleAgentId: "motivation_agent",
    semanticDirection: "low_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["ASAP", "urgent", "NOW", "deadline", "immediately", "can't wait"],
      phrasesLower: ["whenever", "no rush", "take your time", "eventually"],
      observations: ["Caps usage, punctuation intensity, time references"],
    },
  },
  // Social parameters
  {
    id: "rapport",
    name: "Rapport",
    category: "Social",
    description: "Connection and trust level with the assistant",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 5,
    responsibleAgentId: "general_agent",
    semanticDirection: "high_is_good",
    history: [],
    detectionHints: {
      phrasesRaise: ["thank you", "helpful", "appreciate", "great job", "you understand"],
      phrasesLower: ["useless", "not helpful", "wrong", "you don't get it", "frustrated with you"],
      observations: ["Politeness markers, personal disclosures, feedback tone"],
    },
  },
  // Informational parameters
  {
    id: "topic_familiarity",
    name: "Topic Familiarity",
    category: "Informational",
    description: "User's existing knowledge of the current topic",
    scaleType: "CATEGORICAL",
    options: ["Novice", "Beginner", "Intermediate", "Advanced", "Expert"],
    currentValue: "Intermediate",
    responsibleAgentId: "cognitive_agent",
    history: [],
    detectionHints: {
      phrasesRaise: ["I know", "as you know", "obviously", "in my experience"],
      phrasesLower: ["what is", "explain", "I don't understand", "never heard of"],
      observations: ["Technical vocabulary usage, depth of questions"],
    },
  },
];

/**
 * Default categories for organizing state parameters
 */
export const DEFAULT_CATEGORIES = [
  "Emotional",
  "Mental",
  "Physical",
  "Motivation",
  "Cognitive",
  "Social",
  "Informational",
  "Trait",
  "Context",
  "Situational",
] as const;

/**
 * Complete default mindstate definition for new organizations
 */
export const DEFAULT_MINDSTATE_CONFIG: {
  key: string;
  name: string;
  description: string;
  mainAgentConfig: MainAgent;
  defaultAgents: SystemAgent[];
  defaultParameters: StateParameter[];
  categories: string[];
  analysisMode: "automatic";
  status: MindstateStatus;
} = {
  key: "default-companion",
  name: "Default Companion",
  description: "A comprehensive AI companion that tracks emotional, cognitive, and motivational states to provide personalized interactions.",
  mainAgentConfig: DEFAULT_MAIN_AGENT,
  defaultAgents: [...DEFAULT_SYSTEM_AGENTS],
  defaultParameters: [...DEFAULT_STATE_PARAMETERS],
  categories: [...DEFAULT_CATEGORIES],
  analysisMode: "automatic",
  status: "draft",
};

// =============================================================================
// VERSION TYPES - Re-export from version-types module
// =============================================================================

export type {
  MindstateVersionConfig,
  MindstateDefinitionVersion,
  VersionedMindstateData,
  AtomicSaveMindstateResult,
  SaveMindstateVersionInput,
  AtomicSaveMindstateInput,
} from "./mindstate/version-types";

export {
  SaveMindstateVersionInputSchema,
  AtomicSaveMindstateInputSchema,
} from "./mindstate/version-types";
