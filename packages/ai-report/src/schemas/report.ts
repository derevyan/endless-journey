/**
 * Main AI Execution Report Schema
 *
 * The comprehensive report structure optimized for AI consumption.
 *
 * @module @journey/ai-report/schemas/report
 */

import { z } from "zod";
import { JourneyLogEntrySchema } from "./journal-log";
import { TransitionDetailSchema } from "./transitions";
import { MessageDetailSchema, ErrorDetailSchema } from "./messages";
import { WorkflowExecutionDetailSchema } from "./workflows";
import { AINodeConversationSchema } from "./conversations";
import { VariableChangeDetailSchema } from "./variables";
import { DetectedIssueSchema } from "./issues";
import { ButtonClickDetailSchema, UnprocessedEventSchema } from "./button-tracking";
import { CRMActionDetailSchema } from "./crm";
import { HITLDecisionDetailSchema } from "./hitl";

// =============================================================================
// JOURNEY GRAPH
// =============================================================================

/**
 * Node in the journey graph.
 */
export const JourneyGraphNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string().optional(),
  data: z.unknown(), // Node-specific configuration
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

export type JourneyGraphNode = z.infer<typeof JourneyGraphNodeSchema>;

/**
 * Edge in the journey graph.
 */
export const JourneyGraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  label: z.string().optional(),
  data: z.unknown().optional(), // Edge-specific data (delays, guards)
});

export type JourneyGraphEdge = z.infer<typeof JourneyGraphEdgeSchema>;

/**
 * Journey graph definition.
 */
export const JourneyGraphSchema = z.object({
  nodes: z.array(JourneyGraphNodeSchema),
  edges: z.array(JourneyGraphEdgeSchema),
  nodeTypeCounts: z.record(z.string(), z.number()), // { "message": 5, "agent": 2 }
});

export type JourneyGraph = z.infer<typeof JourneyGraphSchema>;

// =============================================================================
// SUMMARY
// =============================================================================

/**
 * Executive summary for quick AI scan.
 */
export const ReportSummarySchema = z.object({
  // Path visualization
  pathDescription: z.string(), // "Start → Welcome → Agent → End"
  nodesVisited: z.number(),
  uniqueNodes: z.number(),

  // Interaction counts
  totalMessages: z.number(),
  userMessages: z.number(),
  botMessages: z.number(),
  buttonClicks: z.number(),
  timeoutsTriggered: z.number(),

  // Quality indicators
  errorsCount: z.number(),
  warningsCount: z.number(),

  // Performance
  totalDurationMs: z.number(),
  avgResponseTimeMs: z.number().optional(),

  // LLM usage (if any agent nodes)
  totalTokensUsed: z.number().optional(),
  totalLlmCostUSD: z.number().optional(),
  llmCallCount: z.number().optional(),
});

export type ReportSummary = z.infer<typeof ReportSummarySchema>;

// =============================================================================
// PERFORMANCE ANALYSIS
// =============================================================================

/**
 * Slow node record.
 */
export const SlowNodeSchema = z.object({
  nodeId: z.string(),
  nodeLabel: z.string().optional(),
  avgDurationMs: z.number(),
  executionCount: z.number(),
});

export type SlowNode = z.infer<typeof SlowNodeSchema>;

/**
 * Performance analysis section.
 */
export const PerformanceAnalysisSchema = z.object({
  slowestNodes: z.array(SlowNodeSchema),
  bottlenecks: z.array(z.string()), // AI-readable descriptions
});

export type PerformanceAnalysis = z.infer<typeof PerformanceAnalysisSchema>;

// =============================================================================
// MAIN REPORT
// =============================================================================

/**
 * Main AI Execution Report Schema.
 */
