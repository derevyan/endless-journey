import { z } from "zod";
import {
  WorkflowLLMConfigSchema,
  UnifiedToolsConfigSchema,
  ConversationHistoryConfigSchema,
  MemoryConfigSchema,
  SystemPromptRefSchema,
} from "./nodes/shared";
import { ResponseFormatSchema } from "./nodes/core";

// Re-export SystemPromptRef types for consumers
export { SystemPromptRefSchema };
export type { SystemPromptRef } from "./nodes/shared";

// =============================================================================
// AGENT DEFINITION STATUS
// =============================================================================

export const AgentDefinitionStatusSchema = z.enum(["draft", "active", "archived"]);

export type AgentDefinitionStatus = z.infer<typeof AgentDefinitionStatusSchema>;

// =============================================================================
// AGENT DEFINITION
// =============================================================================

/**
 * Agent Definition - Reusable agent configuration.
 *
 * Agent definitions can be used in multiple workflows.
 * They contain the full agent configuration:
 * - System prompt
 * - LLM configuration (model, temperature, etc.)
 * - Tools configuration
 * - Memory settings
 * - Response format
 */
export const AgentDefinitionSchema = z.object({
  // Identity
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9-]*$/, {
      message: "Key must start with lowercase letter and contain only lowercase letters, numbers, and hyphens",
    }),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),

  // Status
  status: AgentDefinitionStatusSchema.default("draft"),

  // Agent configuration
  /**
   * Inline system prompt. Required unless promptRef is provided.
   * When promptRef is set, this is used as fallback if prompt resolution fails.
   */
  systemPrompt: z.string().min(1).max(10000).optional(),
  /**
   * Reference to a prompt from the Prompt Repository.
   * When set, takes precedence over inline systemPrompt.
   * Resolved at runtime with variable interpolation.
   */
  promptRef: SystemPromptRefSchema.optional(),
  llm: WorkflowLLMConfigSchema,
  tools: UnifiedToolsConfigSchema.optional(),
  conversationHistory: ConversationHistoryConfigSchema.optional(),
  memory: MemoryConfigSchema.optional(),
  responseFormat: ResponseFormatSchema.optional(),

  // Audit fields
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional(),
  deletedAt: z.coerce.date().optional(), // Soft delete
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

// =============================================================================
// CREATE/UPDATE SCHEMAS
// =============================================================================

/**
 * Schema for creating a new agent definition.
 */
export const CreateAgentDefinitionSchema = AgentDefinitionSchema.omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
}).extend({
  // Key is required for creation
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9-]*$/),
});

export type CreateAgentDefinition = z.infer<typeof CreateAgentDefinitionSchema>;

/**
 * Schema for updating an existing agent definition.
 */
export const UpdateAgentDefinitionSchema = CreateAgentDefinitionSchema.partial().extend({
  // Key cannot be changed after creation
  key: z.undefined(),
});

export type UpdateAgentDefinition = z.infer<typeof UpdateAgentDefinitionSchema>;
