/**
 * Question Understanding Service
 *
 * Implements a map-reduce pattern for synthesizing unanswered questions:
 * 1. Map: Multiple worker LLMs process the conversation in parallel
 * 2. Reduce: Evaluator LLM selects the best synthesis
 *
 * Features:
 * - Parallel worker execution via Promise.all()
 * - Configurable worker and evaluator models
 * - Fallback strategies when workers/evaluator fail
 * - Circuit breaker protection (via llm-service)
 * - Token usage and cost tracking
 * - Structured output with Zod validation
 *
 * @module services/question-understanding
 */

import { createLogger, serializeError } from "@journey/logger";
import type {
  QuestionUnderstandingConfig,
  QuestionUnderstandingResult,
  WorkerAnswer,
  EvaluationAnswer,
  WorkerModelConfig,
  EvaluatorConfig,
  FallbackStrategy,
  QuestionUnderstandingUsage,
  TokenUsage,
} from "@journey/schemas";
import { LLM_SERVICE_NAMES } from "@journey/schemas";
import { generateStructuredOutput, type LLMConfig } from "../llm-service";
import { getUsageTrackingAdapter } from "../../adapters/usage-tracking-context";
import { buildModelSamplingConfig } from "../../utils/sampling-config";
import {
  DEFAULT_WORKER_SYSTEM_PROMPT,
  DEFAULT_EVALUATOR_SYSTEM_PROMPT,
  WORKER_OUTPUT_SCHEMA,
  EVALUATOR_OUTPUT_SCHEMA,
  buildWorkerUserContent,
  buildEvaluatorUserContent,
} from "./prompts";

const log = createLogger("llm:question-understanding");

// ============================================================================
// Types
// ============================================================================

/**
 * Context passed to workers for question synthesis
 */
export interface WorkerContext {
  /** The question or user message to analyze */
  question: string;
  /** Conversation history as formatted string */
  conversationHistory?: string;
  /** Additional context (reserved for future use) */
  additionalContext?: Record<string, unknown>;
  /** Organization ID for usage tracking (optional) */
  organizationId?: string;
}

// ============================================================================
// Worker Execution (Map Phase)
// ============================================================================

/**
 * Execute a single worker LLM to synthesize unanswered questions
 */
async function executeWorker(
  workerConfig: WorkerModelConfig,
  context: WorkerContext,
  globalTemperature: number,
  timeoutMs: number,
  customSystemPrompt?: string
): Promise<WorkerAnswer> {
  const startTime = Date.now();
  const workerId = workerConfig.id;

  const systemPrompt = customSystemPrompt || workerConfig.systemPrompt || DEFAULT_WORKER_SYSTEM_PROMPT;
  const userContent = buildWorkerUserContent(context.question, context.conversationHistory);

  // Build sampling config based on model capabilities (reasoning vs temperature)
  const samplingConfig = buildModelSamplingConfig({
    model: workerConfig.model,
    temperature: workerConfig.temperature ?? globalTemperature,
  });

  const llmConfig: LLMConfig = {
    model: workerConfig.model,
    provider: workerConfig.provider,
    ...samplingConfig,
    timeout: Math.floor(timeoutMs / 1000), // Convert to seconds
  };

  log.debug(
    { workerId, model: workerConfig.model, timeoutMs },
    "questionUnderstanding:worker:start"
  );

  try {
    const response = await generateStructuredOutput(
      systemPrompt,
      userContent,
      WORKER_OUTPUT_SCHEMA,
      llmConfig
    );

    const processingTimeMs = Date.now() - startTime;

    log.debug(
      { workerId, model: workerConfig.model, processingTimeMs },
      "questionUnderstanding:worker:complete"
    );

    return {
      workerId,
      model: workerConfig.model,
      answer: response.result.answer,
      reasoning: response.result.reasoning,
      confidence: response.result.confidence,
      processingTimeMs,
      tokenUsage: response.tokenUsage,
    };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    log.error(
      { workerId, model: workerConfig.model, processingTimeMs, err: serializeError(error) },
      "questionUnderstanding:worker:failed"
    );
    throw error;
  }
}

/**
 * Execute all workers in parallel (Map phase)
 */
async function executeMapPhase(
  workers: WorkerModelConfig[],
  context: WorkerContext,
  globalTemperature: number,
  timeoutMs: number,
  requireAllWorkers: boolean,
  customSystemPrompt?: string
): Promise<WorkerAnswer[]> {
  log.info(
    { workerCount: workers.length, timeoutMs },
    "questionUnderstanding:map:start"
  );

  const workerPromises = workers.map((workerConfig) =>
    executeWorker(workerConfig, context, globalTemperature, timeoutMs, customSystemPrompt)
      .catch((error) => {
        log.warn(
          { workerId: workerConfig.id, model: workerConfig.model, err: serializeError(error) },
          "questionUnderstanding:map:workerError"
        );
        return null; // Return null for failed workers
      })
  );

  const results = await Promise.all(workerPromises);
  const successfulAnswers = results.filter((result): result is WorkerAnswer => result !== null);

  log.info(
    { totalWorkers: workers.length, successfulWorkers: successfulAnswers.length },
    "questionUnderstanding:map:complete"
  );

  // Check if we have enough workers
  if (successfulAnswers.length === 0) {
    throw new Error("All workers failed - no answers to evaluate");
  }

  if (requireAllWorkers && successfulAnswers.length < workers.length) {
    throw new Error(
      `Not all workers completed: ${successfulAnswers.length}/${workers.length}`
    );
  }

  return successfulAnswers;
}

