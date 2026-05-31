import { z } from "zod";
import { BaseNodeDataSchema } from "../../../base";
import { VoiceModeSchema, VoiceProfileSchema } from "../message/schema";
import { AIContextSettingsSchema } from "../../../ai-context";
import { AudioProviderSchema } from "../../../../llm/providers";

// =============================================================================
// MIDDLEWARE CONFIGURATION
// Used by @journey/llm and @journey/engine-integrations
// =============================================================================

/**
 * Model Fallback Middleware Configuration
 * Automatically tries alternative models when the primary model fails
 */
export const ModelFallbackConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Fallback models to try in order when primary fails */
  fallbackModels: z.array(z.string()).default([]),
});

export type ModelFallbackConfig = z.infer<typeof ModelFallbackConfigSchema>;

/**
 * PII Detection Middleware Configuration
 * Detects and handles Personally Identifiable Information in messages
 */
export const PIIDetectionConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** PII types to detect: email, phone, ssn, credit_card, ip, date_of_birth */
  types: z.array(z.string()).default(["email", "phone"]),
  /** Strategy for handling detected PII */
  strategy: z.enum(["redact", "mask", "block", "warn"]).default("warn"),
  /** Scan user input messages */
  scanInput: z.boolean().default(true),
  /** Scan model output responses */
  scanOutput: z.boolean().default(false),
});

export type PIIDetectionConfig = z.infer<typeof PIIDetectionConfigSchema>;

/**
 * Model Call Limit Middleware Configuration
 * Limits model calls to prevent infinite loops or excessive costs
 */
export const ModelCallLimitConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Maximum model calls per single agent invocation (run) */
  runLimit: z.number().int().min(1).max(100).default(20),
  /** Maximum model calls across thread (requires state persistence) */
  threadLimit: z.number().int().min(1).max(1000).optional(),
  /** Behavior when limit is reached: "end" or "error" */
  exitBehavior: z.enum(["end", "error"]).default("end"),
});

export type ModelCallLimitConfig = z.infer<typeof ModelCallLimitConfigSchema>;

/**
 * Todo List Middleware Configuration
 * Injects a todo list tool for task planning and tracking
 */
export const TodoListMiddlewareConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Additional system prompt instructions for task planning */
  systemPrompt: z.string().max(1000).optional(),
  /** Maximum number of todos allowed */
  maxTodos: z.number().int().min(1).max(200).default(50),
});

export type TodoListMiddlewareConfig = z.infer<typeof TodoListMiddlewareConfigSchema>;

/**
 * Human-in-the-Loop Middleware Configuration
 * Enables human approval for specific tool calls
 */
export const HITLMiddlewareConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Tool names that require human approval before execution */
  requireApprovalFor: z.array(z.string()).default([]),
  /** Default timeout in milliseconds for approval requests */
  timeout: z.number().int().min(10000).max(3600000).default(300000), // 5 mins
  /** Behavior when timeout is reached */
  timeoutBehavior: z.enum(["approve", "reject", "skip"]).default("reject"),
});

export type HITLMiddlewareConfig = z.infer<typeof HITLMiddlewareConfigSchema>;

/**
 * Guard Worker Configuration
 * Each guard runs in parallel - if ANY blocks, request is denied.
 * Used by @journey/llm guard service.
 */
export const GuardWorkerConfigSchema = z.object({
  /** Unique identifier for this guard (e.g., "safety", "spam", "injection") */
  id: z.string(),
  /** Model to use for this guard */
  model: z.string(),
  /** Provider - all guards run on Groq for fast inference */
  provider: z.enum(["groq"]).default("groq"),
  /** Enable/disable this specific guard */
  enabled: z.boolean().default(true),
});

export type GuardWorkerConfig = z.infer<typeof GuardWorkerConfigSchema>;

/**
 * LLM Guard Middleware Configuration
 * Runs multiple guard models in parallel.
 * Used by @journey/llm middleware.
 */
export const LLMGuardConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Guard workers - uses llmConfig.guards.workers as default if not provided */
  workers: z.array(GuardWorkerConfigSchema).optional(),
  /** Timeout per guard call in milliseconds */
  workerTimeoutMs: z.number().int().min(1000).max(30000).optional(),
  /** Custom message when safety/policy/injection guard blocks */
  blockedMessage: z.string().max(500).optional(),
  /** Custom message when spam guard blocks (friendlier) */
  spamBlockedMessage: z.string().max(500).optional(),
});

export type LLMGuardConfig = z.infer<typeof LLMGuardConfigSchema>;

/**
 * Agent Middleware Configuration
 * Used by @journey/engine-integrations for building agent middleware.
 */
