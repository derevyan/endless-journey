import { z } from "zod";
import { BaseNodeDataSchema, MediaSchema } from "../../../base";
import { ButtonConfigSchema } from "../../../button";

/**
 * Questionnaire Node Schema
 *
 * A dedicated node type for sequential Q&A with shared timeout.
 * Replaces multiple MESSAGE nodes for surveys/assessments.
 *
 * Benefits:
 * - 10 questions = 1 node instead of 10 nodes
 * - Shared timeout handling (no timer edges needed)
 * - Progress indicators (fraction, percentage, bar, dots)
 * - Optional back navigation
 * - Consolidated response storage
 */

// =============================================================================
// QUESTION SCHEMA
// =============================================================================

/**
 * Response type for individual questions
 * Reuses the same pattern as MESSAGE node's responseType
 */
export const QuestionResponseTypeSchema = z.enum(["buttons", "text", "any"]);
export type QuestionResponseType = z.infer<typeof QuestionResponseTypeSchema>;

/**
 * Text validation rules for text-type questions
 */
export const TextValidationSchema = z.object({
  /** Regex pattern to validate against */
  pattern: z.string().optional(),
  /** Minimum text length */
  minLength: z.number().int().min(1).optional(),
  /** Maximum text length */
  maxLength: z.number().int().max(4096).optional(),
  /** Error message shown when validation fails */
  errorMessage: z.string().max(500).optional(),
});
export type TextValidation = z.infer<typeof TextValidationSchema>;

/**
 * Individual question within a questionnaire
 */
export const QuestionSchema = z.object({
  /** Unique identifier for this question (within the questionnaire) */
  id: z.string().min(1),

  /** Question content - the text shown to the user */
  content: z.string().min(1).max(4096),

  /** Optional media attachment (image, video) */
  media: MediaSchema.optional(),

  /** Response type - buttons, text, or any (buttons shown but text accepted) */
  responseType: QuestionResponseTypeSchema.default("buttons"),

  /** Buttons for button-type questions (reuses ButtonConfigSchema) */
  buttons: z.array(ButtonConfigSchema).max(10).optional(),

  /** Validation rules for text responses */
  validation: TextValidationSchema.optional(),

  /** Store response in journey variable with this name */
  storeResponseAs: z.string().optional(),

  /** Optional hint text shown below the question */
  hint: z.string().max(500).optional(),

  /** JEXL expression - skip this question if evaluates to true */
  skipIf: z.string().optional(),

  /** Whether this question requires an answer (default: true) */
  required: z.boolean().default(true),
});
export type Question = z.infer<typeof QuestionSchema>;

// =============================================================================
// TIMEOUT CONFIGURATION
// =============================================================================

/**
 * Questionnaire timeout configuration
 * Uses targetNodeId pattern (not edge-based) per RFC #11
 */
export const QuestionnaireTimeoutSchema = z.object({
  /** Timeout duration in seconds (1 minute to 7 days) */
  seconds: z.number().int().min(60).max(604800),
  /** Target node to transition to on timeout */
  targetNodeId: z.string().optional(),
});
export type QuestionnaireTimeout = z.infer<typeof QuestionnaireTimeoutSchema>;

// =============================================================================
// INTRODUCTION & COMPLETION
// =============================================================================

/**
 * Introduction message shown before first question
 */
export const IntroductionSchema = z.object({
  /** Introduction content */
  content: z.string().min(1).max(4096),
  /** Optional media attachment */
  media: MediaSchema.optional(),
});
export type Introduction = z.infer<typeof IntroductionSchema>;

/**
 * Completion message shown after all questions answered
 */
export const CompletionSchema = z.object({
  /** Completion content */
  content: z.string().min(1).max(4096),
  /** Optional media attachment */
  media: MediaSchema.optional(),
  /** Delay in seconds before transitioning to next node (default: 2) */
  delayBeforeTransition: z.number().int().min(0).max(30).default(2),
});
export type Completion = z.infer<typeof CompletionSchema>;

// =============================================================================
// MAIN QUESTIONNAIRE NODE DATA
// =============================================================================

/**
 * Questionnaire Node Data Schema
 *
 * Extends BaseNodeDataSchema with questionnaire-specific fields.
 * Supports 1-20 sequential questions with shared timeout handling.
 */
export const QuestionnaireNodeDataSchema = BaseNodeDataSchema.extend({
  /** Discriminator for node type */
  type: z.literal("questionnaire"),

  /** Array of questions (1-20 questions per node) */
  questions: z.array(QuestionSchema).min(1).max(20),

  /** Introduction message (shown before first question) */
  introduction: IntroductionSchema.optional(),

  /** Completion message (shown after last question) */
  completion: CompletionSchema.optional(),

  /** Shared timeout for all questions */
  timeout: QuestionnaireTimeoutSchema.optional(),

  /** Allow going back to previous questions */
  allowBack: z.boolean().default(false),

  /** Shuffle question order at runtime */
  shuffle: z.boolean().default(false),

  /** Store all responses as single object with this variable name */
  storeAllAs: z.string().optional(),

  /** Direct target node after completion (uses targetNodeId pattern) */
  next: z.string().optional(),
});
export type QuestionnaireNodeData = z.infer<typeof QuestionnaireNodeDataSchema>;

// =============================================================================
// SESSION STATE (for engine tracking)
// =============================================================================

/**
 * Individual response record
 */
export const QuestionResponseSchema = z.object({
  /** Question ID this response is for */
  questionId: z.string(),
  /** The response value (button ID or text) */
  value: z.string(),
  /** Button ID if this was a button click */
  buttonId: z.string().optional(),
  /** When this response was recorded */
  timestamp: z.iso.datetime(),
});
export type QuestionResponse = z.infer<typeof QuestionResponseSchema>;

/**
 * Questionnaire progress state
 * Stored in session.nodeOutputs[nodeId] during execution
 */
export const QuestionnaireStateSchema = z.object({
  /** Current question index (0-based) */
  currentIndex: z.number().int().min(0),
  /** Question IDs in order (may differ from definition if shuffled) */
  questionOrder: z.array(z.string()),
  /** Collected responses */
  responses: z.array(QuestionResponseSchema),
  /** Skipped question IDs */
  skipped: z.array(z.string()),
  /** When the questionnaire was started */
  startedAt: z.iso.datetime(),
  /** Timer ID for timeout (for cancellation) */
  timerId: z.string().optional(),
});
export type QuestionnaireState = z.infer<typeof QuestionnaireStateSchema>;

// =============================================================================
// QUESTIONNAIRE NODE OUTPUT SCHEMA
// Mirrors what questionnaire-handler.ts stores via storeNodeOutput()
// See: questionnaire-handler.ts:402-410
// =============================================================================

/**
 * Enriched response data for a single questionnaire question
 * Includes full question text and button label for human-readable exports
 */
export const EnrichedQuestionnaireResponseSchema = z.object({
  /** The question text that was shown to the user */
  questionText: z.string(),
  /** The raw answer value (text input or button ID) */
  answer: z.string(),
  /** For button responses: the button label text */
  answerLabel: z.string().optional(),
  /** When this response was recorded */
  answeredAt: z.string(),
});

export type EnrichedQuestionnaireResponse = z.infer<typeof EnrichedQuestionnaireResponseSchema>;

/**
 * Questionnaire node output schema - stored via storeNodeOutput()
 * Stores enriched response data including question text and button labels
 */
export const QuestionnaireNodeOutputSchema = z.record(z.string(), EnrichedQuestionnaireResponseSchema);

export type QuestionnaireNodeOutput = z.infer<typeof QuestionnaireNodeOutputSchema>;
