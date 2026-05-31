/**
 * State Grid
 *
 * Grid layout for displaying state cards.
 */

import type { StateParameter } from "@journey/schemas";
import { StateCard } from "../../common/state-card";

interface StateGridProps {
  parameters: StateParameter[];
  activeUpdates: Set<string>;
}

export function StateGrid({ parameters, activeUpdates }: StateGridProps) {
  return (
    <div className="grid gap-3">
      {parameters.map((param) => {
        // Get the most recent reasoning from history (last entry)
        const lastReasoning = param.history?.length > 0 ? param.history[param.history.length - 1]?.reasoning : undefined;

        return <StateCard key={param.id} parameter={param} lastReasoning={lastReasoning} isUpdating={activeUpdates.has(param.id)} variant="detailed" />;
      })}
    </div>
  );
}
