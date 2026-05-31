/**
 * Journey Header Controls
 *
 * Self-managing component that renders journey-specific controls in the dashboard header.
 * Includes journey selector, status dropdown, edit mode toggle, save/discard actions, etc.
 *
 * This component reads state directly from stores:
 * - journeyHeaderStore: Journey-specific data and callbacks
 * - uiStore: UI mode (edit/simulator/view) and pending changes
 * - journeyNodesStore: Undo/redo capabilities
 *
 * Note: Sidebar toggle is now in the DashboardHeader component.
 *
 * @module components/dashboard/journey-header-controls
 */

import { useStore } from "@tanstack/react-store";
import { History, LayoutGrid, Loader2, Pause, Play, Redo2, RefreshCw, Rocket, RotateCcw, Settings, Undo2 } from "lucide-react";
import { useCallback, useState } from "react";

import { journeyHeaderStore } from "@/features/dashboard/store/journey-header-store";
import { DeactivationDialog } from "@/features/journey/builder/components/deactivation-dialog";
import { JourneySelector } from "@/features/journey/builder/components/journey-selector";
import { SaveVersionDialog, type SaveVersionOptions } from "@/shared/components/save-version-dialog";
import type { BuilderStatus } from "@/shared/components/status-selector";
import { ValidationDialog } from "@/features/journey/builder/components/layout/validation-dialog";
import { useJourneyValidation } from "@/features/journey/builder/hooks/use-journey-validation";
import { useActiveSessionsCount } from "@/hooks/queries/use-active-sessions-count";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { ModeSwitch } from "@/shared/components/ui/mode-switch";
import { Separator } from "@/shared/components/ui/separator";
import { Switch } from "@/shared/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { appConfig } from "@/shared/lib/app-config";
import { saveManagerActions } from "@/stores/save-manager-store";
import { cn } from "@/shared/lib/utils";
import { journeyNodesActions, journeyNodesStore } from "@/stores/journey-nodes-store";
import { uiActions, uiStore } from "@/stores/ui-store";
import { versionStore } from "@/stores/version-store";
import type { DeactivationMode, JourneyStatus } from "@journey/schemas";

/**
 * Self-managing Journey Header Controls.
 * Reads all state from stores - no props needed.
 */
