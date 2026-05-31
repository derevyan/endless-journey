/**
 * Matrix Grid
 *
 * Compact read-only grid showing agent × parameter assignments.
 * Clean, production-grade design with minimal padding.
 */

import { memo, Fragment } from "react";

import type { SystemAgent, StateParameter } from "@journey/schemas";
import { cn } from "@/shared/lib/utils";
import { MatrixCell } from "./matrix-cell";

interface MatrixGridProps {
  agents: SystemAgent[];
  parameters: StateParameter[];
  categories: string[];
}

export const MatrixGrid = memo(function MatrixGrid({
  agents,
  parameters,
  categories,
}: MatrixGridProps) {
  // Group parameters by category
  const groupedParams: Record<string, StateParameter[]> = {};
  for (const p of parameters) {
    const cat = p.category || "Uncategorized";
    if (!groupedParams[cat]) groupedParams[cat] = [];
    groupedParams[cat].push(p);
  }

  // Only show categories that have parameters, in order
  const sortedCategories = categories.filter((c) => groupedParams[c]?.length > 0);
  // Add any uncategorized at the end
  if (groupedParams["Uncategorized"]?.length > 0 && !sortedCategories.includes("Uncategorized")) {
    sortedCategories.push("Uncategorized");
  }

  return (
    <table className="border-collapse text-xs">
      {/* Header row with agent names */}
      <thead className="bg-muted/50">
        <tr>
          {/* Parameter column header */}
          <th
            className={cn(
              "sticky left-0 top-0 z-20",
              "bg-muted/50",
              "py-2 px-3",
              "border-b border-r border-border",
              "text-left font-semibold text-foreground/70 text-[10px] uppercase tracking-wide"
            )}
          >
            Parameter
          </th>

          {/* Agent column headers */}
          {agents.map((agent, idx) => (
            <th
              key={agent.id}
              className={cn(
                "sticky top-0 z-10",
                "bg-muted/50",
                "py-2 px-3",
                "border-b border-border",
                idx < agents.length - 1 && "border-r border-border/40",
                "text-center font-semibold text-foreground/70"
              )}
            >
              <span className="block text-[10px] whitespace-nowrap uppercase tracking-wide">
                {agent.name}
              </span>
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {sortedCategories.map((category, catIdx) => (
          <Fragment key={`cat-${category}`}>
            {/* Category header row */}
            <tr className="bg-muted/20">
              <td
                colSpan={agents.length + 1}
                className={cn(
                  "py-1.5 px-3",
                  "text-[9px] font-bold uppercase tracking-widest",
                  "text-muted-foreground/60",
                  "border-b border-border/40",
                  catIdx > 0 && "border-t border-border/30"
                )}
              >
                {category}
              </td>
            </tr>

            {/* Parameter rows */}
            {groupedParams[category]?.map((param, paramIdx) => (
              <tr
                key={param.id}
                className={cn(
                  "transition-colors",
                  "hover:bg-accent/5",
                  paramIdx % 2 === 0 ? "bg-background" : "bg-muted/5"
                )}
              >
                {/* Parameter name - sticky left */}
                <td
                  className={cn(
                    "sticky left-0 z-10",
                    paramIdx % 2 === 0 ? "bg-background" : "bg-muted/5",
                    "py-1.5 px-3",
                    "border-r border-b border-border/30",
                    "font-medium text-foreground/80 text-xs whitespace-nowrap"
                  )}
                >
                  {param.name}
                </td>

                {/* Assignment cells */}
                {agents.map((agent, agentIdx) => (
                  <MatrixCell
                    key={`${agent.id}-${param.id}`}
                    agentId={agent.id}
                    parameterId={param.id}
                    isAssigned={param.responsibleAgentId === agent.id}
                    isLastColumn={agentIdx === agents.length - 1}
                  />
                ))}
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
});
