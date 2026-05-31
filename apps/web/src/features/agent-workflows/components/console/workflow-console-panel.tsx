/**
 * Workflow Console Panel
 *
 * Displays execution events and traces for workflow testing.
 * Shows node execution status, timing, and error information.
 *
 * @module features/agent-workflows/components/console/workflow-console-panel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@tanstack/react-store";
import {
  AlertCircle,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Eraser,
  GitBranch,
  Maximize2,
  Minimize2,
  OctagonX,
  Play,
  Shield,
  Terminal,
  WrapText,
  Zap,
} from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { JsonHighlight } from "@/shared/components/ui/json-highlight";
import { cn } from "@/shared/lib/utils";

import { agentTestActions, agentTestStore, type ConsoleEvent, type ConsoleEventType } from "../../stores/agent-test-store";

// =============================================================================
// TYPES
// =============================================================================

interface TypeConfig {
  label: string;
  icon: React.ReactNode;
  variant: "success" | "info" | "warning" | "error" | "default";
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TYPE_CONFIG: Record<ConsoleEventType, TypeConfig> = {
  workflow_start: {
    label: "Start",
    icon: <Play className="h-3 w-3" />,
    variant: "info",
  },
  workflow_complete: {
    label: "Complete",
    icon: <CheckCircle className="h-3 w-3" />,
    variant: "success",
  },
  workflow_error: {
    label: "Error",
    icon: <AlertCircle className="h-3 w-3" />,
    variant: "error",
  },
  node_start: {
    label: "Node",
    icon: <Zap className="h-3 w-3" />,
    variant: "info",
  },
  node_complete: {
    label: "Node",
    icon: <CheckCircle className="h-3 w-3" />,
    variant: "success",
  },
  node_error: {
    label: "Error",
    icon: <AlertCircle className="h-3 w-3" />,
    variant: "error",
  },
  node_blocked: {
    label: "Blocked",
    icon: <OctagonX className="h-3 w-3" />,
    variant: "warning",
  },
  tool_call: {
    label: "Tool",
    icon: <Bot className="h-3 w-3" />,
    variant: "info",
  },
};

// Node type icons for additional context
const NODE_TYPE_ICONS: Record<string, React.ReactNode> = {
  agent: <Bot className="h-3 w-3" />,
  guard: <Shield className="h-3 w-3" />,
  if_else: <GitBranch className="h-3 w-3" />,
  transform: <Zap className="h-3 w-3" />,
};

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(timestamp: Date): string {
  return timestamp.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(durationMs?: number): string {
  if (!durationMs) return "";
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ConsoleEntryProps {
  event: ConsoleEvent;
  isExpanded: boolean;
  onToggleExpand: (eventId: string) => void;
  wrapJson: boolean;
}

function ConsoleEntry({ event, isExpanded, onToggleExpand, wrapJson }: ConsoleEntryProps) {
  const config = TYPE_CONFIG[event.type];
  const hasExpandableDetails = Boolean(event.details && Object.keys(event.details).length > 0);
  const nodeTypeIcon = event.nodeType ? NODE_TYPE_ICONS[event.nodeType] : null;

  const handleClick = useCallback(() => {
    if (hasExpandableDetails) {
      onToggleExpand(event.id);
    }
  }, [hasExpandableDetails, onToggleExpand, event.id]);

  return (
    <div className="group font-mono text-[10px] border-b border-border/40 hover:bg-muted/50 transition-colors">
      <div
        className={cn("flex items-start gap-1 px-1 py-0.5", hasExpandableDetails && "cursor-pointer")}
        onClick={handleClick}
      >
        {/* Expand/Collapse indicator */}
        {hasExpandableDetails && (
          <span className="text-muted-foreground/50 mt-0.5 shrink-0">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}

        {/* Timestamp */}
        <span className="text-muted-foreground/70 font-mono tracking-tight text-[10px] shrink-0 tabular-nums">
          {formatTime(event.timestamp)}
        </span>

        {/* Event Type Badge */}
        <Badge variant={config.variant} className="shrink-0 text-[10px] px-1.5 py-0 gap-1 rounded-md">
          {config.icon}
          {config.label}
        </Badge>

        {/* Node Type (if applicable) */}
        {event.nodeType && (
          <span className="shrink-0 flex items-center gap-0.5 text-muted-foreground">
            {nodeTypeIcon || <Zap className="h-3 w-3" />}
            <span className="text-foreground/70">{event.nodeType}</span>
          </span>
        )}

        {/* Node ID (if applicable) */}
        {event.nodeId && (
          <span className="shrink-0">
            <span className="text-muted-foreground/50">@</span>
            <span className="text-foreground/70 font-xs">{event.nodeId}</span>
          </span>
        )}

        {/* Message - main event content */}
        <span className="truncate flex-1 text-foreground/80">{event.message}</span>

        {/* Duration (if applicable) */}
        {event.durationMs && (
          <span className="shrink-0 flex items-center gap-0.5 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(event.durationMs)}</span>
          </span>
        )}
      </div>

      {/* Expanded details with syntax highlighting */}
      {isExpanded && hasExpandableDetails && (
        <pre
          className={cn(
            "px-3 py-2 ml-5 bg-muted/30 text-[11px] border-t border-border/30 leading-relaxed",
            wrapJson ? "whitespace-pre-wrap wrap-break-word" : "overflow-x-auto"
          )}
        >
          <JsonHighlight value={event.details} />
        </pre>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * WorkflowConsolePanel - Console for workflow execution events
 *
 * Displays workflow and node execution events with timing information.
 * Supports expandable details and auto-scrolling.
 */
export function WorkflowConsolePanel() {
  const events = useStore(agentTestStore, (s) => s.consoleEvents);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [wrapJson, setWrapJson] = useState(false);
  const autoScrollEnabledRef = useRef(true);
  const lastEventCountRef = useRef(events.length);

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
          return new Set();
        }
        return new Set(events.map((e) => e.id));
      });
    },
    [events]
  );

  const handleToggleWrap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setWrapJson((prev) => !prev);
  }, []);

  const handleClear = useCallback(() => {
    agentTestActions.clearConsoleEvents();
    setExpandedIds(new Set());
  }, []);

  // Auto-scroll when new events are added
  useEffect(() => {
    if (!scrollRef.current) return;

    if (events.length > lastEventCountRef.current) {
      requestAnimationFrame(() => {
        if (autoScrollEnabledRef.current && scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
    lastEventCountRef.current = events.length;
  }, [events.length]);

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

  const isAllExpanded = useMemo(
    () => expandedIds.size > 0 && expandedIds.size === events.length,
    [expandedIds.size, events.length]
  );

  return (
    <div className="flex flex-col bg-background h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Console</span>
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
            className={cn(
              "h-6 w-6 p-0",
              wrapJson ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"
            )}
            title={wrapJson ? "Scroll JSON horizontally" : "Wrap JSON lines"}
          >
            <WrapText className="w-3.5 h-3.5" />
          </Button>

          {/* Expand/Collapse all toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleExpandAll}
            className={cn(
              "h-6 w-6 p-0",
              isAllExpanded ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"
            )}
            title={isAllExpanded ? "Collapse all" : "Expand all"}
          >
            {isAllExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>

          {/* Clear button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            title="Clear console"
          >
            <Eraser className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Console Content */}
      <div ref={scrollRef} className="flex-1 scrollbar-ghost min-h-0">
        {events.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6 font-mono">Waiting for events...</div>
        ) : (
          events.map((event) => (
            <ConsoleEntry
              key={event.id}
              event={event}
              isExpanded={expandedIds.has(event.id)}
              onToggleExpand={handleToggleExpand}
              wrapJson={wrapJson}
            />
          ))
        )}
      </div>
    </div>
  );
}
