import type { StateParameter } from "@journey/schemas";
import type { AggregateOutput, StateUpdateOutput } from "../../types";

/**
 * Check if an update should be applied based on hysteresis policy
 * Hysteresis prevents small fluctuations from triggering updates
 */
function shouldApplyUpdate(
  currentValue: string | number | boolean,
  newValue: string | number | boolean,
  param: StateParameter
): boolean {
  const policy = param.updatePolicy;

  // No policy or no hysteresis - always update
  if (!policy?.hysteresis) {
    return true;
  }

  // Hysteresis only applies to NUMERIC values
  if (param.scaleType !== "NUMERIC") {
    return true;
  }

  // Type guard for numeric values
  if (typeof currentValue !== "number" || typeof newValue !== "number") {
    return true;
  }

  // Calculate if change exceeds hysteresis threshold
  const delta = Math.abs(newValue - currentValue);
  const range = (param.max ?? 10) - (param.min ?? 0);

  // Avoid division by zero
  if (range <= 0) {
    return true;
  }

  const changeRatio = delta / range;
  return changeRatio >= policy.hysteresis;
}

/**
 * State update step - applies updates to state parameters
 * Implements UpdatePolicy enforcement (hysteresis)
 */
export function applyStateUpdates(
  userState: StateParameter[],
  flatUpdates: AggregateOutput["flatUpdates"]
): StateUpdateOutput {
  const changes: StateUpdateOutput["changes"] = [];

  const updatedState = userState.map((state) => {
    const update = flatUpdates.find((u) => u.id === state.id);

    if (update && update.newValue !== state.currentValue) {
      // Check if update passes hysteresis threshold
      if (!shouldApplyUpdate(state.currentValue, update.newValue, state)) {
        // Update blocked by hysteresis - skip this change
        return state;
      }

      changes.push({
        parameterId: state.id,
        parameterName: state.name,
        oldValue: state.currentValue,
        newValue: update.newValue,
        reasoning: update.reasoning,
        agentId: update.agentId,
      });

      const newHistory = [
        ...state.history,
        {
          timestamp: Date.now(),
          value: update.newValue,
          reasoning: update.reasoning,
        },
      ];

      return {
        ...state,
        currentValue: update.newValue,
        history: newHistory,
      };
    }
    return state;
  });

  return { updatedState, changes };
}
