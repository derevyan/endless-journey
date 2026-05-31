/**
 * Simulator Controls
 *
 * Header bar with simulator controls and exit buttons.
 * Self-managing component - reads state from stores, uses actions directly.
 *
 * @module features/simulator/components/controls/simulator-controls
 */

import { useStore } from "@tanstack/react-store";
import { Square, X } from "lucide-react";
import { useCallback, useMemo } from "react";

import { Button } from "@/shared/components/ui/button";
import { journeyNodesStore } from "@/stores/journey-nodes-store";
import { uiActions, uiStore } from "@/stores/ui-store";
import { useSimulatorContext } from "../../context";
import { useSimulatorMode } from "../../hooks";
import { PersonaSelector } from "./persona-selector";

/**
 * Self-managing Simulator Controls.
 * Reads all state from stores - no props needed.
 */
export function SimulatorControls() {
  // Read mode from uiStore
  const mode = useStore(uiStore, (s) => s.mode);
  const simulatorActive = mode === "simulator";

  // Read nodes from journeyNodesStore
  const nodes = useStore(journeyNodesStore, (s) => s.nodes);

  // Get simulator state and actions from context
  const simulator = useSimulatorContext();
  const { isPlaybackMode } = useSimulatorMode();
  const impersonatedUser = simulator.playback?.impersonatedUser;

  // Stop simulation: stop session and exit simulator mode
  const handleStopSimulation = useCallback(() => {
    simulator.stopSession();
    uiActions.setMode("edit");
  }, [simulator]);

  // Exit playback mode: stop playback and return to edit mode
  const handleExitPlayback = useCallback(() => {
    simulator.stopPlayback();
    uiActions.setMode("edit");
  }, [simulator]);

  // Get current node label for display
  const currentNodeLabel = useMemo(() => {
    const currentNodeId = simulator.currentSession?.currentNodeId;
    if (!currentNodeId) return "Unknown";
    const node = nodes.find((n) => n.id === currentNodeId);
    return node?.data.label || currentNodeId;
  }, [nodes, simulator.currentSession?.currentNodeId]);

  // Playback mode UI
  if (isPlaybackMode) {
    return (
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3 bg-background">
        {impersonatedUser && (
          <span className="text-sm text-muted-foreground truncate">
            <span className="font-sm text-foreground">{impersonatedUser.name}</span>
          </span>
        )}
        <div className="flex-1" />
        <Button onClick={handleExitPlayback} variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
          Exit
        </Button>
      </div>
    );
  }

  // Only show controls when in simulator mode
  if (!simulatorActive) {
    return (
      <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
        <div className="flex-1 text-sm text-muted-foreground">Switch to Simulator mode to test your journey</div>
      </div>
    );
  }

  // Simulator mode controls
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
      {simulator.isActive ? (
        // Active session - show current node and stop button
        <>
          <div className="flex-1 text-sm text-foreground truncate">
            <span className="text-muted-foreground">Node:</span> <span className="font-medium">{currentNodeLabel}</span>
          </div>
          <Button onClick={handleStopSimulation} variant="outline" size="sm" className="h-7 gap-1">
            <Square className="w-2.5 h-2.5" />
            Stop
          </Button>
        </>
      ) : (
        // Simulator mode active but no session - show persona selector
        <>
          <PersonaSelector selectedPersonaId={simulator.selectedPersonaId} onSelect={simulator.setSelectedPersonaId} />
          <div className="flex-1" />
        </>
      )}
    </div>
  );
}
