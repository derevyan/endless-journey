/**
 * InteractionLog Component
 *
 * Reusable event log display for interaction events.
 * Used by both Simulator mode Console and Users mode Activity Timeline.
 *
 * @module components/common/interaction-log
 */

import { EventTypes, type InteractionEvent } from "@journey/schemas";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight, Eraser, Maximize2, Minimize2, WrapText, type LucideIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge, EventTypeBadge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { JsonHighlight } from "@/shared/components/ui/json-highlight";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

type InteractionType = InteractionEvent["type"];

export interface InteractionLogProps {
  /** Array of interaction events to display */
  events: InteractionEvent[];
  /** Header title */
  title?: string;
  /** Header icon */
  icon?: LucideIcon;
  /** Clear callback - if provided, shows clear button */
  onClear?: () => void;
  /** Whether to group events by date (default: false) */
  showDateGroups?: boolean;
  /** Whether to auto-scroll to latest event (default: true) */
  autoScroll?: boolean;
  /** Message shown when no events */
  emptyMessage?: string;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================


// =============================================================================
// HELPERS
// =============================================================================

function formatTime(timestamp: string, includeDate: boolean = false): string {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (!includeDate) return time;

  // Include short date for date groups mode
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${dateStr} ${time}`;
}

function getPayloadSummary(type: InteractionType, payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const p = payload as Record<string, unknown>;

  switch (type) {
    case EventTypes.USER_MESSAGE:
      return p.text ? `"${String(p.text).slice(0, 60)}${String(p.text).length > 60 ? "..." : ""}"` : "";
    case EventTypes.USER_CLICK:
      return p.buttonLabel ? String(p.buttonLabel) : p.buttonId ? `Button: ${p.buttonId}` : "";
    case EventTypes.ENGINE_MESSAGE:
      return p.content ? `"${String(p.content).slice(0, 50)}${String(p.content).length > 50 ? "..." : ""}"` : "";
    case EventTypes.ENGINE_TRANSITION:
      return p.from && p.to ? `${p.from} → ${p.to}` : "";
    case EventTypes.TIMER_EXPIRED:
      return p.edgeId ? `Edge: ${p.edgeId}` : "";
    case EventTypes.ENGINE_ERROR:
      return p.message ? String(p.message).slice(0, 60) : "";
    case EventTypes.SESSION_TAGS: {
      const parts: string[] = [];
      const addTags = p.addTags as string[] | undefined;
      const removeTags = p.removeTags as string[] | undefined;
      if (addTags && addTags.length > 0) {
        parts.push(`+${addTags.join(", ")}`);
      }
      if (removeTags && removeTags.length > 0) {
        parts.push(`-${removeTags.join(", ")}`);
      }
      const scope = p.scope as string | undefined;
      if (scope === "global") {
        parts.push("(global)");
      }
      return parts.join(" ");
    }
    case EventTypes.SESSION_VARIABLES: {
      const parts: string[] = [];
      const operations = p.operations as Array<{ op: string; key: string; scope: string }> | undefined;
      const userCount = p.userOperationCount as number | undefined;
      const journeyCount = p.journeyOperationCount as number | undefined;
      const globalCount = p.globalOperationCount as number | undefined;

      // Show operation summary by scope
      if (operations && operations.length > 0) {
        // Group by scope
        const byScope: Record<string, string[]> = { user: [], journey: [], global: [] };
        for (const op of operations) {
          const opStr = op.op === "set" ? `${op.key}` : `${op.op}(${op.key})`;
          if (byScope[op.scope]) {
            byScope[op.scope].push(opStr);
          }
        }

        if (byScope.user.length > 0) {
          parts.push(`User: ${byScope.user.join(", ")}`);
        }
        if (byScope.journey.length > 0) {
          parts.push(`Journey: ${byScope.journey.join(", ")}`);
        }
        if (byScope.global.length > 0) {
          parts.push(`Global: ${byScope.global.join(", ")}`);
        }
      } else {
        // Fallback to counts if operations not available
        if (userCount && userCount > 0) parts.push(`User: ${userCount}`);
        if (journeyCount && journeyCount > 0) parts.push(`Journey: ${journeyCount}`);
        if (globalCount && globalCount > 0) parts.push(`Global: ${globalCount}`);
      }

      return parts.join(" | ");
    }
    case EventTypes.JOURNEY_TELEPORT: {
      const parts: string[] = [];
      if (p.toJourneyName) parts.push(`→ ${p.toJourneyName}`);
      else if (p.toJourneyId) parts.push(`→ ${p.toJourneyId}`);
      if (p.toNodeId) parts.push(`@${p.toNodeId}`);
      return parts.join(" ");
    }
    case EventTypes.MINDSTATE_UPDATED: {
      const key = p.key as string | undefined;
      const changesCount = p.changesCount as number | undefined;
      if (key) return `${key}${changesCount ? ` (${changesCount} changes)` : ""}`;
      return "";
    }
    case EventTypes.JOURNEY_CRM: {
      const action = p.action as string | undefined;
      const message = p.message as string | undefined;
      if (action && message) return `${action}: ${message}`;
      if (action) return action;
      return "";
    }
    default:
      return "";
  }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface LogEntryProps {
  event: InteractionEvent;
  isExpanded: boolean;
  onToggleExpand: (eventId: string) => void;
  wrapJson: boolean;
  showDate?: boolean;
}

const LogEntry = memo(function LogEntry({ event, isExpanded, onToggleExpand, wrapJson, showDate = false }: LogEntryProps) {
  const summary = getPayloadSummary(event.type, event.payload);
  const payloadObj = event.payload as Record<string, unknown> | null | undefined;
  const hasExpandablePayload = Boolean(payloadObj && Object.keys(payloadObj).length > 0);

  const handleClick = useCallback(() => {
    if (hasExpandablePayload) {
      onToggleExpand(event.id);
    }
  }, [hasExpandablePayload, onToggleExpand, event.id]);

  return (
    <div className="group font-mono text-[10px] border-b border-border/40 hover:bg-muted/50 transition-colors">
      <div className={cn("flex items-start gap-1 px-1 py-0.5", hasExpandablePayload && "cursor-pointer")} onClick={handleClick}>
        {/* Expand/Collapse indicator */}
        {hasExpandablePayload && (
          <span className="text-muted-foreground/50 mt-0.5 shrink-0">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}

        {/* Timestamp (with optional date) */}
        <span className="text-muted-foreground/70 font-mono tracking-tight text-[10px] shrink-0 tabular-nums">{formatTime(event.timestamp, showDate)}</span>

        {/* Event Type Badge */}
        <EventTypeBadge type={event.type} size="sm" className="shrink-0" />

        {/* Node ID */}
        <span className="shrink-0">
          <span className="text-muted-foreground/50">@</span>
          <span className="text-foreground font-xs">{event.nodeId}</span>
        </span>

        {/* Payload preview/summary - always truncated for compact view */}
        {summary && <span className="truncate flex-1 text-foreground/80">{summary}</span>}
      </div>

      {/* Expanded payload with syntax highlighting */}
      {isExpanded && hasExpandablePayload && (
        <pre
          className={cn(
            "px-3 py-2 ml-5 bg-muted/30 text-[11px] border-t border-border/30 leading-relaxed",
            wrapJson ? "whitespace-pre-wrap wrap-break-word" : "overflow-x-auto"
          )}
        >
          <JsonHighlight value={event.payload} />
        </pre>
      )}
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

// Row height estimation for virtualization
const COLLAPSED_ROW_HEIGHT = 28;
const EXPANDED_ROW_HEIGHT = 120; // Approximate height when expanded

export function InteractionLog({
  events,
  title = "Events",
  icon: Icon,
  onClear,
  showDateGroups = false,
  autoScroll = true,
  emptyMessage = "Waiting for events...",
  className,
}: InteractionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [wrapJson, setWrapJson] = useState(false);
  const autoScrollEnabledRef = useRef(autoScroll);
  const lastEventCountRef = useRef(events.length);

  // Memoize sorted events for date groups mode
  const displayEvents = useMemo(() => {
    if (!showDateGroups) return events;
    return [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [events, showDateGroups]);

  // Toggle individual event expansion
  const handleToggleExpand = useCallback((eventId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  // Expand all / collapse all
  const handleToggleExpandAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedIds((prev) => {
        if (prev.size > 0) {
          // Collapse all
          return new Set();
        }
        // Expand all
        return new Set(displayEvents.map((e) => e.id));
      });
    },
    [displayEvents]
  );

  const handleToggleWrap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setWrapJson((prev) => !prev);
  }, []);

  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: displayEvents.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const event = displayEvents[index];
        return expandedIds.has(event?.id) ? EXPANDED_ROW_HEIGHT : COLLAPSED_ROW_HEIGHT;
      },
      [displayEvents, expandedIds]
    ),
    overscan: 10,
  });

  // Auto-scroll when new events are added (throttled)
  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;

    // Only auto-scroll if new events were added
    if (events.length > lastEventCountRef.current) {
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        if (autoScrollEnabledRef.current && scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
    lastEventCountRef.current = events.length;
  }, [events.length, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const isAtBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 50;
      autoScrollEnabledRef.current = isAtBottom;
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, []);

  const isAllExpanded = expandedIds.size > 0 && expandedIds.size === displayEvents.length;

  return (
    <div className={cn("flex flex-col bg-background h-full overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {events.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {/* JSON wrap toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleWrap}
            className={cn("h-6 w-6 p-0", wrapJson ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground")}
            title={wrapJson ? "Scroll JSON horizontally" : "Wrap JSON lines"}
          >
            <WrapText className="w-3.5 h-3.5" />
          </Button>

          {/* Expand/Collapse all toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleExpandAll}
            className={cn("h-6 w-6 p-0", isAllExpanded ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground")}
            title={isAllExpanded ? "Collapse all" : "Expand all"}
          >
            {isAllExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>

          {/* Clear button (optional) */}
          {onClear && (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" title="Clear log">
              <Eraser className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Virtualized Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {displayEvents.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6 font-mono">{emptyMessage}</div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const event = displayEvents[virtualRow.index];
              return (
                <div
                  key={event.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <LogEntry
                    event={event}
                    isExpanded={expandedIds.has(event.id)}
                    onToggleExpand={handleToggleExpand}
                    wrapJson={wrapJson}
                    showDate={showDateGroups}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
