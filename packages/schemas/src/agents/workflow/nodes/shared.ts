import { z } from "zod";
import { LLMProviderSchema, ReasoningEffortSchema, type ReasoningEffort } from "../../../llm/providers";

// =============================================================================
// LLM CONFIGURATION
// =============================================================================

// Re-export ReasoningEffort for workflow node configurations
export { ReasoningEffortSchema, type ReasoningEffort };

export const WorkflowLLMConfigSchema = z.object({
  provider: LLMProviderSchema,
  model: z.string().min(1).max(100),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  /** For reasoning models (o1, o3) - controls reasoning depth instead of temperature */
  reasoningEffort: ReasoningEffortSchema.optional(),
});

export type WorkflowLLMConfig = z.infer<typeof WorkflowLLMConfigSchema>;

// =============================================================================
// TOOLS CONFIGURATION
// =============================================================================

/**
 * Unified tools configuration.
 *
 * This is the new simplified config that replaces WorkflowToolsConfig.
 * All tool types (system, utility, MCP) are selected via a single array of tool IDs.
 *
 * Tool ID format: {source}:{name} or {source}:{server}:{name} for MCP
 * Examples:
 * - "system:save_memory"
 * - "system:read_user_variable"
 * - "utility:current_time"
 * - "utility:web_search"
 * - "mcp:fetch:fetch"
 */
/**
 * Tool execution timing values for schema validation.
 * Matches ToolExecutionTiming type in @journey/schemas/llm/agent-types
 */
const ToolExecutionTimingSchema = z.enum(["immediate", "deferred"]);

export const UnifiedToolsConfigSchema = z.object({
  /** Tool IDs to enable (e.g., ["system:save_memory", "utility:current_time"]) */
  enabled: z.array(z.string()).default([]),
  /** MCP server names to connect to (for MCP tool discovery) */
  mcpServers: z.array(z.string()).optional(),
  /**
   * Override timing for specific tools.
   * Key is tool ID (e.g., "system:save_memory"), value is "immediate" or "deferred".
   * Only applies to tools with timingConfig.configurable === true.
   */
  toolTimingOverrides: z.record(z.string(), ToolExecutionTimingSchema).optional(),
});

export type UnifiedToolsConfig = z.infer<typeof UnifiedToolsConfigSchema>;


// =============================================================================
// CONVERSATION HISTORY
// =============================================================================

export const ConversationHistoryStrategySchema = z.enum([
  "none", // Send no history at all (stateless mode)
  "simple", // Keep last N messages
  "summarize", // Summarize older messages
  "sliding_window", // Rolling window with overlap
]);

/** Conversation history strategy type - use this instead of defining inline unions */
export type ConversationHistoryStrategy = z.infer<typeof ConversationHistoryStrategySchema>;

export const ConversationHistoryConfigSchema = z.object({
  strategy: ConversationHistoryStrategySchema.default("simple"),
  maxMessages: z.number().int().min(1).max(100).default(12),
  summarizeAfter: z.number().int().optional(), // Only for 'summarize' strategy
});

export type ConversationHistoryConfig = z.infer<typeof ConversationHistoryConfigSchema>;

// =============================================================================
// MEMORY CONFIGURATION
// =============================================================================

export const MemoryConfigSchema = z.object({
  enabled: z.boolean().default(false),
  autoInject: z.boolean().default(true),
  /** Maximum number of memories to retrieve */
  maxResults: z.number().int().min(1).max(50).default(10),
  recencyBias: z.number().min(0).max(1).default(0.3),
});

export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

// =============================================================================
// SYSTEM PROMPT REFERENCE
// =============================================================================

/**
 * Reference to a prompt from the Prompt Repository.
 * When set, this takes precedence over inline systemPrompt.
 * The prompt is resolved at runtime with variable interpolation.
 *
 * Resolution priority:
 * 1. If `versionId` is set → pin to that exact version
 * 2. Otherwise → resolve via `label` (defaults to "production")
 */
export const SystemPromptRefSchema = z.object({
  /** Name of the prompt in the repository (kebab-case) */
  name: z.string().min(1).max(100),
  /** Pin to a specific version ID (e.g., "v1", "v2"). Takes precedence over label. */
  versionId: z.string().optional(),
  /** Label for dynamic resolution (e.g., "production", "latest"). Used when versionId is not set. */
  label: z.string().default("production"),
});

export type SystemPromptRef = z.infer<typeof SystemPromptRefSchema>;