// ============================================================================
// Evaluator Execution (Reduce Phase)
// ============================================================================

/**
 * Execute the evaluator LLM to select the best answer
 */
async function executeEvaluator(
  evaluatorConfig: EvaluatorConfig,
  question: string,
  workerAnswers: WorkerAnswer[],
  conversationHistory?: string
): Promise<EvaluationAnswer> {
  const systemPrompt = evaluatorConfig.systemPrompt || DEFAULT_EVALUATOR_SYSTEM_PROMPT;
  const userContent = buildEvaluatorUserContent(
    question,
    workerAnswers,
    conversationHistory
  );

  // Build sampling config based on model capabilities (reasoning vs temperature)
  const samplingConfig = buildModelSamplingConfig({
    model: evaluatorConfig.model,
    temperature: evaluatorConfig.temperature,
  });

  const llmConfig: LLMConfig = {
    model: evaluatorConfig.model,
    provider: evaluatorConfig.provider,
    ...samplingConfig,
    maxTokens: evaluatorConfig.maxTokens,
    timeout: Math.floor(evaluatorConfig.timeoutMs / 1000),
  };

  log.debug(
    { model: evaluatorConfig.model, answerCount: workerAnswers.length },
    "questionUnderstanding:evaluator:start"
  );

  const response = await generateStructuredOutput(
    systemPrompt,
    userContent,
    EVALUATOR_OUTPUT_SCHEMA,
    llmConfig
  );

  log.debug(
    { selectedWorkerId: response.result.selectedWorkerId },
    "questionUnderstanding:evaluator:complete"
  );

  return {
    selectedWorkerId: response.result.selectedWorkerId,
    selectedAnswer: response.result.selectedAnswer,
    evaluationReasoning: response.result.evaluationReasoning,
    rankings: response.result.rankings,
  };
}

/**
 * Try evaluator with fallback models
 */
async function executeEvaluatorWithFallback(
  evaluatorConfig: EvaluatorConfig,
  question: string,
  workerAnswers: WorkerAnswer[],
  conversationHistory?: string
): Promise<EvaluationAnswer | undefined> {
  // Build list of models to try: primary + backups
  const modelsToTry = [
    evaluatorConfig.model,
    ...(evaluatorConfig.backupModels || []),
  ];

  for (const model of modelsToTry) {
    try {
      log.debug({ model }, "questionUnderstanding:evaluator:trying");

      const configWithModel: EvaluatorConfig = {
        ...evaluatorConfig,
        model,
      };

      return await executeEvaluator(
        configWithModel,
        question,
        workerAnswers,
        conversationHistory
      );
    } catch (error) {
      log.warn(
        { model, err: serializeError(error) },
        "questionUnderstanding:evaluator:modelFailed"
      );
      // Continue to next model
    }
  }

  // All evaluator models failed
  log.error(
    { modelsAttempted: modelsToTry.length },
    "questionUnderstanding:evaluator:allFailed"
  );
  return undefined;
}

// ============================================================================
// Fallback Strategies
// ============================================================================

/**
 * Apply fallback strategy when evaluator fails
 */
function applyFallback(
  workerAnswers: WorkerAnswer[],
  strategy: FallbackStrategy
): { selectedWorkerId: string; selectedAnswer: string } {
  if (workerAnswers.length === 0) {
    throw new Error("No worker answers available for fallback");
  }

  log.info({ strategy, answerCount: workerAnswers.length }, "questionUnderstanding:fallback:applying");

  switch (strategy) {
    case "first_worker":
      return {
        selectedWorkerId: workerAnswers[0].workerId,
        selectedAnswer: workerAnswers[0].answer,
      };

    case "longest_answer": {
      const longest = workerAnswers.reduce((prev, curr) =>
        curr.answer.length > prev.answer.length ? curr : prev
      );
      return {
        selectedWorkerId: longest.workerId,
        selectedAnswer: longest.answer,
      };
    }

    case "random": {
      const randomIndex = Math.floor(Math.random() * workerAnswers.length);
      return {
        selectedWorkerId: workerAnswers[randomIndex].workerId,
        selectedAnswer: workerAnswers[randomIndex].answer,
      };
    }

    default:
      // Default to first worker
      return {
        selectedWorkerId: workerAnswers[0].workerId,
        selectedAnswer: workerAnswers[0].answer,
      };
  }
}

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Execute Question Understanding with map-reduce pattern
 *
 * This function:
 * 1. Runs multiple worker LLMs in parallel to synthesize unanswered questions
 * 2. Uses an evaluator LLM to select the best synthesis
 * 3. Returns the selected answer with metadata
 *
 * @param question - The question or user message to analyze
 * @param config - Configuration for workers and evaluator
 * @param context - Optional additional context (conversation history, etc.)
 * @returns The selected best answer with metadata
 *
 * @example
 * ```typescript
 * const result = await executeQuestionUnderstanding(
 *   "What courses do you offer?",
 *   {
 *     workers: [
 *       { id: "w1", model: "gpt-4o-mini", provider: "openai" },
 *       { id: "w2", model: "claude-haiku-4-5", provider: "anthropic" },
 *     ],
 *     evaluator: { model: "claude-haiku-4-5", temperature: 0.1 },
 *   },
 *   { conversationHistory: "User: Hello\nAI: Hi there!" }
 * );
 * console.log(result.selectedAnswer); // "Какие курсы вы предлагаете?"
 * ```
 */
