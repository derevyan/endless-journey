/**
 * Workflow Execution Detail Schema
 *
 * Detailed workflow/agent execution record.
 *
 * @module @journey/ai-report/schemas/workflows
 */

import { z } from "zod";

/**
 * Workflow step record.
 */
export const WorkflowStepSchema = z.object({
  stepId: z.string(),
  nodeId: z.string(),
  nodeType: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().optional(),
  status: z.enum(["completed", "error", "skipped"]),
  outHandle: z.string().optional(),
  error: z.string().optional(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/**
 * LLM configuration snapshot for a workflow call.
 */
export const WorkflowLLMConfigSchema = z.object({
  model: z.string(),
  provider: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  thinkingBudgetTokens: z.number().optional(),
});

export type WorkflowLLMConfig = z.infer<typeof WorkflowLLMConfigSchema>;

/**
 * LLM call within a workflow - FULL DETAILS for debugging.
 */
export const WorkflowLLMCallSchema = z.object({
  // Configuration
  config: WorkflowLLMConfigSchema,

  // Request data
  systemPrompt: z.string().optional(),
  systemPromptTruncated: z.boolean().optional(),
  /** Input messages sent (user + assistant history) */
  inputMessages: z.array(z.object({
    role: z.enum(["system", "user", "assistant", "tool"]),
    content: z.string(),
    toolCallId: z.string().optional(),
  })).optional(),

  // Response data
  response: z.string().optional(),
  outputToolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    args: z.unknown(),
  })).optional(),
  finishReason: z.string().optional(),
  structuredResponse: z.unknown().optional(),

  // Token usage
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  costUSD: z.number().optional(),

  // Performance
  durationMs: z.number(),
  iterations: z.number().optional(),

  // Errors
  errorMessage: z.string().optional(),
});

export type WorkflowLLMCall = z.infer<typeof WorkflowLLMCallSchema>;

/**
 * Tool call within a workflow.
 */
export const WorkflowToolCallSchema = z.object({
  toolName: z.string(),
  input: z.unknown(),
  output: z.unknown().optional(),
  durationMs: z.number(),
  success: z.boolean(),
  error: z.string().optional(),
});

export type WorkflowToolCall = z.infer<typeof WorkflowToolCallSchema>;

/**
 * Detailed workflow/agent execution record.
 */
export const WorkflowExecutionDetailSchema = z.object({
  workflowRunId: z.string(),
  nodeId: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  status: z.enum(["running", "completed", "error", "paused"]),

  // Steps executed (internal workflow nodes)
  steps: z.array(WorkflowStepSchema),

  // LLM calls within this workflow execution
  llmCalls: z.array(WorkflowLLMCallSchema),

  // Tool executions within this workflow execution
  toolCalls: z.array(WorkflowToolCallSchema),

  // Final output
  finalResponse: z.string().optional(),
  outputVariables: z.record(z.string(), z.unknown()).optional(),

  // Totals
  totalDurationMs: z.number().optional(),
  totalTokens: z.number().optional(),
  totalCostUSD: z.number().optional(),
});

export type WorkflowExecutionDetail = z.infer<typeof WorkflowExecutionDetailSchema>;
