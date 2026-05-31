import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useState } from "react";

import { useJourneyData } from "@/features/journey/builder/hooks/queries/use-journey-data";
import { useEditorActions } from "@/features/journey/builder/hooks/use-editor-actions";
import { useJourneyValidation } from "@/features/journey/builder/hooks/use-journey-validation";
import { useJourneyCRUD } from "@/features/journey/hooks/navigation/use-journey-crud";
import { SimulatorProvider } from "@/features/journey/simulator";
import { notify } from "@/shared/lib/ui/notify";
import { storeEventBus } from "@/stores/store-event-bus";
import { uiActions, uiStore } from "@/stores/ui-store";
import { PendingChangesDialog, UnifiedLayout } from "./layout";
import { NewJourneyDialog } from "./new-journey-dialog";

/**
 * Granular selector for AppLayoutContent - only subscribes to values actually used.
 * Prevents re-renders when unrelated UI state changes.
 */
const selectAppLayoutState = (state: typeof uiStore.state) => ({
  isEditMode: state.mode === "edit",
  isSimulatorMode: state.mode === "simulator",
  pendingChanges: state.pendingChanges,
  newJourneyName: state.newJourneyName,
  newJourneyDescription: state.newJourneyDescription,
  newJourneyDefaultPipelineId: state.newJourneyDefaultPipelineId,
});

/**
 * AppLayout - Root layout component for the journey builder.
 *
 * Wraps the application in SimulatorProvider to make simulator context
 * available to all child components (JourneyChat, SimulatorControls, etc.)
 *
 * The simulator runs on the backend server providing 100% production parity.
 * A valid journeyId is required to create simulator sessions.
 */
export function AppLayout() {
  const journeyData = useJourneyData();

  // Get journeyId for simulator sessions
  const journeyId = journeyData.selectedJourneyMeta?.id ?? "";

  return (
    <SimulatorProvider journeyId={journeyId}>
      <AppLayoutContent journeyData={journeyData} />
    </SimulatorProvider>
  );
}

/**
 * AppLayoutContent - Inner component that consumes simulator context.
 *
 * Separated from AppLayout to allow useSimulatorContext() to work
 * (must be called within SimulatorProvider).
 */
function AppLayoutContent({ journeyData }: { journeyData: ReturnType<typeof useJourneyData> }) {
  // Sidebar starts closed - opens automatically when entering simulator mode
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPendingChangesDialog, setShowPendingChangesDialog] = useState(false);

  const { validate } = useJourneyValidation();
  const { saveCurrentVersion, discardChanges } = useEditorActions();

  // Granular selector - only subscribes to values actually used
  const { isEditMode, isSimulatorMode, pendingChanges, newJourneyName, newJourneyDescription, newJourneyDefaultPipelineId } = useStore(
    uiStore,
    selectAppLayoutState
  );

  // Auto-open sidebar when entering simulator mode, close when exiting
  useEffect(() => {
    if (isSimulatorMode) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, [isSimulatorMode]);

  const crud = useJourneyCRUD({
    availableJourneys: journeyData.availableJourneys,
    onCancelCreateJourney: () => uiActions.resetNewJourneyDialog(),
  });

  const handleCreateJourney = useCallback(() => {
    crud.handleCreateJourney(newJourneyName, newJourneyDescription, newJourneyDefaultPipelineId);
  }, [crud, newJourneyName, newJourneyDescription, newJourneyDefaultPipelineId]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Enter simulator mode - show warning notification for issues but don't block
  const enterSimulatorMode = useCallback(() => {
    const result = validate();

    // Show notification for errors/warnings but don't block simulator mode
    const totalIssues = result.errors.length + result.warnings.length;
    if (totalIssues > 0) {
      const errorCount = result.errors.length;
      const warningCount = result.warnings.length;
      const parts: string[] = [];
      if (errorCount > 0) parts.push(`${errorCount} error(s)`);
      if (warningCount > 0) parts.push(`${warningCount} warning(s)`);

      notify.warning("Journey has issues", {
        description: `${parts.join(" and ")} found. The journey may not work correctly.`,
      });
    }

    uiActions.setMode("simulator");
  }, [validate]);

  // Subscribe to simulator mode requests from SimulatorControls
  // Handles pending changes check before entering simulator mode
  useEffect(() => {
    const unsubscribe = storeEventBus.on("ui:requestSimulatorMode", () => {
      if (isEditMode && pendingChanges) {
        setShowPendingChangesDialog(true);
      } else {
        enterSimulatorMode();
      }
    });

    return unsubscribe;
  }, [isEditMode, pendingChanges, enterSimulatorMode]);

  // Handler for "Save & Simulate" in pending changes dialog
  const handleSaveAndTest = useCallback(async () => {
    await saveCurrentVersion();
    enterSimulatorMode();
  }, [saveCurrentVersion, enterSimulatorMode]);

  // Handler for "Discard & Simulate" in pending changes dialog
  const handleDiscardAndTest = useCallback(() => {
    discardChanges();
    notify.info("Changes discarded", {
      description: "Entering simulator mode with original version",
    });
    enterSimulatorMode();
  }, [discardChanges, enterSimulatorMode]);

  return (
    <div className="h-full w-full bg-background overflow-hidden relative font-sans flex flex-col">
      <UnifiedLayout sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />

      {/* New Journey Dialog - Self-manages state via uiStore */}
      <NewJourneyDialog onCreate={handleCreateJourney} />

      {/* Pending Changes Confirmation Dialog (when switching from Edit to Simulator mode) */}
      <PendingChangesDialog
        open={showPendingChangesDialog}
        onOpenChange={setShowPendingChangesDialog}
        onSaveAndContinue={handleSaveAndTest}
        onDiscardAndContinue={handleDiscardAndTest}
        title="Unsaved Changes"
        description="You have unsaved changes in edit mode. Would you like to save them before entering simulator mode?"
      />
    </div>
  );
}
