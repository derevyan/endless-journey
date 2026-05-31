/**
 * Question Understanding Node Executor
 *
 * Synthesizes unanswered questions from conversation history using map-reduce pattern.
 * Multiple LLM workers process in parallel, then an evaluator selects the best synthesis.
 *
 * Key Feature: Sets `userMessageOverride` for automatic Agent node integration.
 * When QU node is connected to an Agent node, the Agent automatically uses
 * the synthesized question as the user message (no manual wiring needed).
 *
 * @module workflow/executors/tools/question-understanding
 */

import type {
  QuestionUnderstandingNodeConfig,
  QuestionUnderstandingConfig,
  WorkerModelConfig,
  ConversationMessage,
} from "@journey/schemas";
import { QU_WORKERS, QU_EVALUATOR } from "@journey/schemas/config";
import { executeQuestionUnderstanding } from "../../../services/question-understanding/question-understanding-service";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { BaseNodeExecutor } from "../base-executor";

/**
 * Format conversation history for the question understanding service.
 * Converts ConversationMessage[] to a string format expected by the service.
 */
function formatConversationHistory(messages: ConversationMessage[]): string {
  if (!messages || messages.length === 0) return "";
  return messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n");
}

/**
 * Question Understanding Node Executor.
 *
 * Analyzes conversation history to synthesize unanswered questions,
 * then passes the result to downstream nodes via `userMessageOverride`.
 *
 * Output:
 * - `data.userMessageOverride`: The synthesized question (for Agent auto-integration)
 * - `data[outputVariable]`: Same value under custom variable name
 * - `data[outputVariable]_metadata`: Processing metadata (if includeReasoning=true)
 */
export class QuestionUnderstandingNodeExecutor extends BaseNodeExecutor<QuestionUnderstandingNodeConfig> {
  readonly nodeType = "question_understanding";

  protected async executeNode(
    input: NodeInput,
    config: QuestionUnderstandingNodeConfig,
    context: WorkflowContext
  ): Promise<NodeOutput> {
    context.log.info(
      {
        workerCount: QU_WORKERS.length,
        outputVariable: config.outputVariable,
      },
      "workflow:question-understanding:start"
    );

    // Build full configuration from simplified node config
    const fullConfig: QuestionUnderstandingConfig = {
      workers: QU_WORKERS.map((w) => ({
        id: w.id,
        model: w.model.id,
        provider: w.model.provider,
      })) as WorkerModelConfig[],
      workerTimeoutMs: 6000,
      workersTemperature: 0.1,
      maxWorkersThreads: 6,
      evaluator: {
        model: QU_EVALUATOR.primary.id,
        temperature: QU_EVALUATOR.temperature,
        timeoutMs: QU_EVALUATOR.timeoutMs,
        backupModels: QU_EVALUATOR.backups.map((b) => b.id),
      },
      fallback: { enabled: true, strategy: "first_worker" },
      requireAllWorkers: false,
      includeReasoningInOutput: config.includeReasoning,
    };

    try {
      const result = await executeQuestionUnderstanding(input.message, fullConfig, {
        conversationHistory: formatConversationHistory(input.conversationHistory),
        organizationId: context.orgId,
      });

      // Determine output value based on result
      // Fallback to original message if no questions found
      const outputValue =
        result.selectedAnswer && result.selectedAnswer.trim() !== ""
          ? result.selectedAnswer
          : input.message;

      context.log.info(
        {
          selectedWorkerId: result.selectedWorkerId,
          processingTimeMs: result.totalProcessingTimeMs,
          hasResult: outputValue.length > 0,
        },
        "workflow:question-understanding:complete"
      );

      // Build output data
      // CRITICAL: userMessageOverride enables automatic Agent integration
      const data: Record<string, unknown> = {
        userMessageOverride: outputValue, // Magic field for Agent auto-integration
        [config.outputVariable]: outputValue, // Also store under custom variable name
      };

      // Add metadata if reasoning is enabled
      if (config.includeReasoning) {
        data[`${config.outputVariable}_metadata`] = {
          selectedWorkerId: result.selectedWorkerId,
          processingTimeMs: result.totalProcessingTimeMs,
          workerCount: result.workerAnswers.length,
          evaluation: result.evaluation,
        };
      }

      return {
        outHandle: "default",
        data,
        executionTimeMs: result.totalProcessingTimeMs,
        metadata: {
          selectedWorkerId: result.selectedWorkerId,
          usage: result.usage,
        },
      };
    } catch (error) {
      context.log.error({ err: error }, "workflow:question-understanding:failed");

      // On error, use original message as fallback (don't block the workflow)
      return {
        outHandle: "default",
        data: {
          userMessageOverride: input.message,
          [config.outputVariable]: input.message,
        },
        executionTimeMs: 0,
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }
}
