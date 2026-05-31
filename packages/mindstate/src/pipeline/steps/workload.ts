import type { StateParameter, SystemAgent } from "@journey/schemas";
import type { WorkloadOutput } from "../../types";

/**
 * Workload step - assigns parameters to responsible agents
 */
export function assignWorkload(
  userState: StateParameter[],
  systemAgents: SystemAgent[],
  fallbackAgentId: string = "general_agent"
): WorkloadOutput {
  const agentWorkload = new Map<string, StateParameter[]>();

  userState.forEach((param) => {
    const agentId = param.responsibleAgentId || fallbackAgentId;
    // Validate agent exists, fallback to first agent if not
    const assignedAgent = systemAgents.find((a) => a.id === agentId) || systemAgents[0];
    const validId = assignedAgent.id;

    if (!agentWorkload.has(validId)) {
      agentWorkload.set(validId, []);
    }
    agentWorkload.get(validId)!.push(param);
  });

  return {
    agentWorkload,
    agentCount: agentWorkload.size,
  };
}
