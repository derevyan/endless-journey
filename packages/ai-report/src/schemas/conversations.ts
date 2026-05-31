/**
 * AI Node Conversation History Schema
 *
 * Complete AI node conversation history for debugging.
 * Includes full LLM interaction data: prompts, parameters, responses.
 *
 * @module @journey/ai-report/schemas/conversations
 */

import { z } from "zod";

/**
 * Tool call within a conversation turn.
 */
export const ConversationToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  args: z.unknown(),
  result: z.unknown().optional(),
  durationMs: z.number().optional(),
  success: z.boolean().default(true),
  error: z.string().optional(),
});

export type ConversationToolCall = z.infer<typeof ConversationToolCallSchema>;

/**
 * LLM configuration parameters used for a call.
 */
export const LLMConfigSnapshotSchema = z.object({
  model: z.string(),
  provider: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  // For extended thinking models
  thinkingBudgetTokens: z.number().optional(),
});

export type LLMConfigSnapshot = z.infer<typeof LLMConfigSnapshotSchema>;

/**
 * Single message in conversation history (for full context).
 */
export const ConversationMessageRecordSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  timestamp: z.string().datetime().optional(),
  toolCallId: z.string().optional(),
  toolCalls: z.array(ConversationToolCallSchema).optional(),
  inputType: z.enum(["text", "voice"]).optional(), // For user messages
});

export type ConversationMessageRecord = z.infer<typeof ConversationMessageRecordSchema>;

/**
 * Complete LLM call details for a single turn.
 * Captures everything sent to and received from the LLM.
 */
export const LLMCallDetailSchema = z.object({
  // Request data
  systemPrompt: z.string().optional(),
  /** Truncated system prompt for large prompts (configurable) */
  systemPromptTruncated: z.boolean().optional(),
  /** Full conversation history sent to LLM */
  inputMessages: z.array(ConversationMessageRecordSchema).optional(),
  /** LLM configuration used */
  config: LLMConfigSnapshotSchema.optional(),

  // Response data
  outputContent: z.string(),
  outputToolCalls: z.array(ConversationToolCallSchema).optional(),
  finishReason: z.string().optional(), // "stop", "tool_calls", "length", etc.
  /** Structured response if applicable */
  structuredResponse: z.unknown().optional(),

  // Token usage
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  costUSD: z.number().optional(),

  // Performance
  durationMs: z.number(),
  iterations: z.number().optional(), // For agent loops

  // Errors
  errorMessage: z.string().optional(),
});

export type LLMCallDetail = z.infer<typeof LLMCallDetailSchema>;

/**
 * Single turn in an AI node conversation.
 * Includes full LLM interaction data for complete debugging.
 */
export const AIConversationTurnSchema = z.object({
  turnNumber: z.number(),
  timestamp: z.string().datetime(),

  // User input
  userMessage: z.string().optional(),
  userInputType: z.enum(["text", "voice", "button", "initial_prompt"]).optional(),
  /** Original voice audio URL if transcribed */
  voiceAudioUrl: z.string().optional(),

  // AI response
  assistantResponse: z.string(),
  responseBlocked: z.boolean().default(false),
  blockedReason: z.string().optional(),

  // Tool calls in this turn
  toolCalls: z.array(ConversationToolCallSchema).default([]),

  // === FULL LLM INTERACTION DATA ===
  /** Complete LLM call details for this turn */
  llmCall: LLMCallDetailSchema.optional(),

  // Legacy metrics (for backward compat, derived from llmCall)
  tokensUsed: z.number().optional(),
  costUSD: z.number().optional(),
  durationMs: z.number().optional(),
});

export type AIConversationTurn = z.infer<typeof AIConversationTurnSchema>;

/**
 * Conversation metrics summary.
 */
export const ConversationMetricsSchema = z.object({
  turnCount: z.number(),
  totalMessages: z.number(),
  totalTokens: z.number(),
  totalCostUSD: z.number(),
  averageTurnDurationMs: z.number().optional(),
});

export type ConversationMetrics = z.infer<typeof ConversationMetricsSchema>;

/**
 * Exit reason for AI conversation.
 */
export const ConversationExitReasonSchema = z.enum([
  "workflow_completed",
  "user_exit",
  "timeout",
  "blocked",
  "error",
  "still_active",
]);

export type ConversationExitReason = z.infer<typeof ConversationExitReasonSchema>;

/**
 * Complete AI node conversation history.
 * One entry per agent node execution in the session.
 */
export const AINodeConversationSchema = z.object({
  nodeId: z.string(),
  nodeLabel: z.string().optional(),
  workflowKey: z.string(),

  // Conversation metadata
  startedAt: z.string().datetime(),
  lastTurnAt: z.string().datetime().optional(),
  status: z.enum(["active", "completed", "blocked", "error"]),

  // All conversation turns
  turns: z.array(AIConversationTurnSchema),

  // Conversation totals
  metrics: ConversationMetricsSchema,

  // Exit information
  exitReason: ConversationExitReasonSchema.optional(),
  exitedToNodeId: z.string().optional(),
});

export type AINodeConversation = z.infer<typeof AINodeConversationSchema>;
