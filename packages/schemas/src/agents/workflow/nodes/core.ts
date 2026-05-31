import { z } from "zod";
import { PromptChatMessageSchema } from "../../../prompts";
import {
  WorkflowLLMConfigSchema,
  UnifiedToolsConfigSchema,
  ConversationHistoryConfigSchema,
  MemoryConfigSchema,
  SystemPromptRefSchema,
} from "./shared";

// =============================================================================
// START NODE - Entry point
// =============================================================================

export const StartNodeConfigSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
  })
  .default({});

export type StartNodeConfig = z.infer<typeof StartNodeConfigSchema>;

// =============================================================================
// RESPONSE FORMAT - Structured Output (CRITICAL for If/Else)
// =============================================================================

/**
 * Response format for structured output.
 *
 * CRITICAL: Structured output is essential for AI agent workflows because:
 * - Guarantees response can be parsed as JSON
 * - Enables reliable If/Else branching on agent output (e.g., {{agent.result.needs_detail}})
 * - Supports chain-of-thought reasoning with enforced steps
 *
 * Matches OpenAI's response_format API parameter.
 *
 * Method options (per LangChain docs):
 * - "jsonSchema": Use provider-native structured output (OpenAI, Anthropic, Google)
 * - "functionCalling": Use tool calling to enforce structure (works with all models)
 *
 * Note: "json_object" was removed - only "json_schema" is supported for structured output.
 * json_schema provides strict validation and works across all providers.
 */
export const ResponseFormatSchema = z.discriminatedUnion("type", [
  // Plain text response (default)
  z.object({
    type: z.literal("text"),
  }),

  // JSON with specific schema (strict mode - RECOMMENDED for agents)
  z.object({
    type: z.literal("json_schema"),
    name: z.string().min(1).max(100),
    schema: z.record(z.string(), z.unknown()),
    strict: z.boolean().default(true),
    // LangChain method: jsonSchema (native) or functionCalling (universal)
    method: z.enum(["jsonSchema", "functionCalling"]).default("functionCalling"),
  }),
]);

export type ResponseFormat = z.infer<typeof ResponseFormatSchema>;

// =============================================================================
// AGENT NODE - LLM execution
// =============================================================================

/**
 * Agent node configuration for LLM execution.
 *
 * Uses unified tools config format:
 * - Single array of tool IDs: ["system:save_memory", "utility:current_time"]
 * - Simple and consistent
 *
 * System Prompt Sources:
 * - Inline: `systemPrompt` field contains the prompt text
 * - Repository: `promptRef` references a prompt from the Prompt Repository
 *   When promptRef is set, it takes precedence. systemPrompt is used as fallback.
 */
export const AgentNodeConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  /**
   * Source of the system prompt: inline text or repository reference.
   * Controls which source is active at runtime.
   * - "inline": Use systemPrompt field
   * - "repository": Use promptRef to load from repository
   * Stored explicitly to preserve tab selection when switching modes.
   */
  promptSource: z.enum(["inline", "repository"]).optional(),
  /**
   * Inline system prompt. Optional when promptRef is provided.
   * When promptRef is set, systemPrompt serves as fallback if resolution fails.
   */
  systemPrompt: z.string().min(1).max(10000).optional(),
  /**
   * Chat messages from a chat-type prompt.
   * Set by prompt resolution when promptRef points to a chat-type prompt.
   * Contains array of messages with roles (system, user, assistant).
   */
  chatMessages: z.array(PromptChatMessageSchema).optional(),
  /**
   * Reference to a prompt from the Prompt Repository.
   * When set, takes precedence over inline systemPrompt.
   * Resolved at runtime with variable interpolation.
   */
  promptRef: SystemPromptRefSchema.optional(),
  /**
   * Variable mappings for prompt template resolution.
   * Maps prompt variable names to context paths.
   * Example: { "input": "userResponse.value", "userName": "user.firstName" }
   */
  promptVariables: z.record(z.string(), z.string()).optional(),
  llm: WorkflowLLMConfigSchema,

  // Unified tools config
  unifiedTools: UnifiedToolsConfigSchema.optional(),

  responseFormat: ResponseFormatSchema.optional(),
  outputVariable: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .optional(),
  // Conversation history configuration
  history: ConversationHistoryConfigSchema.optional(),
  // Long-term memory configuration
  memory: MemoryConfigSchema.optional(),

  /**
   * Message source for user input.
   * - "auto" (default): Use `userMessageOverride` from upstream nodes if present,
   *   otherwise use original message. Enables automatic integration with
   *   preprocessing nodes like Question Understanding.
   * - "original": Always use the original user message, ignoring any overrides.
   */
  messageSource: z.enum(["auto", "original"]).default("auto"),

  /**
   * Enable AI-generated quick-reply buttons.
   * When enabled, AI can return buttons for quick user responses.
   * Schema is automatically extended to include { response, buttons } structure.
   */
  enableQuickReplies: z.boolean().default(false),
});

export type AgentNodeConfig = z.infer<typeof AgentNodeConfigSchema>;

// =============================================================================
// END NODE - Terminal
// =============================================================================

export const EndNodeConfigSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    // Optional template for final output (Handlebars syntax)
    outputTemplate: z.string().max(5000).optional(),
  })
  .default({});

export type EndNodeConfig = z.infer<typeof EndNodeConfigSchema>;

