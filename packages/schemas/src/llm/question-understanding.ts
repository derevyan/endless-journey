import { z } from "zod";
import { LLMProviderSchema } from "./providers";
import { TokenUsageSchema, type TokenUsage } from "./token-usage";
import { QU_WORKERS, QU_EVALUATOR, QU_FALLBACK } from "../config/llm/question-understanding";

// =============================================================================
// QUESTION UNDERSTANDING SCHEMAS
// Map-reduce pattern for synthesizing unanswered questions from conversation history
// =============================================================================

// =============================================================================
// WORKER CONFIGURATION
// Individual worker LLM configuration for the map phase
// =============================================================================

/**
 * Worker Model Configuration - Settings for each worker in the map phase
 */
export const WorkerModelConfigSchema = z.object({
  /** Unique identifier for this worker */
  id: z.string(),
  /** Model name (e.g., "gpt-4o-mini", "claude-haiku-4-5") */
  model: z.string(),
  /** Provider (optional - auto-detected if not provided) */
  provider: LLMProviderSchema.optional(),
  /** Override default temperature for this worker */
  temperature: z.number().min(0).max(2).optional(),
  /** Override default system prompt for this worker */
  systemPrompt: z.string().optional(),
});

export type WorkerModelConfig = z.infer<typeof WorkerModelConfigSchema>;

// =============================================================================
// EVALUATOR CONFIGURATION
// Evaluator LLM configuration for the reduce phase
// =============================================================================

/**
 * Evaluator Configuration - Settings for the evaluator in the reduce phase
 */
export const EvaluatorConfigSchema = z.object({
  /** Primary evaluator model */
  model: z.string().default(QU_EVALUATOR.primary.id),
  /** Provider (optional - auto-detected if not provided) */
  provider: LLMProviderSchema.optional(),
  /** Temperature for evaluator (low for consistency) */
  temperature: z.number().min(0).max(2).default(QU_EVALUATOR.temperature),
  /** Maximum tokens for evaluator response */
  maxTokens: z.number().int().positive().optional(),
  /** Timeout for evaluator in milliseconds */
  timeoutMs: z.number().int().min(1000).max(60000).default(QU_EVALUATOR.timeoutMs),
  /** Backup models to try if primary fails */
  backupModels: z.array(z.string()).default(QU_EVALUATOR.backups.map((m) => m.id)),
  /** Custom system prompt for evaluator */
  systemPrompt: z.string().optional(),
});

export type EvaluatorConfig = z.infer<typeof EvaluatorConfigSchema>;

// =============================================================================
// FALLBACK CONFIGURATION
// Strategy when evaluator fails
// =============================================================================

/**
 * Fallback Strategy - How to select answer when evaluator fails
 */
export const FallbackStrategySchema = z.enum(["first_worker", "longest_answer", "random"]);
export type FallbackStrategy = z.infer<typeof FallbackStrategySchema>;

/**
 * Fallback Configuration - Behavior when evaluator fails
 */
export const FallbackConfigSchema = z.object({
  /** Enable fallback when evaluator fails */
  enabled: z.boolean().default(QU_FALLBACK.enabled),
  /** Strategy for selecting answer */
  strategy: FallbackStrategySchema.default(QU_FALLBACK.strategy),
});

export type FallbackConfig = z.infer<typeof FallbackConfigSchema>;

// =============================================================================
// MAIN QUESTION UNDERSTANDING CONFIGURATION
// =============================================================================

/**
 * Question Understanding Configuration - Full map-reduce settings
 *
 * This configuration controls the entire question understanding pipeline:
 * 1. Worker models process the question in parallel (map phase)
 * 2. Evaluator selects the best synthesis (reduce phase)
 *
 * Default configuration matches the Python reference implementation.
 */
export const QuestionUnderstandingConfigSchema = z.object({
  // Worker configuration
  /** Worker models to use in parallel */
  workers: z.array(WorkerModelConfigSchema).min(1).max(10).default(
    QU_WORKERS.map((w) => ({
      id: w.id,
      model: w.model.id,
      provider: w.model.provider,
    }))
  ),
  /** Temperature for all workers (unless overridden per-worker) */
  workersTemperature: z.number().min(0).max(2).default(0.1),
  /** Timeout for each worker in milliseconds */
  workerTimeoutMs: z.number().int().min(1000).max(60000).default(6000),
  /** Maximum concurrent worker threads */
  maxWorkersThreads: z.number().int().min(1).max(10).default(6),

  // Evaluator configuration
  /** Evaluator model configuration */
  evaluator: EvaluatorConfigSchema.default(() => ({
    model: QU_EVALUATOR.primary.id,
    temperature: QU_EVALUATOR.temperature,
    timeoutMs: QU_EVALUATOR.timeoutMs,
    backupModels: QU_EVALUATOR.backups.map((m) => m.id),
  })),

  // Fallback configuration
  /** Fallback behavior when evaluator fails */
  fallback: FallbackConfigSchema.default(() => ({
    enabled: QU_FALLBACK.enabled,
    strategy: QU_FALLBACK.strategy,
  })),

  // Feature flags
  /** Require all workers to succeed (fail if any worker fails) */
  requireAllWorkers: z.boolean().default(false),
  /** Include reasoning/explanation in output */
  includeReasoningInOutput: z.boolean().default(true),
});

