/**
 * Question Understanding Pipeline Configuration
 *
 * Configuration for the multi-model question understanding pipeline.
 * Uses 5 workers in parallel to understand questions, then selects the best answer with an evaluator.
 *
 * Architecture:
 * - 5 workers run the question understanding task in parallel (different providers/models)
 * - Evaluator ranks the worker outputs and selects the best answer
 * - Fallback strategy handles evaluator failures
 *
 * @example
 * import { QU_WORKERS, QU_EVALUATOR } from "@journey/schemas/config/llm/question-understanding";
 *
 * const enabledWorkers = QU_WORKERS.filter(w => w.enabled);
 * for (const worker of enabledWorkers) {
 *   const result = await worker.model; // { id: string, provider: LLMProvider }
 * }
 */

import type { ModelConfig } from "./models";

// =============================================================================
// Types
// =============================================================================

/**
 * Question Understanding worker configuration
 * Each worker has a model configuration and can be individually toggled
 */
export interface QUWorkerConfig {
  /** Unique worker identifier (w1, w2, w3, etc.) */
  id: string;
  /** Model to use for this worker */
  model: ModelConfig;
  /** Whether this worker is enabled */
  enabled: boolean;
}

/**
 * Question Understanding evaluator configuration
 * Evaluator ranks worker outputs and selects the best answer
 */
export interface QUEvaluatorConfig {
  /** Primary model for evaluating worker outputs */
  primary: ModelConfig;
  /** Backup models to try if primary fails */
  backups: ModelConfig[];
  /** Temperature for evaluation (low for consistency) */
  temperature: number;
  /** Maximum tokens for evaluator response */
  maxTokens: number;
  /** Timeout in milliseconds for evaluator call */
  timeoutMs: number;
}

/**
 * Fallback strategy configuration
 * Handles cases where the evaluator fails to produce a result
 */
export interface QUFallbackConfig {
  /** Whether fallback strategy is enabled */
  enabled: boolean;
  /** Strategy to use: first_worker | longest_answer | random */
  strategy: "first_worker" | "longest_answer" | "random";
}

/**
 * Complete Question Understanding pipeline configuration
 */
export interface QuestionUnderstandingConfigType {
  /** Worker models for parallel question understanding */
  workers: readonly QUWorkerConfig[];
  /** Evaluator configuration */
  evaluator: QUEvaluatorConfig;
  /** Fallback configuration */
  fallback: QUFallbackConfig;
  /** Temperature for worker execution */
  workersTemperature: number;
  /** Timeout per worker in milliseconds */
  workerTimeoutMs: number;
  /** Maximum number of concurrent worker threads */
  maxWorkersThreads: number;
  /** Require all workers to complete before evaluating */
  requireAllWorkers: boolean;
  /** Include reasoning in the output */
  includeReasoningInOutput: boolean;
}

// =============================================================================
// Worker Configuration
// =============================================================================

/**
 * Question Understanding workers
 * 5 different workers with different models/providers for diversity
 */
export const QU_WORKERS: readonly QUWorkerConfig[] = [
  {
    id: "w1",
    enabled: true,
    model: {
      id: "gpt-4o-mini",
      provider: "openai",
    },
  },
  {
    id: "w2",
    enabled: true,
    model: {
      id: "gpt-4.1-mini",
      provider: "openai",
    },
  },
  {
    id: "w3",
    enabled: true,
    model: {
      id: "claude-haiku-4-5-20251001",
      provider: "anthropic",
    },
  },
  {
    id: "w4",
    enabled: true,
    model: {
      id: "gemini-3-flash-preview",
      provider: "google-genai",
    },
  },
  {
    id: "w5",
    enabled: true,
    model: {
      id: "openai/gpt-oss-120b",
      provider: "groq",
    },
  },
];

// =============================================================================
// Evaluator Configuration
// =============================================================================

/**
 * Question Understanding evaluator configuration
 * Evaluator selects the best worker output
 */
export const QU_EVALUATOR: QUEvaluatorConfig = {
  primary: {
    id: "claude-haiku-4-5",
    provider: "anthropic",
  },
  backups: [
    {
      id: "gemini-2.5-pro",
      provider: "google-genai",
    },
    {
      id: "openai/gpt-oss-120b",
      provider: "groq",
    },
  ],
  temperature: 0.1,
  maxTokens: 500,
  timeoutMs: 30000,
};

// =============================================================================
// Fallback Configuration
// =============================================================================

/**
 * Fallback strategy for when evaluator fails
 */
export const QU_FALLBACK: QUFallbackConfig = {
  enabled: true,
  strategy: "first_worker",
};

// =============================================================================
// Complete Configuration
// =============================================================================

/**
 * Complete Question Understanding pipeline configuration
 * Combines workers, evaluator, and fallback settings
 */
export const QUESTION_UNDERSTANDING_CONFIG: QuestionUnderstandingConfigType = {
  workers: QU_WORKERS,
  evaluator: QU_EVALUATOR,
  fallback: QU_FALLBACK,
  workersTemperature: 0.1,
  workerTimeoutMs: 6000,
  maxWorkersThreads: 6,
  requireAllWorkers: false,
  includeReasoningInOutput: true,
} as const;

