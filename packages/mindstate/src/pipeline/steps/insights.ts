import type { AgentInsight, StateParameter } from "@journey/schemas";
import type { AgentBatchResult, InsightsOutput, StateUpdateOutput } from "../../types";
import { generateInsightId } from "../../utils/id";

/**
 * Insights step - generates AgentInsight records from batch results
 */
export function generateInsights(
  batchResults: AgentBatchResult[],
  userState: StateParameter[],
  messageId: string,
  changes?: StateUpdateOutput["changes"]
): InsightsOutput {
  const nameById = new Map(userState.map((param) => [param.id, param.name]));
  const currentValueById = new Map(userState.map((param) => [param.id, param.currentValue]));
  const appliedChangeIds = changes ? new Set(changes.map((change) => change.parameterId)) : undefined;

  const insights: AgentInsight[] = batchResults.map((b) => {
    // Find parameters that actually changed (or were applied if changes are provided)
    const changedParams: Array<{ id: string; name: string }> = b.updates
      .filter((u) => {
        if (appliedChangeIds) {
          return appliedChangeIds.has(u.id);
        }
        const currentValue = currentValueById.get(u.id);
        return currentValue !== undefined && currentValue !== u.newValue;
      })
      .map((u) => ({
        id: u.id,
        name: nameById.get(u.id) ?? u.id,
      }));

    const insight: AgentInsight = {
      id: generateInsightId(),
      agentId: b.agent.id,
      agentName: b.agent.name,
      agentAvatar: b.agent.avatar || "Bot",
      agentColor: b.agent.color || "indigo",
      messageId,
      timestamp: Date.now(),
      analysis: b.analysis,
      updatesMade: changedParams,
    };
    return insight;
  });

  return { insights };
}