export type QuestionUnderstandingConfig = z.infer<typeof QuestionUnderstandingConfigSchema>;

// =============================================================================
// WORKER OUTPUT SCHEMAS
// What each worker LLM returns
// =============================================================================

/**
 * Worker Answer - Output from a single worker in the map phase
 */
export const WorkerAnswerSchema = z.object({
  /** Worker identifier */
  workerId: z.string(),
  /** Model used by this worker */
  model: z.string(),
  /** The synthesized answer/question */
  answer: z.string(),
  /** Optional reasoning behind the answer */
  reasoning: z.string().optional(),
  /** Confidence score (0-1) */
  confidence: z.number().min(0).max(1).optional(),
  /** Processing time for this worker */
  processingTimeMs: z.number(),
  /** Token usage from the LLM call */
  tokenUsage: TokenUsageSchema.optional(),
});

export type WorkerAnswer = z.infer<typeof WorkerAnswerSchema>;

// =============================================================================
// EVALUATOR OUTPUT SCHEMAS
// What the evaluator returns after selecting the best answer
// =============================================================================

/**
 * Worker Ranking - Ranking of a worker by the evaluator
 */
export const WorkerRankingSchema = z.object({
  workerId: z.string(),
  rank: z.number().int().min(1),
  score: z.number().min(0).max(1).optional(),
});

export type WorkerRanking = z.infer<typeof WorkerRankingSchema>;

/**
 * Evaluation Answer - Output from the evaluator in the reduce phase
 */
export const EvaluationAnswerSchema = z.object({
  /** ID of the worker with the best answer */
  selectedWorkerId: z.string(),
  /** The selected best answer */
  selectedAnswer: z.string(),
  /** Explanation of why this answer was selected */
  evaluationReasoning: z.string(),
  /** Optional ranking of all workers */
  rankings: z.array(WorkerRankingSchema).optional(),
});

export type EvaluationAnswer = z.infer<typeof EvaluationAnswerSchema>;

// =============================================================================
// FINAL RESULT SCHEMA
// Complete result from the question understanding engine
// =============================================================================

/**
 * Token Usage - Aggregated token usage across all LLM calls
 */
export const QuestionUnderstandingUsageSchema = z.object({
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  totalCostUSD: z.number().min(0),
});

export type QuestionUnderstandingUsage = z.infer<typeof QuestionUnderstandingUsageSchema>;

/**
 * Question Understanding Result - Complete output from the engine
 */
export const QuestionUnderstandingResultSchema = z.object({
  /** Original question/input */
  question: z.string(),
  /** The selected best answer (synthesized question in Russian) */
  selectedAnswer: z.string(),
  /** ID of the worker whose answer was selected */
  selectedWorkerId: z.string(),
  /** Evaluation details (if includeReasoningInOutput is true) */
  evaluation: EvaluationAnswerSchema.optional(),
  /** All worker answers (for debugging/analysis) */
  workerAnswers: z.array(WorkerAnswerSchema),
  /** Total processing time in milliseconds */
  totalProcessingTimeMs: z.number(),
  /** Aggregated token usage and cost */
  usage: QuestionUnderstandingUsageSchema,
});

export type QuestionUnderstandingResult = z.infer<typeof QuestionUnderstandingResultSchema>;

// =============================================================================
// AGENT NODE INTEGRATION SCHEMA
// Configuration for question understanding in agent nodes
// =============================================================================

/**
 * Agent Question Understanding Configuration
 * Optional preprocessing step before agent responds
 *
 * When enabled, the agent will:
 * 1. Analyze conversation history for unanswered questions
 * 2. Synthesize them into a coherent Russian sentence
 * 3. Inject this context into the agent's system prompt
 */
export const AgentQuestionUnderstandingSchema = z.object({
  /** Enable question understanding preprocessing */
  enabled: z.boolean().default(false),
  /** Custom worker configurations (uses defaults if not provided) */
  workers: z.array(WorkerModelConfigSchema).optional(),
  /** Evaluator model (uses agent's model if not specified) */
  evaluatorModel: z.string().optional(),
  /** Timeout for each worker in milliseconds */
  workerTimeoutMs: z.number().int().min(1000).max(60000).default(6000),
  /** Only trigger for specific patterns (regex) - if empty, always trigger */
  triggerPatterns: z.array(z.string()).optional(),
});

export type AgentQuestionUnderstanding = z.infer<typeof AgentQuestionUnderstandingSchema>;
