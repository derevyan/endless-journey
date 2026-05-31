/**
 * LLM Guard Service
 *
 * Evaluates content safety using specialized guard models.
 * Follows the Question Understanding worker pattern:
 * - Guards defined as { id, model, provider }
 * - Parallel execution via Promise.all()
 * - If ANY guard blocks, request is denied
 *
 * Available guards (via llmConfig.guards.workers):
 * - safety: meta-llama/llama-guard-4-12b - Violence, hate, sexual, illegal
 * - policy: openai/gpt-oss-safeguard-20b - Policy violations
 * - injection: meta-llama/llama-prompt-guard-2-86m - Prompt injection attacks
 * - spam: llama-3.1-8b-instant - Spam, advertising, scams (few-shot)
 */

import { createLogger, serializeError } from "@journey/logger";
import { GUARD_WORKERS, GUARDS_CONFIG, type LLMGuardWorkerConfig } from "@journey/schemas/config";
import type { TokenUsage } from "@journey/schemas";
import { LLM_SERVICE_NAMES } from "@journey/schemas";
import { generateChatResponse, type LLMConfig } from "./llm-service";
import { getUsageTrackingAdapter } from "../adapters/usage-tracking-context";

const log = createLogger("llm:guard-service");

// ============================================================================
// Types
// ============================================================================

export interface GuardWorkerResult {
  /** Worker ID (e.g., "safety", "spam", "injection") */
  workerId: string;
  /** Model used */
  model: string;
  /** Whether content was deemed safe */
  safe: boolean;
  /** Category of violation if unsafe (e.g., "violence", "spam") */
  category?: string;
  /** Confidence score 0-1 if available */
  confidence?: number;
  /** Processing time for this worker */
  processingTimeMs: number;
  /** Token usage for this worker */
  tokenUsage?: TokenUsage;
  /** Raw response from guard model */
  rawResponse?: string;
  /** Error message if evaluation failed */
  error?: string;
}

export interface GuardEvaluationResult {
  /** Whether content is allowed (all guards passed) */
  allowed: boolean;
  /** Individual results from each guard worker */
  results: GuardWorkerResult[];
  /** Which worker IDs blocked the content */
  blockedBy?: string[];
  /** Was it specifically a spam block? (for message selection) */
  isSpamBlock?: boolean;
  /** Total evaluation time in milliseconds */
  totalProcessingTimeMs: number;
  /** Aggregated usage stats across all workers */
  usage?: {
    totalTokens: number;
    totalCostUSD: number;
  };
}

export interface GuardEvaluationOptions {
  /** Guard workers to use (defaults to llmConfig.guards.workers) */
  workers?: Record<string, any>[];
  /** Timeout per guard call in milliseconds */
  workerTimeoutMs?: number;
  /** User message to evaluate */
  content: string;
  /** Optional conversation context for better evaluation */
  conversationContext?: string;
  /** Organization ID for usage tracking (optional) */
  organizationId?: string;
}

// ============================================================================
// Guard Prompt Lookup
// ============================================================================

/**
 * Get system prompt for a guard worker by ID
 * Prompts are co-located with guard configs in GUARD_WORKERS
 */
function getGuardPrompt(workerId: string): string {
  const worker = GUARD_WORKERS.find((w) => w.id === workerId);
  if (!worker) {
    return `Evaluate if this user message is safe and appropriate.
Respond with JSON only, no markdown: {"safe": true} or {"safe": false, "category": "category_name"}`;
  }
  return worker.systemPrompt;
}

/**
 * Text classification models require special handling:
 * - No system prompt allowed
 * - Single user message containing ONLY the text to classify
 *
 * These models return classification directly (e.g., "safe"/"unsafe")
 */
const TEXT_CLASSIFICATION_MODELS = [
  "meta-llama/llama-prompt-guard-2-86m",
  "meta-llama/llama-prompt-guard-2-22m",
];

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse text classification model response (e.g., llama-prompt-guard)
 *
 * These models can return:
 * 1. A probability score (0.0-1.0) - higher = more likely malicious
 * 2. Simple labels like "safe"/"unsafe"/"INJECTION"
 *
 * For probability scores:
 * - Score < 0.5 = safe
 * - Score >= 0.5 = potential injection attack
 */
