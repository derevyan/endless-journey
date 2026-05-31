/**
 * Node Outputs Panel
 *
 * Displays node execution outputs from the session.
 * Useful for debugging webhooks, conditions, agents, and other nodes
 * that produce output data.
 *
 * @module features/simulator/components/console/node-outputs-panel
 */

import type { EnhancedUserJourney } from "@journey/schemas";
import { Clock, Database } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/shared/components/ui/badges";
import { JsonHighlight } from "@/shared/components/ui/json-highlight";
import { cn } from "@/shared/lib/utils";

interface NodeOutputsPanelProps {
  /** Session containing node outputs */
  session: EnhancedUserJourney | null;
  /** Additional class names */
  className?: string;
}

/**
 * Format timestamp to readable time.
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Get variant color for node type badge.
 */
function getNodeTypeVariant(nodeType: string): "default" | "info" | "success" | "warning" {
  switch (nodeType) {
    case "webhook":
      return "info";
    case "condition":
      return "warning";
    case "agent":
      return "success";
    default:
      return "default";
  }
}

/**
 * Panel displaying all node outputs from the session.
 * Always shows data (no expand/collapse) for better debugging experience.
 */
export function NodeOutputsPanel({ session, className }: NodeOutputsPanelProps) {
  const nodeOutputs = useMemo(() => session?.nodeOutputs ?? {}, [session?.nodeOutputs]);

  // Sort by execution time (most recent first) - memoized on nodeOutputs reference
  const sortedEntries = useMemo(() => {
    const entries = Object.entries(nodeOutputs);
    return entries.sort(([, a], [, b]) => {
      // Handle missing or invalid executedAt values
      const timeA = a?.executedAt ? new Date(a.executedAt).getTime() : 0;
      const timeB = b?.executedAt ? new Date(b.executedAt).getTime() : 0;
      // Handle NaN from invalid dates
      if (Number.isNaN(timeB)) return -1;
      if (Number.isNaN(timeA)) return 1;
      return timeB - timeA; // Most recent first
    });
  }, [nodeOutputs]);

  if (!session) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground text-sm", className)}>
        No session active
      </div>
    );
  }

  if (sortedEntries.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full gap-2 text-muted-foreground", className)}>
        <Database className="h-8 w-8 opacity-50" />
        <span className="text-sm">No node outputs yet</span>
        <span className="text-xs opacity-70">
          Outputs from webhooks, conditions, and agents will appear here
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full scrollbar-ghost bg-background", className)}>
      {/* Header */}
      <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Node Outputs</span>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {sortedEntries.length}
        </Badge>
      </div>

      {/* Entries - always show data for debugging */}
      <div className="flex-1 scrollbar-ghost">
        {sortedEntries.map(([label, output]) => {
          // Skip malformed entries
          if (!output?.executedAt) return null;
          return (
            <div key={label} className="border-b border-border/40 px-3 py-2">
              {/* Header row */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground flex-1 truncate">
                  {output.nodeLabel || label}
                </span>
                <Badge variant={getNodeTypeVariant(output.nodeType)} className="text-[10px] px-1.5 py-0 shrink-0">
                  {output.nodeType}
                </Badge>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {formatTime(output.executedAt)}
                </span>
              </div>
              {/* Data - always visible */}
              {output.data != null && (
                <pre className="bg-muted/30 rounded p-2 text-[11px] overflow-x-auto">
                  <JsonHighlight value={output.data} />
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