export const AIExecutionReportSchema = z.object({
  // === METADATA ===
  reportVersion: z.literal("1.0"),
  generatedAt: z.string().datetime(),
  reportType: z.enum(["in_progress", "completed"]),

  // === SESSION CONTEXT ===
  session: z.object({
    id: z.string().uuid(),
    status: z.enum(["active", "completed", "dropped", "paused", "error"]),
    mode: z.enum(["live", "test", "simulation"]).optional(),
    currentNodeId: z.string(),
    startedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    totalDurationMs: z.number(),
  }),

  journey: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string().optional(),
  }),

  // === JOURNEY DEFINITION (for full context) ===
  journeyGraph: JourneyGraphSchema.optional(),

  user: z.object({
    id: z.string(),
    platformUserId: z.string().optional(),
    displayName: z.string(),
    tags: z.array(z.string()),
  }),

  // === EXECUTIVE SUMMARY (for quick AI scan) ===
  summary: ReportSummarySchema,

  // === FULL JOURNEY LOG (chronological) ===
  journeyLog: z.array(JourneyLogEntrySchema),

  // === DETAILED SECTIONS ===

  // All transitions with reasons
  transitions: z.array(TransitionDetailSchema),

  // Complete conversation
  messages: z.array(MessageDetailSchema),

  // All errors (with full context)
  errors: z.array(ErrorDetailSchema),

  // Agent/workflow executions (detailed)
  workflowExecutions: z.array(WorkflowExecutionDetailSchema),

  // === AI NODE CONVERSATION HISTORY ===
  aiConversations: z.array(AINodeConversationSchema),

  // === CRM & INTEGRATIONS ===
  // CRM actions (pipeline moves, deal updates, etc.)
  crmActions: z.array(CRMActionDetailSchema).optional(),

  // === HUMAN-IN-THE-LOOP ===
  // HITL decisions (approvals, rejections, edits)
  hitlDecisions: z.array(HITLDecisionDetailSchema).optional(),

  // Variable evolution
  variableChanges: z.array(VariableChangeDetailSchema),

  // Current state
  currentVariables: z.record(z.string(), z.unknown()),
  currentTags: z.array(z.string()),

  // Node outputs (keyed by nodeId for uniqueness)
  nodeOutputs: z.record(z.string(), z.object({
    label: z.string().optional(),
    data: z.unknown(),
  })),

  // === DEBUGGING SECTIONS ===

  // All button clicks with outcomes
  buttonClicks: z.array(ButtonClickDetailSchema),

  // Events that didn't trigger expected actions
  unprocessedEvents: z.array(UnprocessedEventSchema),

  // === AI ANALYSIS ===
  issues: z.array(DetectedIssueSchema),

  // Performance hotspots
  performanceAnalysis: PerformanceAnalysisSchema.optional(),
});

export type AIExecutionReport = z.infer<typeof AIExecutionReportSchema>;

// =============================================================================
// REPORT OPTIONS
// =============================================================================

/**
 * Options for building execution reports.
 */
export const ReportOptionsSchema = z.object({
  // Include sections (all default true)
  includeGraph: z.boolean().optional(),
  includeMessages: z.boolean().optional(),
  includeWorkflows: z.boolean().optional(),
  /** Include full LLM call details (prompts, params, responses). Default: true */
  includeLLMDetails: z.boolean().optional(),

  // LLM data options
  /**
   * Max characters for system prompts. If exceeded, truncates and sets systemPromptTruncated=true.
   * Set to 0 to exclude system prompts entirely.
   * Default: unlimited (include full prompt)
   */
  systemPromptMaxChars: z.number().optional(),
  /**
   * Max characters for conversation history per turn.
   * Default: unlimited
   */
  conversationHistoryMaxChars: z.number().optional(),
  /** Include full input messages sent to LLM. Default: true */
  includeInputMessages: z.boolean().optional(),

  // Filtering for large sessions
  fromTimestamp: z.string().datetime().optional(),
  toTimestamp: z.string().datetime().optional(),
  eventTypes: z.array(z.string()).optional(),
  maxEvents: z.number().optional(),

  // Pagination for very large sessions
  offset: z.number().optional(),
  limit: z.number().optional(),
});

export type ReportOptions = z.infer<typeof ReportOptionsSchema>;
