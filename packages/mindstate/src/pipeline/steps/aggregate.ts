import { createLogger } from "@journey/logger";
import type { StateParameter } from "@journey/schemas";
import type { AgentBatchResult, AggregateOutput, ParameterUpdate } from "../../types";

const log = createLogger("mindstate:aggregate");

/**
 * Aggregate step - flattens all agent updates and detects conflicts
 * Uses last-wins strategy for conflicting updates
 */
export function aggregateResults(batchResults: AgentBatchResult[], userState: StateParameter[]): AggregateOutput {
  // Group updates by parameter ID for conflict detection
  const updatesByParamId = new Map<string, ParameterUpdate[]>();

  for (const result of batchResults) {
    for (const update of result.updates) {
      const existing = updatesByParamId.get(update.id) || [];
      existing.push(update);
      updatesByParamId.set(update.id, existing);
    }
  }

  // Detect conflicts and apply last-wins strategy
  const conflicts: AggregateOutput["conflicts"] = [];
  const flatUpdates: ParameterUpdate[] = [];

  for (const [paramId, updates] of updatesByParamId) {
    if (updates.length > 1) {
      // Conflict detected: multiple agents tried to update the same parameter
      const agentIds = updates.map(u => u.agentId);
      const selectedUpdate = updates[updates.length - 1]; // Last-wins
      const param = userState.find(p => p.id === paramId);

      conflicts.push({
        parameterId: paramId,
        parameterName: param?.name || paramId, // Use real name if found, fallback to ID
        agentIds,
        selectedAgentId: selectedUpdate.agentId,
      });

      log.warn(
        {
          parameterId: paramId,
          agentCount: updates.length,
          agents: agentIds,
          winner: selectedUpdate.agentId,
        },
        "mindstate:aggregate:conflict"
      );
    }

    // Add the final update (last one wins)
    flatUpdates.push(updates[updates.length - 1]);
  }

  if (conflicts.length > 0) {
    log.info(
      { conflictCount: conflicts.length },
      "mindstate:aggregate:conflictsResolved"
    );
  }

  return {
    flatUpdates,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  };
}
