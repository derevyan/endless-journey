import { createLogger, serializeError } from "@journey/logger";
import type { StateParameter, SystemAgent } from "@journey/schemas";
import type { AgentBatchResult, DispatchOutput, WorkloadOutput, PipelineHooks } from "../../types";
import { updateAgentStateBatch } from "../../llm/agent-service";

const log = createLogger("mindstate:dispatch");

/**
 * Result of a single agent dispatch attempt
 */
interface AgentDispatchAttempt {
  agentId: string;
  agent: SystemAgent;
  params: StateParameter[];
}

/**
 * Dispatch step - runs all agents in parallel with partial success support
 *
 * Uses Promise.allSettled to ensure that a single agent failure
 * doesn't cause the entire pipeline to fail.
 */
export async function dispatchAgents(
  workload: WorkloadOutput,
  systemAgents: SystemAgent[],
  userMessage: string,
  conversationContext: string,
  hooks?: Pick<PipelineHooks, "onAgentProcessing">
): Promise<DispatchOutput> {
  // Build dispatch attempts
  const attempts: AgentDispatchAttempt[] = Array.from(workload.agentWorkload.entries())
    .map(([agentId, params]) => {
      const agent = systemAgents.find((a) => a.id === agentId);
      if (!agent) {
        log.warn({ agentId }, "mindstate:dispatch:agentNotFound");
        return null;
      }
      return { agentId, agent, params };
    })
    .filter((a): a is AgentDispatchAttempt => a !== null);

  // Dispatch all agents in parallel with allSettled
  const results = await Promise.allSettled(
    attempts.map(async ({ agent, params }): Promise<AgentBatchResult> => {
      hooks?.onAgentProcessing?.(agent.id, agent.name);
      const result = await updateAgentStateBatch(agent, params, userMessage, conversationContext);
      return {
        agent,
        analysis: result.analysis,
        updates: result.updates,
        tokenUsage: result.tokenUsage,
      };
    })
  );

  // Process results - collect successes and failures
  const batchResults: AgentBatchResult[] = [];
  const failedAgents: DispatchOutput["failedAgents"] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const attempt = attempts[i];

    if (result.status === "fulfilled") {
      // Inject agent identity into updates
      const updatesWithAgent = result.value.updates.map(update => ({
        ...update,
        agentId: attempt.agent.id,
        agentName: attempt.agent.name,
      }));

      batchResults.push({
        ...result.value,
        updates: updatesWithAgent,
      });
    } else {
      const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      log.error(
        {
          agentId: attempt.agentId,
          agentName: attempt.agent.name,
          err: serializeError(error),
        },
        "mindstate:dispatch:agentFailed"
      );

      failedAgents.push({
        agentId: attempt.agentId,
        agentName: attempt.agent.name,
        error,
        affectedParams: attempt.params.map((p) => p.id),
      });
    }
  }

  // Log summary
  if (failedAgents.length > 0) {
    log.warn(
      {
        succeeded: batchResults.length,
        failed: failedAgents.length,
        total: attempts.length,
      },
      "mindstate:dispatch:partialSuccess"
    );
  }

  const allAgentsFailed = attempts.length > 0 && batchResults.length === 0;

  if (allAgentsFailed) {
    log.error(
      { totalAgents: attempts.length, failedAgents: failedAgents.length },
      "mindstate:dispatch:allAgentsFailed"
    );
  }

  return {
    batchResults,
    failedAgents: failedAgents.length > 0 ? failedAgents : undefined,
    partialSuccess: failedAgents.length > 0 && batchResults.length > 0,
    allAgentsFailed,
  };
}
