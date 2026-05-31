/**
 * System Agent List
 *
 * Displays a list of system agents with edit functionality.
 */

import { Pencil } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import type { SystemAgent } from "@journey/schemas";
import { getAgentColorClasses } from "../../../lib/colors";
import { DynamicIcon } from "../../common/dynamic-icon";

interface SystemAgentListProps {
  agents: SystemAgent[];
  onAgentClick: (agent: SystemAgent) => void;
}

export function SystemAgentList({ agents, onAgentClick }: SystemAgentListProps) {
  if (agents.length === 0) {
    return <div className="px-1.5 py-3 text-center text-xs text-muted-foreground">No sub-agents configured</div>;
  }

  return (
    <div className="space-y-0.5 px-0.5">
      {agents.map((agent) => {
        const theme = getAgentColorClasses(agent.color);

        return (
          <div
            key={agent.id}
            className="group relative flex items-center justify-between px-1.5 py-1 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => onAgentClick(agent)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAgentClick(agent);
              }
            }}
          >
            <div className="flex items-center gap-2">
              <div className={cn("size-7 rounded-md flex items-center justify-center border", theme.softBg, theme.border, theme.text)}>
                <DynamicIcon name={agent.avatar} size={16} className={theme.text} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className={cn("text-sm font-medium truncate", theme.text)}>{agent.name}</span>
                <span className="text-xs text-muted-foreground truncate">{agent.role}</span>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onAgentClick(agent);
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:text-primary rounded text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
            >
              <Pencil size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
