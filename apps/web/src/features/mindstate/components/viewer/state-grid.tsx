/**
 * State Grid Component
 *
 * Grid layout with category grouping for parameters.
 */
import type { AgentInsight, StateParameter } from "@journey/schemas";
import { StateCard } from "../common/state-card";

interface StateGridProps {
  parameters: StateParameter[];
  insights: AgentInsight[];
}

export function StateGrid({ parameters, insights }: StateGridProps) {
  // Group parameters by category
  const categories = [...new Set(parameters.map((p) => p.category || "General"))];

  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <div key={category}>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {category}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {parameters
              .filter((p) => (p.category || "General") === category)
              .map((param) => (
                <StateCard
                  key={param.id}
                  parameter={param}
                  insights={insights.filter((i) =>
                    i.updatesMade?.some(update => update.id === param.id)
                  )}
                  variant="compact"
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