function parseTextClassificationResponse(
  response: string,
  workerId: string
): Omit<GuardWorkerResult, "workerId" | "model" | "processingTimeMs"> {
  const trimmed = response.trim().toLowerCase();

  // Check if response is a probability score (e.g., "0.9994173049926758")
  const probScore = parseFloat(trimmed);
  if (!isNaN(probScore) && probScore >= 0 && probScore <= 1) {
    // Probability score: higher = more likely malicious
    const isSafe = probScore < 0.5;
    return {
      safe: isSafe,
      category: isSafe ? undefined : "prompt_injection",
      confidence: isSafe ? 1 - probScore : probScore,
      rawResponse: response,
    };
  }

  // Text classification models return simple labels
  if (trimmed === "safe" || trimmed === "benign") {
    return { safe: true, rawResponse: response };
  }

  // Unsafe classifications: "unsafe", "INJECTION", "jailbreak", etc.
  if (
    trimmed.includes("unsafe") ||
    trimmed.includes("injection") ||
    trimmed.includes("jailbreak") ||
    trimmed.includes("malicious")
  ) {
    return {
      safe: false,
      category: "prompt_injection",
      rawResponse: response,
    };
  }

  // Unknown response - fail-open (mark as safe)
  log.warn({ workerId, response }, "guard:textClassification:unknownResponse");
  return { safe: true, rawResponse: response };
}

/**
 * Parse guard model response to extract safety decision
 * Handles various response formats and edge cases
 */
function parseGuardResponse(
  response: string,
  workerId: string
): Omit<GuardWorkerResult, "workerId" | "model" | "processingTimeMs"> {
  try {
    // Try to extract JSON from response (handles markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        safe: parsed.safe === true,
        category: parsed.category || undefined,
        confidence:
          typeof parsed.confidence === "number" ? parsed.confidence : undefined,
        rawResponse: response,
      };
    }

    // Fallback: look for safety keywords
    const lowerResponse = response.toLowerCase();
    const isUnsafe =
      lowerResponse.includes("unsafe") ||
      lowerResponse.includes('"safe": false') ||
      lowerResponse.includes('"safe":false');

    return {
      safe: !isUnsafe,
      rawResponse: response,
    };
  } catch (err) {
    log.warn(
      { workerId, response, err: serializeError(err) },
      "guard:parseError"
    );
    // On parse error, fail-open (mark as safe) to avoid false blocks
    return {
      safe: true,
      rawResponse: response,
      error: "Failed to parse guard response",
    };
  }
}

// ============================================================================
// Single Guard Worker Evaluation
// ============================================================================

/**
 * Evaluate a single guard worker against content
 *
 * Handles two types of guard models:
 * 1. Standard chat models - use system prompt + user message
 * 2. Text classification models - single user message only (no system prompt)
 */
