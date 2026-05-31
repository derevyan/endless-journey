import { createLogger, serializeError } from "@journey/logger";
import { ValidationError, addTokenUsage, emptyTokenUsage } from "@journey/schemas";
import type { PipelineMetrics } from "@journey/schemas";
import type { PipelineInput, PipelineOptions, PipelineResult, PipelineError } from "../types";
import { ingestMessage } from "./steps/ingest";
import { prepareContext } from "./steps/context";
import { assignWorkload } from "./steps/workload";
import { dispatchAgents } from "./steps/dispatch";
import { aggregateResults } from "./steps/aggregate";
import { generateInsights } from "./steps/insights";
import { applyStateUpdates } from "./steps/state-update";
import { generateResponse } from "./steps/response";
import { validatePipelineContext } from "./validation";

const log = createLogger("mindstate:pipeline");

const DEFAULT_OPTIONS: Required<Omit<PipelineOptions, "hooks">> & { hooks: NonNullable<PipelineOptions["hooks"]> } = {
  contextMessageLimit: 20,
  insightsLimit: 50,
  hooks: {},
  fallbackAgentId: "general_agent",
};

/**
 * Creates an ECS pipeline executor with optional configuration
 */
export function createPipeline(options: PipelineOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options, hooks: { ...DEFAULT_OPTIONS.hooks, ...options.hooks } };
  const hooks = opts.hooks;

  /**
   * Execute the full ECS pipeline
   */
  async function execute(input: PipelineInput): Promise<PipelineResult> {
    const { userMessage, context: ctx } = input;
    const startTime = Date.now();
    let currentStep = "unknown";

    // Helper to track step timing
    const runStep = async <T>(stepName: string, fn: () => T | Promise<T>): Promise<T> => {
      hooks.onStepStart?.(stepName);
      const start = Date.now();
      const result = await fn();
      const duration = Date.now() - start;
      hooks.onStepComplete?.(stepName, duration);
      log.debug({ step: stepName, durationMs: duration }, "mindstate:pipeline:stepComplete");
      return result;
    };

    log.info(
      {
        agentCount: ctx.systemAgents.length,
        paramCount: ctx.userState.length,
      },
      "mindstate:pipeline:start"
    );

    try {
      // Validate pipeline context before execution
      try {
        validatePipelineContext(ctx);
      } catch (error) {
        if (error instanceof ValidationError) {
          log.error(
            { err: serializeError(error), field: (error as any).field },
            "mindstate:pipeline:validationFailed"
          );
        }
        throw error;
      }

      // 1. Ingest Message
      currentStep = "ingest";
      const { message } = await runStep("ingest", () => ingestMessage(userMessage));

      // 2. Prepare Context
      currentStep = "context";
      const { conversationContext } = await runStep("context", () =>
        prepareContext(ctx.messages, opts.contextMessageLimit)
      );

      // 3. Assign Workload
      currentStep = "workload";
      const workloadOutput = await runStep("workload", () =>
        assignWorkload(ctx.userState, ctx.systemAgents, opts.fallbackAgentId)
      );

      // 4. Dispatch to Agents (parallel)
      currentStep = "dispatch";
      const dispatchOutput = await runStep("dispatch", () =>
        dispatchAgents(workloadOutput, ctx.systemAgents, userMessage, conversationContext, hooks)
      );

      // Record agent completions
      for (const result of dispatchOutput.batchResults) {
        hooks.onAgentComplete?.(result.agent.id, result.updates.length);
      }

      // 5. Aggregate Results
      currentStep = "aggregate";
      const aggregateOutput = await runStep("aggregate", () => aggregateResults(dispatchOutput.batchResults, ctx.userState));

      // 6. Apply State Updates
      currentStep = "state-update";
      const { updatedState, changes } = await runStep("state-update", () =>
        applyStateUpdates(ctx.userState, aggregateOutput.flatUpdates)
      );

      // 7. Generate Insights (based on applied changes)
      currentStep = "insights";
      const { insights: newInsights } = await runStep("insights", () =>
        generateInsights(dispatchOutput.batchResults, ctx.userState, message.id, changes)
      );

      // 8. Generate Main Agent Response
      currentStep = "response";
      const { assistantMessage, tokenUsage: mainAgentTokenUsage, error: mainAgentError } = await runStep("response", () =>
        generateResponse(ctx.messages, message, updatedState, ctx.mainAgent)
      );

      // Aggregate token usage from all LLM calls
      let totalTokenUsage = emptyTokenUsage();
      let llmCallCount = 0;
      const perAgentUsage: Array<{
        agentId: string;
        agentName: string;
        tokenUsage: ReturnType<typeof emptyTokenUsage>;
      }> = [];

      for (const result of dispatchOutput.batchResults) {
        if (result.tokenUsage) {
          totalTokenUsage = addTokenUsage(totalTokenUsage, result.tokenUsage);
          perAgentUsage.push({
            agentId: result.agent.id,
            agentName: result.agent.name,
            tokenUsage: result.tokenUsage,
          });
          llmCallCount++;
        }
      }

      if (mainAgentTokenUsage) {
        totalTokenUsage = addTokenUsage(totalTokenUsage, mainAgentTokenUsage);
        llmCallCount++;
      }

      const pipelineMetrics: PipelineMetrics = {
        durationMs: Date.now() - startTime,
        agentCount: workloadOutput.agentCount,
        parameterCount: ctx.userState.length,
        changesCount: changes.length,
        tokenUsage: totalTokenUsage,
        llmCallCount,
        ...(perAgentUsage.length > 0 && { perAgentUsage }),
      };

      const result: PipelineResult = {
        userMessage: message,
        assistantMessage,
        updatedState,
        newInsights: newInsights.slice(0, opts.insightsLimit),
        changes,
        metrics: pipelineMetrics,
        failedAgents: dispatchOutput.failedAgents,
        partialSuccess: dispatchOutput.partialSuccess,
        allAgentsFailed: dispatchOutput.allAgentsFailed,
        conflicts: aggregateOutput.conflicts,
        mainAgentError,
      };

      log.info(
        {
          durationMs: pipelineMetrics.durationMs,
          changes: changes.length,
        },
        "mindstate:pipeline:complete"
      );

      return result;
    } catch (error) {
      const pipelineError: PipelineError = {
        step: currentStep,
        error: error instanceof Error ? error : new Error(String(error)),
        partial: {
          metrics: {
            durationMs: Date.now() - startTime,
            agentCount: 0,
            parameterCount: ctx.userState.length,
            changesCount: 0,
          },
        },
      };

      log.error(
        {
          step: currentStep,
          err: serializeError(pipelineError.error),
        },
        "mindstate:pipeline:failed"
      );

      hooks.onError?.(pipelineError);
      throw pipelineError;
    }
  }

  return { execute };
}

/**
 * Convenience export for direct execution
 */
export async function executePipeline(input: PipelineInput, options?: PipelineOptions): Promise<PipelineResult> {
  const pipeline = createPipeline(options);
  return pipeline.execute(input);
}

/**
 * Type guard for PipelineError
 */
export function isPipelineError(error: unknown): error is PipelineError {
  return typeof error === "object" && error !== null && "step" in error && "error" in error;
}
