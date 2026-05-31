import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import type { NodeChange } from "@xyflow/react";
import { X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { LayoutOptions } from "@/shared/lib/ui/layout";
import { notify } from "@/shared/lib/ui/notify";

import { journeyHeaderActions } from "@/features/dashboard/store/journey-header-store";
import { JourneyCanvas } from "@/features/journey/builder/components/journey-canvas";
import { JourneySettingsDialog } from "@/features/journey/builder/components/journey-settings-dialog";
import { VersionHistoryPanel } from "@/features/journey/builder/components/version-history-panel";
import { CanvasProvider, EditorActionsProvider } from "@/features/journey/builder/context";
import { useEditorActions, useJourneyData } from "@/features/journey/builder/hooks";
import { useEditorMode } from "@/features/journey/builder/hooks/selectors/editor-selectors";
import { useJourneyCRUD } from "@/features/journey/hooks/navigation/use-journey-crud";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { ConsolePanelContainer, JourneyChat, SimulatorControls, useSimulatorContext, useSimulatorMode } from "@/features/journey/simulator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { ErrorBoundary } from "@/shared/components/common/error-boundary";
import { AppLayout, AppLayoutInset, AppLayoutSidebar } from "@/shared/components/layout/app-layout-primitives";
import { ResizablePanel, ResizablePanelGroup } from "@/shared/components/ui/resizable";
import { journeysApi } from "@/shared/lib/api/journeys";
import { journeyKeys } from "@/shared/lib/query-keys";
import { journeyNodesActions } from "@/stores/journey-nodes-store";
import { uiActions, uiStore } from "@/stores/ui-store";
import type { DeactivationMode } from "@journey/schemas";

interface UnifiedLayoutProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function UnifiedLayout({ sidebarOpen, onToggleSidebar }: UnifiedLayoutProps) {
  // Access simulator via context (provided by AppLayout's SimulatorProvider)
  const simulator = useSimulatorContext();
  const journeyData = useJourneyData();
  const { isEditMode } = useEditorMode();
  // Combined selector - reduces from 2 subscriptions to 1
  const { showHistory, simulatorActive } = useStore(uiStore, (state) => ({
    showHistory: state.showHistory,
    simulatorActive: state.mode === "simulator",
  }));
  const { saveCurrentVersion, discardChanges, undo, redo, setSelectedNode } = useEditorActions();
  const queryClient = useQueryClient();
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Handler for discard button click - show confirmation dialog
  const handleDiscardClick = useCallback(() => {
    setShowDiscardDialog(true);
  }, []);

  // Handler for confirming discard
  const handleConfirmDiscard = useCallback(() => {
    discardChanges();
    setShowDiscardDialog(false);
    notify.success("Changes discarded");
  }, [discardChanges]);

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: async ({ journeyId, status, deactivationMode }: { journeyId: string; status: string; deactivationMode?: DeactivationMode }) => {
      return journeysApi.updateJourney(journeyId, { status, deactivationMode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
    },
    onError: (error) => {
      notify.error("Failed to update status", { description: error.message });
    },
  });

  // Handler for saving version (notification is shown by saveCurrentVersion)
  const handleSave = useCallback(
    async (notes?: string) => {
      await saveCurrentVersion(notes);
    },
    [saveCurrentVersion]
  );

  const { nodes, edges, selectedJourneySlug, isCustomSelected, loading, onJourneySelect } = journeyData;

  // Journey CRUD hook for delete functionality
  const { handleDeleteJourney: deleteJourney } = useJourneyCRUD({
    availableJourneys: journeyData.availableJourneys,
    onCancelCreateJourney: () => {},
  });

  // Handler for delete journey
  const handleDeleteJourney = useCallback(() => {
    const journeyId = journeyData.selectedJourneyMeta?.id;
    if (selectedJourneySlug && journeyId) {
      deleteJourney(selectedJourneySlug, journeyId);
    }
  }, [deleteJourney, selectedJourneySlug, journeyData.selectedJourneyMeta?.id]);

  // Handler for status change
  const handleStatusChange = useCallback(
    async (status: string, deactivationMode?: string) => {
      const journeyId = journeyData.selectedJourneyMeta?.id;
      if (!journeyId) return;
      await statusMutation.mutateAsync({
        journeyId,
        status,
        deactivationMode: deactivationMode as DeactivationMode | undefined,
      });
    },
    [journeyData.selectedJourneyMeta?.id, statusMutation]
  );

  // Handler for when settings are saved
  const handleSettingsSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
  }, [queryClient]);

  // Handler for auto layout
  const handleAutoLayout = useCallback((options: LayoutOptions) => {
    journeyNodesActions.applyAutoLayout(options);
    uiActions.setPendingChanges(true);
  }, []);

  // Sync journey header controls to the global store
  // Note: Many fields are now derived directly from stores in JourneyHeaderControls:
  // - isEditMode, simulatorActive, pendingChanges: from uiStore
  // - canUndo, canRedo: from journeyNodesStore
  // - setEditMode, onHistoryClick, onSettingsClick: use uiActions directly
  useEffect(() => {
    journeyHeaderActions.setControls({
      selectedJourneySlug,
      selectedJourneyId: journeyData.selectedJourneyMeta?.id || null,
      journeyStatus: journeyData.selectedJourneyMeta?.status || null,
      journeyName: journeyData.selectedJourneyMeta?.name || null,
      journeyDescription: journeyData.selectedJourneyMeta?.description || null,
      journeyDefaultPipelineId: journeyData.selectedJourneyMeta?.defaultPipelineId ?? null,
      onJourneySelect,
      onStatusChange: isCustomSelected ? handleStatusChange : null,
      loading,
      onSave: handleSave,
      onDiscard: handleDiscardClick,
      onDeleteJourney: journeyData.selectedJourneyMeta?.id ? handleDeleteJourney : undefined,
      canDeleteJourney: !!journeyData.selectedJourneyMeta?.id,
      onUndo: undo,
      onRedo: redo,
      onAutoLayout: handleAutoLayout,
      sidebarOpen,
      onToggleSidebar,
    });

    // Cleanup when unmounting
    return () => {
      journeyHeaderActions.clearControls();
    };
  }, [
    selectedJourneySlug,
    journeyData.selectedJourneyMeta?.id,
    journeyData.selectedJourneyMeta?.status,
    journeyData.selectedJourneyMeta?.name,
    journeyData.selectedJourneyMeta?.description,
    journeyData.selectedJourneyMeta?.defaultPipelineId,
    onJourneySelect,
    handleStatusChange,
    loading,
    handleSave,
    handleDiscardClick,
    isCustomSelected,
    handleDeleteJourney,
    undo,
    redo,
    handleAutoLayout,
    sidebarOpen,
    onToggleSidebar,
  ]);

  // Handle node click in simulator mode: start/restart simulation from clicked node
  // This is passed to CanvasProvider as onSimulatorModeNodeClick
  const handleSimulatorModeNodeClick = useCallback(
    (event: React.MouseEvent, node: JourneyNode) => {
      // In simulator mode: clicking a node starts (or restarts) simulation from that node
      if (simulator.isActive) {
        // Stop current session and start new one from clicked node
        simulator.stopSession();
      }
      event.preventDefault();
      // Pass selectedPersonaId to use persona's client (or null for anonymous)
      simulator.startSession(node.id, simulator.selectedPersonaId ?? undefined);
    },
    [simulator]
  );

  // Handle node changes (position, selection, etc.) from ReactFlow
  // Position updates during drag do NOT push to undo stack (handled by drag start/stop)
  const handleNodesChange = useCallback(
    (changes: NodeChange<JourneyNode>[]) => {
      if (!isEditMode) return;

      // Collect position changes and update all at once (without undo tracking)
      const positionUpdates = new Map<string, { x: number; y: number }>();

      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          positionUpdates.set(change.id, change.position);
        }
      });

      if (positionUpdates.size > 0) {
        journeyNodesActions.updateNodePositions(positionUpdates);
      }
    },
    [isEditMode]
  );

  // Use centralized mode hook for explicit mode checks
  const { isPlaybackMode } = useSimulatorMode();

  // Filter events for console based on playback state
  const displayEvents = useMemo(() => {
    const events = simulator.eventLog || [];

    // In normal mode, show all events
    if (!isPlaybackMode) {
      return events;
    }

    // In playback mode, show events up to current index (inclusive)
    const playbackIndex = simulator.playback?.playbackIndex ?? 0;
    return events.slice(0, playbackIndex + 1);
  }, [simulator.eventLog, isPlaybackMode, simulator.playback?.playbackIndex]);

  return (
    <AppLayout open={sidebarOpen} onOpenChange={onToggleSidebar}>
      {/* Main Content Area */}
      <AppLayoutInset>
        {/* Canvas - wrapped with EditorActionsProvider + CanvasProvider for DI and state */}
        <div className="flex-1 relative h-full min-h-0 overflow-hidden">
          <EditorActionsProvider>
            <CanvasProvider simulatorActive={simulatorActive} onSimulatorModeNodeClick={handleSimulatorModeNodeClick} onNodesChange={handleNodesChange}>
              <JourneyCanvas nodes={nodes} edges={edges} sidebarOpen={sidebarOpen} onCloseNodeEditor={() => setSelectedNode(null)} />
            </CanvasProvider>
          </EditorActionsProvider>
        </div>

        {/* Version History Modal */}
        {showHistory && <VersionHistoryPanel onClose={() => uiActions.closeHistory()} />}

        {/* Journey Settings Dialog - Self-manages state via uiStore */}
        <JourneySettingsDialog onSaved={handleSettingsSaved} />
      </AppLayoutInset>

      {/* Right Sidebar - Chat & Console */}
      <AppLayoutSidebar side="right" collapsible="offcanvas" className="w-96">
        <div className="flex h-full flex-col">
          {/* SimulatorControls is now self-managing - no props needed */}
          <SimulatorControls />

          {/* Chat & Console Panels */}
          <ResizablePanelGroup direction="vertical" className="flex-1">
            {/* Chat Panel */}
            <ResizablePanel defaultSize={85} minSize={30}>
              <ErrorBoundary variant="panel" panelName="Chat">
                {/* JourneyChat is now self-managing - only nodes needed for label lookup */}
                <JourneyChat nodes={nodes} />
              </ErrorBoundary>
            </ResizablePanel>

            {/* Console / Event Log - self-manages visibility via uiStore */}
            <ConsolePanelContainer events={displayEvents} />
          </ResizablePanelGroup>
        </div>
      </AppLayoutSidebar>

      {/* Discard Changes Confirmation Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard all changes and reset to the last saved version. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