export function JourneyHeaderControls() {
  // ==========================================================================
  // STORE ACCESS - Read state directly from stores
  // ==========================================================================

  // Journey-specific state from journeyHeaderStore
  const {
    selectedJourneySlug,
    selectedJourneyId,
    journeyStatus,
    onJourneySelect,
    onStatusChange,
    loading,
    onSave,
    onDiscard,
    onUndo,
    onRedo,
    onAutoLayout,
    isActive,
  } = useStore(journeyHeaderStore);

  // UI state from uiStore
  const { mode, pendingChanges } = useStore(uiStore);
  const isEditMode = mode === "edit";
  const simulatorActive = mode === "simulator";

  // Undo/redo capabilities and auto layout panel state from journeyNodesStore
  const canUndo = useStore(journeyNodesStore, (s) => s.undoStack.length > 0);
  const canRedo = useStore(journeyNodesStore, (s) => s.redoStack.length > 0);
  const autoLayoutPanelOpen = useStore(journeyNodesStore, (s) => s.autoLayoutPanelOpen);

  // Check if this is a custom journey (no database UUID = cannot save to server)
  const journeyUuid = useStore(versionStore, (s) => s.journeyUuid);
  const isCustomJourney = !journeyUuid;

  // ==========================================================================
  // LOCAL STATE
  // ==========================================================================

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  // Note: Validation dialog state moved to uiStore (self-managing)
  const [showDeactivationDialog, setShowDeactivationDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // ==========================================================================
  // HOOKS & QUERIES
  // ==========================================================================

  // Validation hook
  const { validate } = useJourneyValidation();

  // Fetch active session count when save dialog or deactivation dialog is shown
  const { data: activeSessionCount = 0, isLoading: isLoadingCount } = useActiveSessionsCount(
    selectedJourneyId,
    showDeactivationDialog || showSaveDialog
  );

  // ==========================================================================
  // HANDLERS - Use store actions directly where possible
  // ==========================================================================

  // History click - uses uiActions directly
  const handleHistoryClick = useCallback(() => {
    uiActions.openHistory();
  }, []);

  // Settings click - uses uiActions directly
  const handleSettingsClick = useCallback(() => {
    uiActions.openJourneySettings();
  }, []);

  const handleSave = async (options: SaveVersionOptions) => {
    // Save the version first
    await onSave?.(options.notes);
    setShowSaveDialog(false);

    // If status changed, update status after save
    if (options.newStatus && options.newStatus !== journeyStatus) {
      await performStatusChange(options.newStatus, options.deactivationMode);
    }
  };

  // Handle save button click - flush editor first, then validate if enabled
  const handleSaveClick = useCallback(async () => {
    // Flush any pending editor changes first
    const flushed = await saveManagerActions.flushActiveEditor();
    if (!flushed) {
      // Editor validation failed, don't proceed
      return;
    }

    // Skip validation if disabled in config
    if (!appConfig.canvas.validateOnSave) {
      setShowSaveDialog(true);
      return;
    }

    const result = validate();

    if (!result.valid || result.warnings.length > 0) {
      // Has errors or warnings - show validation dialog (self-managing)
      uiActions.showValidationDialog(result);
    } else {
      // All good - show save dialog directly
      setShowSaveDialog(true);
    }
  }, [validate]);

  // Proceed to save after validation warnings (called by ValidationDialog)
  const handleProceedWithWarnings = useCallback(() => {
    setShowSaveDialog(true);
  }, []);

  // Handle toggle between active/draft
  const handleStatusToggle = (checked: boolean) => {
    const newStatus = checked ? "active" : "draft";
    if (newStatus === journeyStatus) return;

    // If changing FROM active, show deactivation dialog
    if (journeyStatus === "active") {
      setPendingStatus(newStatus);
      setShowDeactivationDialog(true);
    } else {
      // Direct status change (no active sessions to handle)
      performStatusChange(newStatus);
    }
  };

  const performStatusChange = async (newStatus: string, deactivationMode?: DeactivationMode) => {
    if (!onStatusChange) return;
    setIsUpdatingStatus(true);
    try {
      await onStatusChange(newStatus, deactivationMode);
    } finally {
      setIsUpdatingStatus(false);
      setShowDeactivationDialog(false);
      setPendingStatus(null);
    }
  };

  const handleDeactivationConfirm = (mode: DeactivationMode) => {
    if (pendingStatus) {
      performStatusChange(pendingStatus, mode);
    }
  };

  const currentStatus = (journeyStatus as JourneyStatus) || "draft";
  const isActiveStatus = currentStatus === "active";

  // Don't render if not on journey page
  if (!isActive) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Journey Selector */}
        {onJourneySelect && <JourneySelector selectedJourneySlug={selectedJourneySlug ?? ""} onJourneySelect={onJourneySelect} />}
        {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}

        {/* Status Toggle */}
        {selectedJourneySlug && onStatusChange && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                {isUpdatingStatus ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isActiveStatus ? (
                  <Play className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <Switch id="status-toggle" checked={isActiveStatus} onCheckedChange={handleStatusToggle} disabled={isUpdatingStatus || simulatorActive} />
                <Label
                  htmlFor="status-toggle"
                  className={cn(
                    "text-sm cursor-pointer select-none",
                    (isUpdatingStatus || simulatorActive) && "opacity-50 cursor-not-allowed",
                    isActiveStatus ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                  )}
                >
                  {isActiveStatus ? "Active" : "Draft"}
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent>{simulatorActive ? "Exit simulator mode first" : isActiveStatus ? "Deactivate journey" : "Activate journey"}</TooltipContent>
          </Tooltip>
        )}

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Mode Switch - Edit/Simulator toggle */}
        {selectedJourneySlug && <ModeSwitch mode={mode} onModeChange={uiActions.setMode} />}

        {/* Edit Actions - Only visible in edit mode */}
        {isEditMode && (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />

            {/* Undo/Redo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onUndo ?? undefined} disabled={!canUndo} className="h-7 w-7">
                  <Undo2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Undo</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (⌘Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onRedo ?? undefined} disabled={!canRedo} className="h-7 w-7">
                  <Redo2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Redo</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
            </Tooltip>

            {/* Auto Layout - Toggle panel in canvas */}
            {onAutoLayout && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={autoLayoutPanelOpen ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => journeyNodesActions.toggleAutoLayoutPanel()}
                    className="h-7 w-7"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span className="sr-only">Auto Layout</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Auto-arrange nodes</TooltipContent>
              </Tooltip>
            )}

            <Separator orientation="vertical" className="mx-1 h-5" />

            {/* Save */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSaveClick}
                  disabled={!pendingChanges || isCustomJourney}
                  className="h-7 w-7"
                >
                  <Rocket className={cn("h-3.5 w-3.5", pendingChanges && !isCustomJourney && "text-foreground")} />
                  <span className="sr-only">Publish</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isCustomJourney
                  ? "Custom journeys are saved locally in your browser"
                  : pendingChanges
                    ? isActiveStatus
                      ? "Publish changes"
                      : "Save changes"
                    : isActiveStatus
                      ? "No changes to publish"
                      : "No changes to save"}
              </TooltipContent>
            </Tooltip>

            {/* Discard */}
            {onDiscard && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDiscard}
                    disabled={!pendingChanges}
                    className={cn("h-7 w-7", pendingChanges && "text-foreground")}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="sr-only">Discard</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Discard all changes</TooltipContent>
              </Tooltip>
            )}

            {/* History */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleHistoryClick} className="h-7 w-7">
                  <History className="h-3.5 w-3.5" />
                  <span className="sr-only">History</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Version history</TooltipContent>
            </Tooltip>

            {/* Settings */}
            {selectedJourneyId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleSettingsClick} className="h-7 w-7">
                    <Settings className="h-3.5 w-3.5" />
                    <span className="sr-only">Settings</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Journey settings</TooltipContent>
              </Tooltip>
            )}

            {/* Unsaved indicator */}
            {pendingChanges && !simulatorActive && <span className="text-xs text-amber-600 dark:text-amber-400 px-2  font-medium">Unsaved</span>}
          </>
        )}

        {/* Save Dialog with Status Selector */}
        <SaveVersionDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          onSave={handleSave}
          currentStatus={(journeyStatus as BuilderStatus) ?? "draft"}
          showStatusSelector={true}
          activeSessionCount={activeSessionCount}
          builderType="journey"
        />

        {/* Validation Dialog - Self-managing, reads from uiStore */}
        <ValidationDialog onProceedAnyway={handleProceedWithWarnings} />

        {/* Deactivation Dialog */}
        <DeactivationDialog
          open={showDeactivationDialog}
          onOpenChange={(open) => {
            setShowDeactivationDialog(open);
            if (!open) setPendingStatus(null);
          }}
          onConfirm={handleDeactivationConfirm}
          activeSessionCount={activeSessionCount}
          isLoading={isLoadingCount || isUpdatingStatus}
          targetStatus={pendingStatus || undefined}
        />

      </div>
    </TooltipProvider>
  );
}