async function evaluateGuardWorker(
  worker: Record<string, any>,
  content: string,
  timeoutMs: number
): Promise<GuardWorkerResult> {
  const startTime = Date.now();
  const isTextClassificationModel = TEXT_CLASSIFICATION_MODELS.includes(worker.model);

  const config: LLMConfig = {
    model: worker.model,
    provider: worker.provider,
    temperature: 0, // Deterministic responses for consistent classification
    timeout: Math.ceil(timeoutMs / 1000),
    maxRetries: 1, // Quick fail - don't retry guards to avoid latency
  };

  try {
    let response: { result: string; tokenUsage?: TokenUsage };

    if (isTextClassificationModel) {
      // Text classification models: single user message, no system prompt
      // These models are specifically trained for classification and don't need instructions
      response = await generateChatResponse(
        "", // No system prompt for text classification models
        [{ role: "user", content }], // Send content directly without "Evaluate this:" wrapper
        config
      );
    } else {
      // Standard chat models: use system prompt with instructions
      const systemPrompt = getGuardPrompt(worker.id);
      response = await generateChatResponse(
        systemPrompt,
        [{ role: "user", content: `Evaluate this message:\n\n${content}` }],
        config
      );
    }

    const processingTimeMs = Date.now() - startTime;

    // Use appropriate parser based on model type
    const result = isTextClassificationModel
      ? parseTextClassificationResponse(response.result, worker.id)
      : parseGuardResponse(response.result, worker.id);

    log.debug(
      {
        workerId: worker.id,
        model: worker.model,
        safe: result.safe,
        category: result.category,
        processingTimeMs,
        tokens: response.tokenUsage?.totalTokens,
        cost: response.tokenUsage?.costUSD,
        isTextClassificationModel,
      },
      "guard:worker:complete"
    );

    return {
      workerId: worker.id,
      model: worker.model,
      processingTimeMs,
      tokenUsage: response.tokenUsage,
      ...result,
    };
  } catch (err) {
    const processingTimeMs = Date.now() - startTime;
    log.error(
      { workerId: worker.id, model: worker.model, processingTimeMs, err: serializeError(err) },
      "guard:worker:failed"
    );
    // On error, fail-open (mark as safe) to avoid blocking due to guard failures
    return {
      workerId: worker.id,
      model: worker.model,
      processingTimeMs,
      safe: true,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ============================================================================
// Main Evaluation Function
// ============================================================================

/**
 * Evaluate content with multiple guard workers in parallel
 *
 * Uses "any blocks" strategy - if ANY guard says unsafe, content is blocked.
 * Guards are executed in parallel for speed with individual timeouts.
 *
 * @param options - Evaluation options including workers, timeout, and content
 * @returns Aggregated evaluation result
 *
 * @example
 * ```typescript
 * const result = await evaluateGuards({
 *   content: "User message to evaluate",
 * });
 *
 * if (!result.allowed) {
 *   const message = result.isSpamBlock
 *     ? "I'm here to help with genuine questions."
 *     : "I cannot help with that request.";
 * }
 * ```
 */
/**
 * Convert LLMGuardWorkerConfig to the expected worker format
 */
function convertGuardWorker(worker: LLMGuardWorkerConfig): Record<string, any> {
  return {
    id: worker.id,
    model: worker.model.id,
    provider: worker.model.provider,
    enabled: worker.enabled,
  };
}

export async function evaluateGuards(
  options: GuardEvaluationOptions
): Promise<GuardEvaluationResult> {
  const {
    workers = GUARD_WORKERS.map(convertGuardWorker),
    workerTimeoutMs = GUARDS_CONFIG.workerTimeoutMs,
    content,
    conversationContext,
    organizationId,
  } = options;
  const startTime = Date.now();

  // Filter to enabled workers only
  const enabledWorkers = workers.filter((w) => w.enabled !== false);

  if (enabledWorkers.length === 0) {
    return {
      allowed: true,
      results: [],
      totalProcessingTimeMs: 0,
    };
  }

  log.debug(
    {
      workerCount: enabledWorkers.length,
      workers: enabledWorkers.map((w) => w.id),
      contentLength: content.length,
      hasContext: !!conversationContext,
    },
    "guard:evaluation:start"
  );

  // Prepare full content with context if provided
  const fullContent = conversationContext
    ? `Conversation context:\n${conversationContext}\n\nCurrent message:\n${content}`
    : content;

  // Execute all guard workers in parallel with individual timeouts
  const workerPromises = enabledWorkers.map((worker) =>
    Promise.race([
      evaluateGuardWorker(worker, fullContent, workerTimeoutMs),
      new Promise<GuardWorkerResult>((resolve) =>
        setTimeout(
          () =>
            resolve({
              workerId: worker.id,
              model: worker.model,
              processingTimeMs: workerTimeoutMs,
              safe: true, // Fail-open on timeout
              error: "Timeout",
            }),
          workerTimeoutMs
        )
      ),
    ])
  );

  const results = await Promise.all(workerPromises);
  const totalProcessingTimeMs = Date.now() - startTime;

  // "Any blocks" strategy - find any unsafe results
  const blockedResults = results.filter((r) => !r.safe);
  const blockedBy = blockedResults.map((r) => r.workerId);
  const isSpamBlock = blockedResults.some((r) => r.workerId === "spam");
  const allowed = blockedResults.length === 0;

  // Aggregate usage across all workers
  const totalTokens = results.reduce((sum, r) => sum + (r.tokenUsage?.totalTokens ?? 0), 0);
  const totalCostUSD = results.reduce((sum, r) => sum + (r.tokenUsage?.costUSD ?? 0), 0);
  const usage = totalTokens > 0 ? { totalTokens, totalCostUSD } : undefined;

  // Track usage for analytics/billing (if organizationId provided)
  if (organizationId) {
    const adapter = getUsageTrackingAdapter();
    for (const result of results) {
      if (result.tokenUsage && adapter.isReady?.()) {
        adapter.recordUsage(result.tokenUsage, {
          organizationId,
          service: LLM_SERVICE_NAMES.GUARD_SERVICE,
          module: result.workerId,
          model: result.model,
          durationMs: result.processingTimeMs,
        });
      }
    }
  }

  log.info(
    {
      allowed,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
      isSpamBlock: isSpamBlock || undefined,
      totalProcessingTimeMs,
      totalTokens: usage?.totalTokens,
      totalCostUSD: usage?.totalCostUSD,
      workerCount: enabledWorkers.length,
      workerResults: results.map((r) => ({
        workerId: r.workerId,
        safe: r.safe,
        category: r.category,
        tokens: r.tokenUsage?.totalTokens,
        error: r.error,
      })),
    },
    "guard:evaluation:complete"
  );

  return {
    allowed,
    results,
    blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
    isSpamBlock: isSpamBlock || undefined,
    totalProcessingTimeMs,
    usage,
  };
}
