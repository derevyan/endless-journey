/**
 * Workflow Form Schemas
 *
 * Zod schemas for workflow node form validation.
 *
 * @module features/nodes/workflow/forms/workflow-form-schemas
 */

import { z } from "zod";
import type { WorkflowNodeType } from "@journey/schemas";

// =============================================================================
// FORM SCHEMAS
// =============================================================================

/**
 * Form schema for End node (simplified - just optional template).
 */
export const endNodeFormSchema = z.object({
  name: z.string().max(100).optional(),
  outputTemplate: z.string().max(5000).optional(),
});

export type EndNodeFormValues = z.infer<typeof endNodeFormSchema>;

/**
 * Form schema for Question Understanding node.
 */
export const questionUnderstandingNodeFormSchema = z.object({
  name: z.string().max(100).optional(),
  outputVariable: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/).default("synthesized_question"),
  includeReasoning: z.boolean().default(false),
});

export type QuestionUnderstandingNodeFormValues = z.infer<typeof questionUnderstandingNodeFormSchema>;

/**
 * Form schema for Guard node.
 */
export const guardNodeFormSchema = z.object({
  name: z.string().max(100).optional(),
  workers: z.array(z.enum(["safety_guard", "injection_guard", "policy_guard", "spam_guard"]))
    .min(1, "Select at least one guard"),
  blockedMessage: z.string().max(1000).default("I can't help with that request."),
  terminateOnBlock: z.boolean().default(true),
});

export type GuardNodeFormValues = z.infer<typeof guardNodeFormSchema>;

/**
 * Form schema for MCP node.
 */
export const mcpNodeFormSchema = z.object({
  name: z.string().max(100).optional(),
  server: z.string().min(1, "Server is required").max(100),
  tool: z.string().min(1, "Tool is required").max(100),
  params: z.record(z.string(), z.string()).default({}),
  timeout: z.number().int().min(1000).max(60000).default(30000),
  onError: z.enum(["fail", "continue", "retry"]).default("fail"),
  maxRetries: z.number().int().min(0).max(3).default(1),
});

export type MCPNodeFormValues = z.infer<typeof mcpNodeFormSchema>;

/**
 * Form schema for User Approval node.
 */
export const userApprovalNodeFormSchema = z.object({
  name: z.string().max(100).optional(),
  message: z.string().min(1, "Message is required").max(1000),
  timeoutSeconds: z.number().int().min(30).max(86400).optional(),
  timeoutAction: z.enum(["approve", "reject", "skip"]).default("skip"),
  allowedRoles: z.array(z.string()).optional(),
});

export type UserApprovalNodeFormValues = z.infer<typeof userApprovalNodeFormSchema>;

/**
 * Form schema for Set State node.
 */
export const setStateNodeFormSchema = z.object({
  name: z.string().max(100).optional(),
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Key must start with a letter").min(1).max(100),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  isTemplate: z.boolean().default(false),
});

export type SetStateNodeFormValues = z.infer<typeof setStateNodeFormSchema>;

/**
 * Form schema for Transform node.
 */
export const transformNodeFormSchema = z.object({
  name: z.string().max(100).optional(),
  operationType: z.enum(["extractJson", "pick", "template", "merge"]),
  // Fields based on operation type
  sourceVariable: z.string().optional(),
  fields: z.array(z.string()).optional(),
  template: z.string().max(10000).optional(),
  sources: z.array(z.string()).optional(),
  outputVariable: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/).min(1),
});

export type TransformNodeFormValues = z.infer<typeof transformNodeFormSchema>;

/**
 * Form schema for If/Else node.
 */
export const ifElseNodeFormSchema = z.object({
  name: z.string().max(100).optional(),
  conditionType: z.enum(["expression", "intent"]),
  // Expression fields
  left: z.string().optional(),
  operator: z.enum([
    "===", "!==", ">", "<", ">=", "<=",
    "contains", "startsWith", "endsWith",
    "isEmpty", "isNotEmpty", "matches",
  ]).optional(),
  right: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  // Intent fields
  intents: z.array(z.string()).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
});