export const AgentMiddlewareConfigSchema = z.object({
  /** LLM safety guards - runs FIRST to block unsafe content (priority 3) */
  llmGuard: LLMGuardConfigSchema.optional(),
  /** Model fallback on errors (rate limits, timeouts, server issues) */
  modelFallback: ModelFallbackConfigSchema.optional(),
  /** PII detection and handling */
  piiDetection: PIIDetectionConfigSchema.optional(),
  /** Model call limits to prevent runaway agents */
  modelCallLimit: ModelCallLimitConfigSchema.optional(),
  /** Todo list tool for task planning */
  todoList: TodoListMiddlewareConfigSchema.optional(),
  /** Human-in-the-loop approval for tool calls */
  humanInTheLoop: HITLMiddlewareConfigSchema.optional(),
});

export type AgentMiddlewareConfig = z.infer<typeof AgentMiddlewareConfigSchema>;

// =============================================================================
// EXECUTION MODE CONFIGURATION
// Controls how the agent node starts its conversation
// =============================================================================

/**
 * Agent Execution Mode - How the agent starts its conversation
 *
 * - welcome_first: Send welcome message, wait for user input, then execute workflow
 * - immediate: Execute workflow immediately
 * - wait_for_input: Wait for user message before any execution
 */
export const AgentExecutionModeSchema = z.enum([
  "welcome_first",
  "immediate",
  "wait_for_input",
]);
export type AgentExecutionMode = z.infer<typeof AgentExecutionModeSchema>;

/**
 * Agent Welcome Configuration
 * Message sent when user first enters the node (for welcome_first mode)
 */
export const AgentWelcomeConfigSchema = z.object({
  /** Welcome message with variable support (e.g., "Hello {{user.firstName}}!") */
  message: z.string().max(2000).optional(),
});
export type AgentWelcomeConfig = z.infer<typeof AgentWelcomeConfigSchema>;

/**
 * Agent Initial Prompt Configuration
 * Used only for "immediate" mode - provides the initial message to kick off the workflow.
 * Only used for the FIRST execution; subsequent turns always use last_user_message.
 */
export const AgentInitialPromptSchema = z.object({
  /** Template for initial workflow input (supports {{variable}} syntax) */
  template: z.string().max(2000).optional(),
});
export type AgentInitialPrompt = z.infer<typeof AgentInitialPromptSchema>;

/**
 * Agent Initial Context Configuration
 * Variables to pass to the workflow on start
 */
export const AgentInitialContextSchema = z.object({
  /** Key-value pairs passed to workflow as initial context */
  variables: z.record(z.string(), z.string()).optional(),
});
export type AgentInitialContext = z.infer<typeof AgentInitialContextSchema>;

// =============================================================================
// TIMEOUT CONFIGURATION
// Inactivity timeout with fallback edge
// =============================================================================

/**
 * Agent Timeout Configuration - Handle inactive conversations
 * Timeout can be seconds-based (inactivity) or absolute (max conversation duration)
 */
export const AgentTimeoutSchema = z.object({
  seconds: z.number().int().min(60).max(604800), // 1 min to 7 days
  timeoutMessage: z.string().max(500).optional(),
});

export type AgentTimeout = z.infer<typeof AgentTimeoutSchema>;

// =============================================================================
// AGENT STATE
// Stored in journeySessions.nodeOutputs for persistence
// =============================================================================

/**
 * Agent State - Conversation state stored in session
 * Tracks conversation progress, token usage, cost, and summarization state
 */
