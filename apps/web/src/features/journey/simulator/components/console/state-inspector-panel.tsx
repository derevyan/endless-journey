/**
 * State Inspector Panel
 *
 * Displays reconstructed session state at the current playback position.
 * Shows variables (organized by scope), tags, and current node.
 * Updates in real-time as playback position changes.
 *
 * @module features/simulator/components/console/state-inspector-panel
 */

import type { InteractionEvent } from "@journey/schemas";
import { useStore } from "@tanstack/react-store";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  MapPin,
  Route,
  Tag,
  User,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/shared/components/ui/badges";
import { JsonHighlight } from "@/shared/components/ui/json-highlight";
import { cn } from "@/shared/lib/utils";

import { simulatorStore } from "../../store/simulator-store";
import { reconstructStateAtIndex } from "../../lib/state-reconstruction";

// Stable empty objects to prevent unnecessary re-renders
const EMPTY_VARIABLES = { user: {}, journey: {}, global: {} } as const;
const EMPTY_TAGS: readonly string[] = [];
const EMPTY_CONTEXT: Record<string, unknown> = {};

interface StateInspectorPanelProps {
  /** Event log for state reconstruction */
  events: InteractionEvent[];
  /** Additional class names */
  className?: string;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible section for organizing state data.
 */
function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className="border-b border-border/40">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
        onClick={handleToggle}
      >
        <span className="text-muted-foreground">
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium flex-1">{title}</span>
        {badge !== undefined && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {badge}
          </Badge>
        )}
      </button>
      {isOpen && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
}

interface VariableScopeDisplayProps {
  scope: string;
  variables: Record<string, unknown>;
  icon: React.ReactNode;
}

/**
 * Display variables for a specific scope.
 */
function VariableScopeDisplay({
  scope,
  variables,
  icon,
}: VariableScopeDisplayProps) {
  const keys = Object.keys(variables);

  if (keys.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-1 pl-5">
        No {scope} variables
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {keys.map((key) => (
        <div key={key} className="flex items-start gap-2 pl-5">
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <span className="text-xs font-mono text-foreground/80 shrink-0">{key}:</span>
          <div className="flex-1 text-xs font-mono overflow-hidden">
            <JsonHighlight value={variables[key]} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * State Inspector Panel that shows reconstructed state at playback position.
 */
export function StateInspectorPanel({ events, className }: StateInspectorPanelProps) {
  // Subscribe to playback state
  const playbackIndex = useStore(simulatorStore, (s) => s.playback.playbackIndex);
  const mode = useStore(simulatorStore, (s) => s.mode);
  const session = useStore(simulatorStore, (s) => s.session);

  // Check if we're in playback mode with actual variable data
  const isPlaybackMode = mode === "playback" && events.length > 0;

  // Reconstruct state at current playback position
  const reconstructedState = useMemo(() => {
    if (isPlaybackMode) {
      return {
        ...reconstructStateAtIndex(events, playbackIndex),
        sessionContext: null,
      };
    }
    // For live simulator mode, show current session state
    if (mode === "simulator" && session) {
      return {
        currentNodeId: session.currentNodeId,
        variables: EMPTY_VARIABLES,
        tags: session.tags || EMPTY_TAGS,
        sessionContext: session.context || EMPTY_CONTEXT,
      };
    }
    return null;
  }, [events, playbackIndex, mode, session, isPlaybackMode]);

  // Count variables for badge
  const variableCount = useMemo(() => {
    if (!reconstructedState) return 0;
    if (isPlaybackMode) {
      return (
        Object.keys(reconstructedState.variables.user).length +
        Object.keys(reconstructedState.variables.journey).length +
        Object.keys(reconstructedState.variables.global).length
      );
    }
    // In live mode, count session context
    return reconstructedState.sessionContext
      ? Object.keys(reconstructedState.sessionContext).length
      : 0;
  }, [reconstructedState, isPlaybackMode]);

  if (!reconstructedState) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground text-sm", className)}>
        No session active
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full scrollbar-ghost bg-background", className)}>
      {/* Position indicator for playback mode */}
      {isPlaybackMode && (
        <div className="px-3 py-2 bg-muted/30 border-b border-border text-xs text-muted-foreground">
          State at event {playbackIndex + 1} of {events.length}
        </div>
      )}

      {/* Current Node */}
      <CollapsibleSection
        title="Current Node"
        icon={<MapPin className="h-3.5 w-3.5" />}
        defaultOpen={true}
      >
        <div className="text-sm font-mono bg-muted/30 px-2 py-1 rounded">
          {reconstructedState.currentNodeId || <span className="italic text-muted-foreground">Not set</span>}
        </div>
      </CollapsibleSection>

      {/* Variables - different display for playback vs live mode */}
      <CollapsibleSection
        title="Variables"
        icon={<Route className="h-3.5 w-3.5" />}
        badge={variableCount}
        defaultOpen={true}
      >
        <div className="space-y-3">
          {isPlaybackMode ? (
            // Playback mode: Show all three scopes (reconstructed from events)
            <>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                  <User className="h-3 w-3" />
                  User
                </div>
                <VariableScopeDisplay
                  scope="user"
                  variables={reconstructedState.variables.user}
                  icon={<span className="text-blue-500">u.</span>}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                  <Route className="h-3 w-3" />
                  Journey
                </div>
                <VariableScopeDisplay
                  scope="journey"
                  variables={reconstructedState.variables.journey}
                  icon={<span className="text-green-500">j.</span>}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                  <Globe className="h-3 w-3" />
                  Global
                </div>
                <VariableScopeDisplay
                  scope="global"
                  variables={reconstructedState.variables.global}
                  icon={<span className="text-purple-500">g.</span>}
                />
              </div>
            </>
          ) : (
            // Live mode: Only show session context (scopes unavailable in live mode)
            reconstructedState.sessionContext &&
            Object.keys(reconstructedState.sessionContext).length > 0 ? (
              <VariableScopeDisplay
                scope="context"
                variables={reconstructedState.sessionContext}
                icon={<span className="text-orange-500">ctx.</span>}
              />
            ) : (
              <div className="text-xs text-muted-foreground italic">
                No variables set
              </div>
            )
          )}
        </div>
      </CollapsibleSection>

      {/* Tags */}
      <CollapsibleSection
        title="Tags"
        icon={<Tag className="h-3.5 w-3.5" />}
        badge={reconstructedState.tags.length}
        defaultOpen={true}
      >
        {reconstructedState.tags.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No tags</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {reconstructedState.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
