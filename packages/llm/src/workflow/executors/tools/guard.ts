/**
 * Guard Node Executor - Safety checks using real guard service
 *
 * Integrates with evaluateGuards() from guard-service.ts for production-grade
 * parallel guard evaluation with "any blocks" strategy.
 *
 * Output handles:
 * - 'passed': All guards passed
 * - 'blocked': At least one guard blocked (only if terminateOnBlock is false)
 */

import type { GuardNodeConfig, GuardWorker } from "@journey/schemas";
import { GUARD_WORKERS, type LLMGuardWorkerConfig } from "@journey/schemas/config";
import { evaluateGuards, type GuardEvaluationResult } from "../../../services/guard-service";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { BaseNodeExecutor } from "../base-executor";

/**
 * Convert LLMGuardWorkerConfig to worker format for compatibility
 */
function convertGuardWorkerForExecutor(worker: any): Record<string, any> {
  return {
    id: worker.id,
    model: worker.model.id,
    provider: worker.model.provider,
    enabled: worker.enabled,
  };
}

/**
 * Map simple guard worker names to full worker config objects.
 *
 * Uses guard workers from config, which defines:
 * - safety: meta-llama/llama-guard-4-12b
 * - injection: meta-llama/llama-prompt-guard-2-86m
 * - policy: openai/gpt-oss-safeguard-20b
 * - spam: llama-3.1-8b-instant
 */
const GUARD_WORKER_MAP: Record<GuardWorker, Record<string, any> | undefined> = {
  safety_guard: getDefaultWorker("safety"),
  injection_guard: getDefaultWorker("injection"),
  policy_guard: getDefaultWorker("policy"),
  spam_guard: getDefaultWorker("spam"),
};

/**
 * Get default worker config by ID from GUARD_WORKERS
 */
function getDefaultWorker(id: string): Record<string, any> | undefined {
  const worker = GUARD_WORKERS.find((w) => w.id === id);
  return worker ? convertGuardWorkerForExecutor(worker) : undefined;
}

/**
 * Guard node executor.
 *
 * Runs safety checks on the input message using the real guard service.
 * Guards run in parallel with individual timeouts, using "any blocks" strategy.
 *
 * CRITICAL: If terminateOnBlock is true (default), blocked messages
 * will terminate the workflow. If false, uses 'blocked' edge.
 */
export class GuardNodeExecutor extends BaseNodeExecutor<GuardNodeConfig> {
  readonly nodeType = "guard";

  protected async executeNode(
    input: NodeInput,
    config: GuardNodeConfig,
    context: WorkflowContext
  ): Promise<NodeOutput> {
    context.log.info({ workers: config.workers }, "workflow:guard:evaluating");

    // Map simple worker names to full configs
    const workerConfigs = this.mapWorkersToConfigs(config.workers, context);

    if (workerConfigs.length === 0) {
      context.log.warn({}, "workflow:guard:noValidWorkers");
      // No valid workers - pass by default
      return {
        outHandle: "passed",
        executionTimeMs: 0,
        data: { guard_passed: true },
      };
    }

    // Evaluate guards using the real guard service
    let result: GuardEvaluationResult;
    try {
      result = await evaluateGuards({
        content: input.message,
        workers: workerConfigs,
        workerTimeoutMs: context.settings.nodeTimeoutMs,
        organizationId: context.orgId,
      });
    } catch (error) {
      context.log.error({ err: error }, "workflow:guard:evaluationFailed");
      // On service error, fail-open (pass) to avoid blocking due to guard failures
      return {
        outHandle: "passed",
        executionTimeMs: 0,
        data: { guard_passed: true, guard_error: true },
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }

    // Handle blocked content
    if (!result.allowed) {
      context.log.warn(
        {
          blockedBy: result.blockedBy,
          isSpamBlock: result.isSpamBlock,
        },
        "workflow:guard:blocked"
      );

      // CRITICAL: Handle blocking based on terminateOnBlock setting
      if (config.terminateOnBlock) {
        // Terminate workflow
        return {
          blocked: true,
          blockedMessage: config.blockedMessage,
          outHandle: "blocked", // Won't be used, but set for trace
          executionTimeMs: 0,
          metadata: {
            blockedBy: result.blockedBy,
            isSpamBlock: result.isSpamBlock,
            workerResults: result.results.map((r) => ({
              workerId: r.workerId,
              safe: r.safe,
              category: r.category,
              confidence: r.confidence,
            })),
          },
        };
      } else {
        // Use 'blocked' edge (requires edge to be defined!)
        return {
          outHandle: "blocked",
          executionTimeMs: 0,
          data: {
            guard_blocked: true,
            guard_blocked_by: result.blockedBy,
            guard_is_spam: result.isSpamBlock,
          },
          metadata: {
            blockedBy: result.blockedBy,
            isSpamBlock: result.isSpamBlock,
            workerResults: result.results.map((r) => ({
              workerId: r.workerId,
              safe: r.safe,
              category: r.category,
              confidence: r.confidence,
            })),
          },
        };
      }
    }

    // All guards passed
    context.log.info(
      {
        processingTimeMs: result.totalProcessingTimeMs,
        workerCount: result.results.length,
      },
      "workflow:guard:passed"
    );

    return {
      outHandle: "passed",
      executionTimeMs: 0,
      data: {
        guard_passed: true,
      },
      metadata: {
        processingTimeMs: result.totalProcessingTimeMs,
        workerResults: result.results.map((r) => ({
          workerId: r.workerId,
          safe: r.safe,
        })),
        usage: result.usage,
      },
    };
  }

  /**
   * Map simple guard worker names to full GuardWorkerConfig objects.
   * Filters out workers that don't have a valid mapping.
   */
  private mapWorkersToConfigs(
    workers: GuardWorker[],
    context: WorkflowContext
  ): Record<string, any>[] {
    const configs: Record<string, any>[] = [];

    for (const worker of workers) {
      const config = GUARD_WORKER_MAP[worker];
      if (config) {
        configs.push(config);
      } else {
        context.log.warn({ worker }, "workflow:guard:unknownWorker");
      }
    }

    return configs;
  }
}
