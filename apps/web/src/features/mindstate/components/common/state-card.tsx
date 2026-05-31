/**
 * State Card Component
 *
 * Unified component for displaying state parameters.
 * Supports both compact (viewer) and detailed (builder) variants.
 */

import { AlertCircle, CheckCircle2, Clock, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { AgentInsight, StateParameter } from "@journey/schemas";
import { getCategoryIcon, getSemanticValueColor } from "../../lib/colors";
import { DynamicIcon } from "./dynamic-icon";
import { InsightBadge } from "./insight-badge";
import { formatDistanceToNow } from "date-fns";

interface StateCardProps {
  parameter: StateParameter;
  /** Insights related to this parameter (for compact variant) */
  insights?: AgentInsight[];
  /** Last reasoning from parameter history (for detailed variant) */
  lastReasoning?: string;
  /** Whether the parameter is currently being updated */
  isUpdating?: boolean;
  /** Display variant: compact for viewer, detailed for builder */
  variant?: "compact" | "detailed";
}

/**
 * Get tailwind classes for semantic value visualization
 */
function getSemanticClasses(semantic: "good" | "warning" | "bad" | "neutral") {
  switch (semantic) {
    case "good":
      return {
        icon: "text-green-500",
        progressBar: "bg-green-500",
        updatePrefix: "text-green-500",
        border: "border-green-500/20",
      };
    case "warning":
      return {
        icon: "text-yellow-500",
        progressBar: "bg-yellow-500",
        updatePrefix: "text-yellow-500",
        border: "border-yellow-500/20",
      };
    case "bad":
      return {
        icon: "text-red-500",
        progressBar: "bg-red-500",
        updatePrefix: "text-red-500",
        border: "border-red-500/20",
      };
    default:
      return {
        icon: "text-blue-500",
        progressBar: "bg-blue-500",
        updatePrefix: "text-blue-500",
        border: "border-blue-500/20",
      };
  }
}

export function StateCard({ parameter, insights = [], lastReasoning, isUpdating = false, variant = "detailed" }: StateCardProps) {
  const { name, currentValue, scaleType, min = 0, max = 10, category, description } = parameter;

  // Calculate semantic color for numeric values
  const semanticValue = scaleType === "NUMERIC" ? getSemanticValueColor(currentValue as number, min, max, parameter.semanticDirection) : "neutral";

  const colorProfile = getSemanticClasses(semanticValue);

  // Get icon name from centralized utility
  const iconName = getCategoryIcon(category);

  // Compact variant (used in viewer)
  if (variant === "compact") {
    const progress = scaleType === "NUMERIC" && typeof currentValue === "number" ? ((currentValue - min) / (max - min)) * 100 : null;

    return (
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{name}</span>
          {insights.length > 0 && <InsightBadge insights={insights} variant="tooltip" />}
        </div>

        {scaleType === "NUMERIC" && progress !== null && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" indicatorClassName={colorProfile.progressBar} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{min}</span>
              <span className="font-medium">{currentValue}</span>
              <span>{max}</span>
            </div>
          </div>
        )}

        {scaleType === "CATEGORICAL" && <span className={cn("text-sm font-medium", colorProfile.icon)}>{String(currentValue)}</span>}

        {scaleType === "BOOLEAN" && (
          <span className={cn("text-sm font-medium", currentValue ? "text-green-600" : "text-red-600")}>{currentValue ? "Yes" : "No"}</span>
        )}
      </div>
    );
  }

  // Get history for tooltip
  const history = parameter.history || [];
  const hasHistory = history.length > 0;

  // Detailed variant (used in builder)
  return (
    <Card className={cn("transition-all duration-200 py-0.5 gap-0.5", isUpdating ? "opacity-50" : "opacity-100")}>
      <CardHeader className="p-2.5 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <DynamicIcon name={iconName} size={14} className={cn("shrink-0", colorProfile.icon)} />
            <h3 className="font-semibold text-foreground text-xs truncate">{name}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1.5">
            {/* History Tooltip */}
            {hasHistory && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-0.5 rounded hover:bg-muted transition-colors">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  sideOffset={8}
                  hideArrow
                  className="p-0 bg-popover text-popover-foreground border shadow-xl rounded-lg"
                >
                  <HistoryTooltip history={history} scaleType={scaleType} />
                </TooltipContent>
              </Tooltip>
            )}
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 uppercase tracking-wider font-medium">
              {category}
            </Badge>
          </div>
        </div>
        {description && (
          <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2" title={description}>
            {description}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-2.5 pt-0">
        {/* Numeric Value Display */}
        {scaleType === "NUMERIC" && <NumericValue value={currentValue as number} min={min} max={max} colorProfile={colorProfile} />}

        {/* Categorical Value Display */}
        {scaleType === "CATEGORICAL" && <CategoricalValue value={currentValue as string} options={parameter.options || []} colorProfile={colorProfile} />}

        {/* Boolean Value Display */}
        {scaleType === "BOOLEAN" && <BooleanValue value={currentValue as boolean} />}

        {/* Last Reasoning (from history) */}
        {lastReasoning && (
          <div className="mt-2 pt-1.5 border-border/30">
            <p className={cn("text-[10px] text-foreground leading-relaxed pl-1.5 border-l-2", colorProfile.border)}>
              <span className={cn("font-medium not-italic block mb-0.5", colorProfile.updatePrefix)}>Update</span>
              <span className="text-muted-foreground">{lastReasoning}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Numeric value display with progress bar
function NumericValue({ value, min, max, colorProfile }: { value: number; min: number; max: number; colorProfile: ReturnType<typeof getSemanticClasses> }) {
  const range = max - min;
  const normalizedValue = range === 0 ? 0 : ((value - min) / range) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground font-mono">{min}</span>
        <span className="text-sm font-bold text-foreground tabular-nums">{value % 1 === 0 ? value : value.toFixed(1)}</span>
        <span className="text-muted-foreground font-mono">{max}</span>
      </div>
      <Progress value={normalizedValue} className="h-1.5" indicatorClassName={colorProfile.progressBar} />
    </div>
  );
}

// Categorical value display
function CategoricalValue({ value, options, colorProfile }: { value: string; options: string[]; colorProfile: ReturnType<typeof getSemanticClasses> }) {
  return (
    <div className="space-y-2">
      <div className="text-center">
        <Badge variant="secondary" className="text-xs px-2 py-0.5 h-5">
          {value}
        </Badge>
      </div>
      <div className="flex justify-center gap-1">
        {options.map((opt) => (
          <div key={opt} className={cn("w-1.5 h-1.5 rounded-full transition-all", opt === value ? colorProfile.progressBar : "bg-muted")} title={opt} />
        ))}
      </div>
    </div>
  );
}

// Boolean value display
function BooleanValue({ value }: { value: boolean }) {
  return (
    <div className="text-center">
      <Badge variant={value ? "default" : "outline"} className="text-xs px-2 py-0.5 h-5 inline-flex items-center gap-1">
        {value ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
        <span className="uppercase text-[9px] tracking-wider">{value ? "True" : "False"}</span>
      </Badge>
    </div>
  );
}

/**
 * History Tooltip - shows recent value changes with trends
 * Enhanced design for better visibility in both light/dark modes
 */
function HistoryTooltip({
  history,
  scaleType,
}: {
  history: NonNullable<StateParameter["history"]>;
  scaleType: StateParameter["scaleType"];
}) {
  // Show last 5 changes, most recent first
  const recentHistory = [...history].reverse().slice(0, 5);

  return (
    <div className="w-72">
      {/* Header with accent background */}
      <div className="px-3 py-2.5 bg-muted/50 border-b flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Clock className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold text-foreground">Recent Updates</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{history.length} total</span>
      </div>

      {/* Entries list - scroll only if content exceeds 60% of viewport */}
      <div className="p-2.5 space-y-2.5 max-h-[60vh] overflow-y-auto">
        {recentHistory.map((entry, idx) => {
          const prevEntry = idx < recentHistory.length - 1 ? recentHistory[idx + 1] : null;
          const prevValue = prevEntry?.value;
          const isIncrease = scaleType === "NUMERIC" && typeof entry.value === "number" && typeof prevValue === "number" && entry.value > prevValue;
          const isDecrease = scaleType === "NUMERIC" && typeof entry.value === "number" && typeof prevValue === "number" && entry.value < prevValue;

          return (
            <div key={entry.timestamp}>
              {/* Value change row */}
              <div className="flex items-center gap-2">
                {/* Value pill with transition */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  {prevValue !== undefined && (
                    <span>{String(prevValue)} →</span>
                  )}
                  {String(entry.value)}
                  {isIncrease && <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
                  {isDecrease && <TrendingDown className="h-3 w-3 text-rose-600 dark:text-rose-400" />}
                </span>

                {/* Timestamp */}
                <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                  {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                </span>
              </div>

              {/* Reasoning quote */}
              {entry.reasoning && (
                <div
                  className={cn(
                    "mt-1.5 ml-1 pl-2.5 border-l-2",
                    isIncrease && "border-emerald-500/40",
                    isDecrease && "border-rose-500/40",
                    !isIncrease && !isDecrease && "border-border"
                  )}
                >
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {entry.reasoning}
                  </p>
                </div>
              )}

              {/* Divider between entries */}
              {idx < recentHistory.length - 1 && (
                <div className="mt-2.5 border-b border-border/50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
