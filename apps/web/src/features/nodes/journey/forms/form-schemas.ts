/**
 * Form Schemas
 *
 * Zod schemas for node editor form validation.
 * Extracted to enable registration with formRegistry.
 *
 * Re-exports schemas from @journey/schemas to ensure single source of truth.
 *
 * @module features/nodes/journey/forms/form-schemas
 */

import { z } from "zod";

import {
  AIContextSettingsSchema,
  AudioProviderSchema,
  CrmActionSchema,
  MediaSchema,
  TagActionSchema,
  VariableActionSchema,
  VariableOperationSchema,
  VoiceProfileSchema,
} from "@journey/schemas";

// ============================================================================
// Re-exported Schemas from @journey/schemas
// ============================================================================

/**
 * Media schema - re-exported with nullable/optional wrapper for forms
 */
export const MediaFormSchema = MediaSchema.nullable().optional();

/**
 * Tag action schema - re-exported for form usage
 */
export const tagActionSchema = TagActionSchema.optional();

/**
 * Variable operation schema - re-exported from @journey/schemas
 */
export const variableOperationSchema = VariableOperationSchema;

/**
 * Variable action schema - re-exported for form usage
 */
export const variableActionSchema = VariableActionSchema.optional();

/**
 * CRM action schema - re-exported for form usage
 */
export const crmActionSchema = CrmActionSchema.optional();

/**
 * Tag operations schema for add/remove operations
 * (used internally by forms, mirrors structure in TagActionSchema)
 */
export const tagOperationsSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

/**
 * Common fields shared by all schemas
 */
export const commonSchema = {
  label: z.string().min(1, "Label is required"),
  tags: z.array(z.string()).optional(),
  tagAction: tagActionSchema,
  variableAction: variableActionSchema,
  crmAction: crmActionSchema,
  notes: z.string().optional(),
  customJson: z.string().optional(),
};

// ============================================================================
// Node-specific Schemas
// ============================================================================

/**
 * Voice mode schema - controls how the bot responds to voice messages
 */
export const voiceModeSchema = z.enum(["text-only", "voice-to-voice", "voice-only"]).optional();

/**
 * Voice profile schema - re-exported from @journey/schemas
 */
export const voiceProfileSchema = VoiceProfileSchema.optional();

/**
 * Voice provider schema - TTS provider selection (from canonical AudioProviderSchema)
 */
export const voiceProviderSchema = AudioProviderSchema.optional();

/**
 * Message/general node schema
 */
export const messageNodeSchema = z.object({
  ...commonSchema,
  type: z.string(),
  content: z.string().optional(),
  media: MediaFormSchema,
  timerDays: z.number().min(0).optional(),
  timerHours: z.number().min(0).optional(),
  timerMinutes: z.number().min(0).max(59).optional(),
  timerSeconds: z.number().min(0).max(59).optional(),
  buttons: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        targetNodeId: z.string().optional(),
      })
    )
    .optional(),
  responseType: z.string().optional(),
  storeResponseAs: z.string().optional(),
  delay: z.number().int().min(0).max(60).optional(),
  // Note: voiceMode is only supported on agent nodes (not message nodes)
  status: z.string().optional(),
});

/**
 * Condition node schema
 */
export const conditionNodeSchema = z.object({
  ...commonSchema,
  type: z.string(),
  expression: z.string().optional(),
  status: z.string().optional(),
  rules: z
    .array(
      z.object({
        field: z.string(),
        operator: z.string(),
        value: z.string(),
      })
    )
    .optional(),
  rulesOperator: z.enum(["and", "or"]).optional(),
});

/**
 * Wait node schema
 */
export const waitNodeSchema = z.object({
  ...commonSchema,
  durationDays: z.number().min(0).optional(),
  durationHours: z.number().min(0).optional(),
  durationMinutes: z.number().min(0).max(59).optional(),
  durationSeconds: z.number().min(0).max(59).optional(),
  reason: z.string().optional(),
});

/**
 * Webhook node schema
 */