export const AgentStateSchema = z.object({
  conversationStartedAt: z.iso.datetime(),
  messageCount: z.number().int().min(0),
  initialGreetingSent: z.boolean().default(false), // Track if initial greeting was sent
  workflowInitialized: z.boolean().default(false), // Track if first workflow execution happened
  timerId: z.string().optional(),
  // Cost tracking (from @journey/llm TokenUsage)
  totalTokens: z.number().int().min(0).default(0),
  totalCostUSD: z.number().min(0).default(0),
  lastTurnTokens: z.number().int().min(0).default(0),
  lastTurnCostUSD: z.number().min(0).default(0),
  // Summarization state (for "summarize" strategy)
  conversationSummary: z.string().optional(),
  lastSummarizedAt: z.iso.datetime().optional(),
  summarizedUpToIndex: z.number().int().min(0).optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

// =============================================================================
// MAIN AGENT NODE DATA SCHEMA
// =============================================================================

/**
 * Agent Node Data - Delegates to an Agent Workflow
 *
 * The Agent node in journeys is a thin delegation layer that references
 * an Agent Workflow by key. All agent logic (prompts, LLM config, tools,
 * conversation history, etc.) is defined in the workflow.
 *
 * Key Features:
 * - References an Agent Workflow by key
 * - Passes conversation history to workflow for context continuity
 * - Optional timeout for inactivity handling
 *
 * Exit Strategy:
 * - Workflow completion triggers transition to next node
 * - Timeout-based: Inactivity timeout triggers fallback edge
 */
export const AgentNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("agent"),
  /**
   * Reference to a workflow definition (REQUIRED).
   * The workflow is looked up by key in the same organization.
   * Must be an active workflow to be executed.
   */
  workflowKey: z.string().min(1, "Workflow is required"),
  /**
   * Execution mode - how the agent starts its conversation.
   * - immediate: Execute workflow immediately (default)
   * - welcome_first: Send welcome message, wait for user, then execute
   * - wait_for_input: Wait for user message before any execution
   */
  executionMode: AgentExecutionModeSchema.optional(),
  /**
   * Welcome message configuration.
   * Used when executionMode is "welcome_first".
   */
  welcome: AgentWelcomeConfigSchema.optional(),
  /**
   * Initial prompt configuration.
   * Used only for "immediate" mode - provides the initial message to kick off the workflow.
   * Only used for the FIRST execution; subsequent turns always use last_user_message.
   */
  initialPrompt: AgentInitialPromptSchema.optional(),
  /**
   * Initial context - variables to pass to the workflow on start.
   */
  initialContext: AgentInitialContextSchema.optional(),
  /**
   * Optional timeout for inactivity handling.
   * When the timeout expires, the timer edge is triggered.
   */
  timeout: AgentTimeoutSchema.optional(),
  /**
   * Next node (default edge for completion).
   */
  next: z.string().optional(),
  /**
   * Voice response mode for platforms that support voice (Telegram, WhatsApp).
   * Controls whether bot replies with voice message based on user input type.
   */
  voiceMode: VoiceModeSchema.optional(),
  /**
   * Voice profile (TTS voice) - which voice to use for voice responses.
   */
  voiceProfile: VoiceProfileSchema.optional(),
  /**
   * Voice provider for TTS - which provider to use for voice responses.
   * Defaults to "openai" if not specified.
   */
  voiceProvider: AudioProviderSchema.optional(),
  /**
   * ElevenLabs TTS model ID - which model to use for voice generation.
   * Only applicable when voiceProvider is "elevenlabs".
   * Defaults to "eleven_multilingual_v2" if not specified.
   * Available models defined in ELEVENLABS_TTS_MODELS (essential-models.ts).
   */
  elevenLabsModel: z
    .enum([
      "eleven_flash_v2_5",
      "eleven_multilingual_v2",
      "eleven_v3",
      "eleven_turbo_v2_5",
    ])
    .optional(),
  /**
   * AI context settings for enriching workflow system prompts.
   * When configured, builds additional context from journey data
   * (user profile, node outputs, session state, custom templates)
   * and appends it to the agent workflow's system prompt.
   */
  aiContext: AIContextSettingsSchema.optional(),
  /**
   * Show typing indicator while processing user input.
   * When enabled, displays "typing..." during LLM workflow execution.
   * Telegram: Re-sends every 4 seconds to keep indicator visible.
   * If not specified, defaults to true (handled in handler code).
   */
  typingIndicatorEnabled: z.boolean().optional(),
});

export type AgentNodeData = z.infer<typeof AgentNodeDataSchema>;

// =============================================================================
// AGENT NODE OUTPUT SCHEMA
// Mirrors what agent-handler.ts stores via storeNodeOutput()
// See: agent-handler.ts:306-356
// =============================================================================

/**
 * Single agent response in the conversation history
 */
export const AgentResponseSchema = z.object({
  response: z.string(),
  success: z.boolean(),
  blocked: z.boolean().optional(),
  blockedMessage: z.string().optional(),
  toolCalls: z.array(z.unknown()).optional(),
  durationMs: z.number().optional(),
  traceLength: z.number().optional(),
  executedAt: z.string(),
  userMessage: z.string().optional(),
  tokensUsed: z.number().optional(),
  costUSD: z.number().optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

/**
 * Agent conversation metrics
 */
export const AgentConversationMetricsSchema = z.object({
  turnCount: z.number(),
  messageCount: z.number(),
  totalTokens: z.number(),
  totalCostUSD: z.number(),
  conversationStartedAt: z.string(),
  lastTurnAt: z.string(),
});

export type AgentConversationMetrics = z.infer<typeof AgentConversationMetricsSchema>;

/**
 * Agent node output schema - stored via storeNodeOutput()
 * Hybrid model: stores both last response and complete history
 */
export const AgentNodeOutputSchema = z.object({
  // Last response (for easy downstream access via {{nodes.Label.lastResponse}})
  lastResponse: z.string(),
  lastSuccess: z.boolean(),
  lastBlocked: z.boolean(),
  lastBlockedMessage: z.string().optional(),
  lastToolCalls: z.array(z.unknown()),
  lastDurationMs: z.number(),
  lastTraceLength: z.number(),
  lastTurnTokens: z.number(),
  lastTurnCostUSD: z.number(),

  // All responses (complete history for impersonate/export)
  allResponses: z.array(AgentResponseSchema),

  // Conversation metrics from agent state
  conversationMetrics: AgentConversationMetricsSchema,
});

export type AgentNodeOutput = z.infer<typeof AgentNodeOutputSchema>;