export type IfElseNodeFormValues = z.infer<typeof ifElseNodeFormSchema>;

/**
 * Form schema for Context node source.
 */
const contextSourceFormSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("memory"),
    maxResults: z.number().int().min(1).max(50).default(10),
    autoInject: z.boolean().default(true),
    recencyBias: z.number().min(0).max(1).default(0.3),
  }),
  z.object({
    type: z.literal("knowledge_base"),
    kbId: z.string().min(1),
    maxResults: z.number().int().min(1).max(20).default(5),
    similarity: z.number().min(0).max(1).default(0.7),
  }),
  z.object({
    type: z.literal("rag"),
    indexId: z.string().min(1),
    maxResults: z.number().int().min(1).max(50).default(5),
    similarity: z.number().min(0).max(1).default(0.7),
  }),
]);

/**
 * Form schema for Context node.
 */
export const contextNodeFormSchema = z.object({
  name: z.string().max(100).optional(),
  sources: z.array(contextSourceFormSchema).min(1, "At least one source is required"),
  outputVariable: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/).optional(),
});

export type ContextNodeFormValues = z.infer<typeof contextNodeFormSchema>;

/**
 * Form schema for Agent node (simplified for form - complex nested structure).
 */
export const agentNodeFormSchema = z.object({
  name: z.string().max(100).optional(),
  // Prompt source: inline text or from repository
  promptSource: z.enum(["inline", "repository"]).default("inline"),
  // Inline system prompt (required when promptSource is "inline")
  systemPrompt: z.string().max(10000).optional(),
  // Prompt repository reference (used when promptSource is "repository")
  promptRefName: z.string().max(100).optional(),
  /** Pin to specific version ID (e.g., "v1"). Takes precedence over label. */
  promptRefVersionId: z.string().max(50).optional(),
  /** Fallback label for dynamic resolution (e.g., "production"). */
  promptRefLabel: z.string().max(50).default("production"),
  // Prompt variable mappings (used with repository prompts)
  // Maps prompt variables to context paths: { "input": "userResponse.value" }
  promptVariables: z.record(z.string(), z.string()).optional(),
  // LLM settings
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  // Tools
  enabledTools: z.array(z.string()).optional(),
  // Tool timing overrides (tool ID → "immediate" | "deferred")
  toolTimingOverrides: z.record(z.string(), z.enum(["immediate", "deferred"])).optional(),
  // History
  historyStrategy: z.enum(["none", "simple", "summarize", "sliding_window"]).optional(),
  historyMaxMessages: z.number().int().min(1).max(100).optional(),
  // Memory
  memoryEnabled: z.boolean().optional(),
  memoryMaxResults: z.number().int().min(1).max(50).optional(),
  // Output
  responseFormatType: z.enum(["text", "json_schema"]).optional(),
  responseFormatName: z.string().optional(),
  responseFormatSchema: z.string().optional(),
  outputVariable: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/).optional(),
  messageSource: z.enum(["auto", "original"]).optional(),
  // Quick-reply buttons
  enableQuickReplies: z.boolean().optional(),
});

export type AgentNodeFormValues = z.infer<typeof agentNodeFormSchema>;

// =============================================================================
// FORM SCHEMA MAP
// =============================================================================

/**
 * Map of node types to their form-specific schemas.
 */
export const formSchemaMap: Partial<Record<WorkflowNodeType, z.ZodType>> = {
  end: endNodeFormSchema,
  question_understanding: questionUnderstandingNodeFormSchema,
  guard: guardNodeFormSchema,
  mcp: mcpNodeFormSchema,
  user_approval: userApprovalNodeFormSchema,
  set_state: setStateNodeFormSchema,
  transform: transformNodeFormSchema,
  if_else: ifElseNodeFormSchema,
  context: contextNodeFormSchema,
  agent: agentNodeFormSchema,
};

/**
 * Get the form-specific Zod schema for a workflow node type.
 */
export function getWorkflowFormSchema(nodeType: WorkflowNodeType): z.ZodType | undefined {
  return formSchemaMap[nodeType];
}