export const webhookNodeSchema = z.object({
  ...commonSchema,
  url: z.string().min(1, "URL is required"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  body: z.string().optional(),
  authType: z.enum(["none", "bearer", "basic", "apiKey"]).default("none"),
  authToken: z.string().optional(),
  authUsername: z.string().optional(),
  authPassword: z.string().optional(),
  authHeaderName: z.string().optional(),
  authApiKey: z.string().optional(),
  successPath: z.string().optional(),
  storeAs: z.string().optional(),
  errorHandling: z.enum(["continue", "fail", "retry"]).default("continue"),
  retryCount: z.number().min(0).max(5).default(0),
  timeoutMs: z.number().min(1000).max(60000).default(30000),
  mockEnabled: z.boolean().default(false),
  mockStatusCode: z.number().min(100).max(599).optional(),
  mockBody: z.string().optional(),
  mockDelay: z.number().min(0).max(10000).optional(),
});

/**
 * Simple node schema (end)
 */
export const simpleNodeSchema = z.object({
  ...commonSchema,
  type: z.string(),
  status: z.string().optional(),
});

/**
 * Start node schema (includes content and media)
 */
export const startNodeSchema = z.object({
  ...commonSchema,
  type: z.string(),
  content: z.string().optional(),
  media: MediaFormSchema,
  status: z.string().optional(),
});

/**
 * CRM node schema
 */
export const crmNodeSchema = z.object({
  ...commonSchema,
  type: z.string(),
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  crmNotes: z.string().optional(),
  status: z.string().optional(),
});

/**
 * Questionnaire node schema
 */
export const questionnaireNodeSchema = z.object({
  ...commonSchema,
  type: z.string(),
  questions: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      responseType: z.enum(["buttons", "text", "any"]).optional(),
      buttons: z
        .array(
          z.object({
            id: z.string(),
            text: z.string(),
            targetNodeId: z.string().optional(),
          })
        )
        .optional(),
      validation: z
        .object({
          pattern: z.string().optional(),
          minLength: z.number().optional(),
          maxLength: z.number().optional(),
          errorMessage: z.string().optional(),
        })
        .optional(),
      storeResponseAs: z.string().optional(),
      hint: z.string().optional(),
      skipIf: z.string().optional(),
      required: z.boolean().optional(),
    })
  ),
  introduction: z
    .object({
      content: z.string(),
    })
    .optional(),
  completion: z
    .object({
      content: z.string(),
      delayBeforeTransition: z.number().optional(),
    })
    .optional(),
  timeoutDays: z.number().min(0).optional(),
  timeoutHours: z.number().min(0).optional(),
  timeoutMinutes: z.number().min(0).max(59).optional(),
  timeoutSeconds: z.number().min(0).max(59).optional(),
  timeoutTargetNodeId: z.string().optional(),
  allowBack: z.boolean().optional(),
  shuffle: z.boolean().optional(),
  storeAllAs: z.string().optional(),
  next: z.string().optional(),
  status: z.string().optional(),
});

// ============================================================================
// AI Agent Node Schema (Workflow-only mode)
// ============================================================================

export const agentFormSchema = z.object({
  ...commonSchema,
  type: z.literal("agent"),
  workflowKey: z.string().min(1, "Workflow is required"),
  // Execution mode configuration
  executionMode: z.enum(["welcome_first", "immediate", "wait_for_input"]).optional(),
  // Welcome message configuration (for welcome_first mode)
  welcome: z
    .object({
      message: z.string().max(2000).optional(),
    })
    .optional(),
  // Initial prompt configuration (for immediate mode - first execution only)
  initialPrompt: z
    .object({
      template: z.string().max(2000).optional(),
    })
    .optional(),
  // Timeout configuration - flat DHMS fields for DurationInput component
  // Field registry's timeoutField.build() converts these to timeout: { seconds, timeoutMessage }
  timeoutDays: z.number().min(0).optional(),
  timeoutHours: z.number().min(0).optional(),
  timeoutMinutes: z.number().min(0).max(59).optional(),
  timeoutSeconds: z.number().min(0).max(59).optional(),
  timeoutMessage: z.string().max(500).optional(),
  // Voice response configuration
  voiceMode: voiceModeSchema,
  voiceProfile: voiceProfileSchema,
  voiceProvider: voiceProviderSchema,
  elevenLabsModel: z
    .enum(["eleven_flash_v2_5", "eleven_multilingual_v2", "eleven_v3", "eleven_turbo_v2_5"])
    .optional(),
  // AI context settings for enriching workflow system prompts
  aiContext: AIContextSettingsSchema.optional(),
  // Typing indicator during LLM processing
  typingIndicatorEnabled: z.boolean().default(true).optional(),
  status: z.string().optional(),
});

// ============================================================================
// Teleport Node Schema
// ============================================================================

/**
 * Teleport node schema for cross-journey navigation
 */
export const teleportNodeSchema = z.object({
  ...commonSchema,
  type: z.literal("teleport"),
  targetJourneyId: z.string().min(1, "Target journey is required"),
  targetNodeId: z.string().optional(),
  preserveContext: z.boolean().default(true),
  status: z.string().optional(),
});
