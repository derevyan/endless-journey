/**
 * Prompt Schemas - Core Zod types for prompt management
 *
 * Defines schemas for prompt repository API requests and responses.
 *
 * @module schemas/prompts/types
 */

import { z } from "zod";

// =============================================================================
// PROMPT TYPE ENUM
// =============================================================================

export const PromptTypeSchema = z.enum(["text", "chat"]);
export type PromptType = z.infer<typeof PromptTypeSchema>;

// =============================================================================
// CHAT MESSAGE SCHEMA
// =============================================================================

export const PromptChatMessageSchema = z.object({
  id: z.string().uuid().optional(), // Optional for backward compat with existing data
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});
export type PromptChatMessage = z.infer<typeof PromptChatMessageSchema>;

// =============================================================================
// PROMPT CONTENT SCHEMA
// =============================================================================

/** Text content - simple string template */
export const TextPromptContentSchema = z.string().min(1, "Prompt content is required");

/** Chat content - array of role-based messages */
export const ChatPromptContentSchema = z.array(PromptChatMessageSchema).min(1, "At least one message is required");

/** Union based on prompt type */
export const PromptContentSchema = z.union([TextPromptContentSchema, ChatPromptContentSchema]);
export type PromptContent = z.infer<typeof PromptContentSchema>;


// =============================================================================
// PROMPT NAME VALIDATION
// =============================================================================

/** Kebab-case name pattern (e.g., "customer-support-agent") */
const promptNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Reusable schema for prompt name validation.
 * Use this in frontend forms to validate prompt names.
 */
export const promptNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be 100 characters or less")
  .regex(promptNamePattern, "Name must be lowercase alphanumeric with hyphens (e.g., 'my-prompt')");

// =============================================================================
// DEFAULT PROMPT CONTENT
// =============================================================================

/**
 * Default content templates for new prompts.
 * Provides a starting point with example variable syntax.
 */
export const DEFAULT_PROMPT_CONTENT = {
  text: `You are a helpful assistant.

User query: {{query}}`,
  chat: [
    { role: "system" as const, content: "You are a helpful assistant." },
    { role: "user" as const, content: "{{query}}" },
  ],
} as const;

// =============================================================================
// API INPUT SCHEMAS
// =============================================================================

export const CreatePromptInputSchema = z.object({
  name: promptNameSchema,
  description: z.string().max(500).optional(),
  type: PromptTypeSchema,
  content: PromptContentSchema,
  tags: z.array(z.string()).optional(),
  isSystem: z.boolean().optional(),
});
export type CreatePromptInput = z.infer<typeof CreatePromptInputSchema>;

export const UpdatePromptInputSchema = z.object({
  description: z.string().max(500).nullable().optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdatePromptInput = z.infer<typeof UpdatePromptInputSchema>;

export const CreateVersionInputSchema = z.object({
  content: PromptContentSchema,
  labels: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
});
export type CreateVersionInput = z.infer<typeof CreateVersionInputSchema>;

export const UpdateLabelsInputSchema = z.object({
  labels: z.array(z.string()),
});
export type UpdateLabelsInput = z.infer<typeof UpdateLabelsInputSchema>;

export const CompilePromptInputSchema = z.object({
  variables: z.record(z.string(), z.unknown()),
  label: z.string().optional(),
  versionId: z.string().optional(),
});
export type CompilePromptInput = z.infer<typeof CompilePromptInputSchema>;

export const TestPromptInputSchema = z.object({
  variables: z.record(z.string(), z.unknown()),
  label: z.string().optional(),
  versionId: z.string().optional(),
  testInput: z.string().optional(), // User message for chat prompts
});
export type TestPromptInput = z.infer<typeof TestPromptInputSchema>;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

export const PromptVersionResponseSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string(),
  content: PromptContentSchema,
  labels: z.array(z.string()),
  notes: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type PromptVersionResponse = z.infer<typeof PromptVersionResponseSchema>;

export const PromptResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  type: PromptTypeSchema,
  tags: z.array(z.string()),
  isSystem: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // Include latest/production version info (optional - for list views)
  productionVersion: PromptVersionResponseSchema.nullable().optional(),
  latestVersion: PromptVersionResponseSchema.nullable().optional(),
});
export type PromptResponse = z.infer<typeof PromptResponseSchema>;

export const PromptListResponseSchema = z.object({
  prompts: z.array(PromptResponseSchema),
  total: z.number().int().nonnegative(),
});
export type PromptListResponse = z.infer<typeof PromptListResponseSchema>;

// =============================================================================
// COMPILED PROMPT SCHEMA
// =============================================================================

export const CompiledPromptSchema = z.object({
  name: z.string(),
  type: PromptTypeSchema,
  versionId: z.string(),
  /** Label used to fetch (undefined if fetched by versionId directly) */
  label: z.string().optional(),
  content: PromptContentSchema,
});
export type CompiledPrompt = z.infer<typeof CompiledPromptSchema>;

// =============================================================================
// PROMPT REF SCHEMA (for Agent node integration)
// =============================================================================

/**
 * Reference to a prompt in the repository
 * Used by agent nodes to reference prompts instead of inline text
 */
export const PromptRefSchema = z.object({
  name: z.string(),
  label: z.string().default("production"),
});
export type PromptRef = z.infer<typeof PromptRefSchema>;

// =============================================================================
// QUERY FILTER SCHEMAS
// =============================================================================

export const PromptFiltersSchema = z.object({
  search: z.string().optional(),
  type: PromptTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  isSystem: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type PromptFilters = z.infer<typeof PromptFiltersSchema>;