export async function executeQuestionUnderstanding(
  question: string,
  config: QuestionUnderstandingConfig,
  context?: Partial<WorkerContext>
): Promise<QuestionUnderstandingResult> {
  const startTime = Date.now();

  log.info(
    {
      question: question.substring(0, 100),
      workerCount: config.workers.length,
      evaluatorModel: config.evaluator.model,
    },
    "questionUnderstanding:start"
  );

  const workerContext: WorkerContext = {
    question,
    conversationHistory: context?.conversationHistory,
    additionalContext: context?.additionalContext,
  };

  // ========================================================================
  // Phase 1: Map - Execute all workers in parallel
  // ========================================================================

  const workerAnswers = await executeMapPhase(
    config.workers,
    workerContext,
    config.workersTemperature,
    config.workerTimeoutMs,
    config.requireAllWorkers
  );

  // ========================================================================
  // Phase 2: Reduce - Evaluator selects the best answer
  // ========================================================================

  let selectedAnswer: string;
  let selectedWorkerId: string;
  let evaluation: EvaluationAnswer | undefined;

  // Skip evaluation if only one worker succeeded
  if (workerAnswers.length === 1) {
    log.debug({}, "questionUnderstanding:singleWorker:skipEvaluation");
    selectedWorkerId = workerAnswers[0].workerId;
    selectedAnswer = workerAnswers[0].answer;
  } else {
    // Try evaluator with fallbacks
    evaluation = await executeEvaluatorWithFallback(
      config.evaluator,
      question,
      workerAnswers,
      workerContext.conversationHistory
    );

    if (evaluation) {
      selectedWorkerId = evaluation.selectedWorkerId;
      selectedAnswer = evaluation.selectedAnswer;

      log.debug(
        {
          selectedWorkerId,
          rankings: evaluation.rankings?.map((r) => r.workerId),
        },
        "questionUnderstanding:reduce:complete"
      );
    } else {
      // Evaluator failed - apply fallback
      if (config.fallback.enabled) {
        const fallbackResult = applyFallback(workerAnswers, config.fallback.strategy);
        selectedWorkerId = fallbackResult.selectedWorkerId;
        selectedAnswer = fallbackResult.selectedAnswer;

        log.info(
          { fallbackStrategy: config.fallback.strategy, selectedWorkerId },
          "questionUnderstanding:fallback:applied"
        );
      } else {
        throw new Error("Evaluator failed and fallback is disabled");
      }
    }
  }

  // ========================================================================
  // Calculate totals
  // ========================================================================

  const totalProcessingTimeMs = Date.now() - startTime;

  // Aggregate token usage from all workers
  const usage: QuestionUnderstandingUsage = workerAnswers.reduce(
    (acc, worker) => ({
      totalInputTokens: acc.totalInputTokens + (worker.tokenUsage?.promptTokens ?? 0),
      totalOutputTokens: acc.totalOutputTokens + (worker.tokenUsage?.completionTokens ?? 0),
      totalTokens: acc.totalTokens + (worker.tokenUsage?.totalTokens ?? 0),
      totalCostUSD: acc.totalCostUSD + (worker.tokenUsage?.costUSD ?? 0),
    }),
    { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalCostUSD: 0 }
  );

  // ========================================================================
  // Track usage for analytics/billing (if organizationId provided)
  // ========================================================================

  if (workerContext.organizationId) {
    // Track each worker's usage
    const adapter = getUsageTrackingAdapter();
    for (const worker of workerAnswers) {
      if (worker.tokenUsage && adapter.isReady?.()) {
        adapter.recordUsage(worker.tokenUsage, {
          organizationId: workerContext.organizationId,
          service: LLM_SERVICE_NAMES.QUESTION_UNDERSTANDING,
          module: worker.workerId,
          model: worker.model,
          durationMs: worker.processingTimeMs,
        });
      }
    }
  }

  log.info(
    {
      selectedWorkerId,
      totalProcessingTimeMs,
      successfulWorkers: workerAnswers.length,
    },
    "questionUnderstanding:complete"
  );

  return {
    question,
    selectedAnswer,
    selectedWorkerId,
    evaluation: config.includeReasoningInOutput ? evaluation : undefined,
    workerAnswers,
    totalProcessingTimeMs,
    usage,
  };
}
