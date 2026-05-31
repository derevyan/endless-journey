/**
 * Insight Badge Component
 *
 * Unified component for displaying agent insights.
 * Supports both count (builder) and tooltip (viewer) variants.
 */

import { Sparkles, Zap } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { AgentInsight } from "@journey/schemas";
import { getAgentColorClasses } from "../../lib/colors";
import { DynamicIcon } from "./dynamic-icon";

interface InsightBadgeProps {
  /** Single insight (for counts variant) */
  insight?: AgentInsight;
  /** Multiple insights (for tooltip variant) */
  insights?: AgentInsight[];
  /** Display variant: counts for builder, tooltip for viewer */
  variant?: "counts" | "tooltip";
}

export function InsightBadge({
  insight,
  insights = [],
  variant = "counts",
}: InsightBadgeProps) {
  // Tooltip variant - shows sparkle icon with hover details
  if (variant === "tooltip") {
    if (!insights.length) return null;

    const latestInsight = insights[0];

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-1 rounded hover:bg-muted">
            <Sparkles className="h-3 w-3 text-amber-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-medium text-xs">{latestInsight.agentName}</div>
            {latestInsight.analysis && latestInsight.analysis.length > 0 && (
              <ul className="text-xs space-y-0.5">
                {latestInsight.analysis.map((item, i) => (
                  <li key={i}>- {item}</li>
                ))}
              </ul>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Counts variant - shows agent badge with analysis and updates counts
  if (!insight) return null;

  const theme = getAgentColorClasses(insight.agentColor || "indigo");

  return (
    <Badge
      variant="outline"
      className={cn("cursor-pointer gap-2", theme.border, theme.ring)}
    >
      <DynamicIcon
        name={insight.agentAvatar}
        size={14}
        className={theme.text}
      />
      <span className="text-xs">{insight.agentName}</span>

      {insight.analysis.length > 0 && (
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          {insight.analysis.length}
        </Badge>
      )}

      {insight.updatesMade.length > 0 && (
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          <Zap size={12} className="text-sky-500 mr-0.5" />
          {insight.updatesMade.length}
        </Badge>
      )}
    </Badge>
  );
}
