/**
 * Agent Workflow Builder Page
 *
 * Visual canvas editor for building agent workflows.
 * Uses a layout similar to the journey builder with Edit/Simulator modes.
 *
 * @module features/agent-workflows/pages/agent-workflow-builder-page
 */

import { useEffect, useCallback, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle, X } from "lucide-react";

import { agentWorkflowHeaderActions } from "@/features/dashboard/store/agent-workflow-header-store";
import { UnsavedChangesDialog } from "@/shared/components/common/unsaved-changes-dialog";
import { useUnsavedChangesProtection } from "@/shared/hooks";

import { useAgentWorkflow, useAgentWorkflowVersions } from "@/features/agent-workflows/hooks";
import { workflowVersionsApi } from "@/shared/lib/api/workflow-versions";
import { agentWorkflowKeys } from "@/shared/lib/query-keys";
import { AgentWorkflowVersionPanel, SaveVersionDialog } from "@/features/agent-workflows/components/version-panel";
import { AgentWorkflowCanvas } from "@/features/agent-workflows/components/canvas/agent-workflow-canvas";
import { AgentWorkflowSettingsDialog } from "@/features/agent-workflows/components/settings";
import { AgentWorkflowLayout } from "@/features/agent-workflows/components/layout/agent-workflow-layout";
import {
  agentWorkflowStore,
  agentWorkflowActions,
  getConfiguration,
  settingsToApi,
  clearSelectionWithAutoSave,
  type AgentWorkflowMode,
} from "@/features/agent-workflows/stores/agent-workflow-store";
import {
  initWorkflowEventSubscriptions,
  cleanupWorkflowEventSubscriptions,
} from "@/features/agent-workflows/stores";
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
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { notify } from "@/shared/lib/ui/notify";

// =============================================================================
// COMPONENT
// =============================================================================

export function AgentWorkflowBuilderPage() {
  const { agentKey } = useParams({ from: "/_dashboard/agents/$agentKey" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workflow, isLoading, error } = useAgentWorkflow(agentKey);
  useAgentWorkflowVersions(agentKey); // Keep for cache warming

  // Dialog and panel state
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get store state
  const isDirty = useStore(agentWorkflowStore, (state) => state.isDirty);
  const mode = useStore(agentWorkflowStore, (state) => state.mode);
  const workflowStatus = useStore(agentWorkflowStore, (state) => state.settings.status);

  // Navigation protection for unsaved changes
  const { status: blockerStatus, proceed, reset } = useUnsavedChangesProtection({
    isDirty,
    enableBeforeUnload: false,
  });

  // Handle mode change - auto-open/close sidebar
  const handleModeChange = useCallback((newMode: AgentWorkflowMode) => {
    agentWorkflowActions.setMode(newMode);
  }, []);

  // Handle workflow selection - navigate to selected workflow
  const handleWorkflowSelect = useCallback(
    (workflowKey: string) => {
      navigate({ to: "/agents/$agentKey", params: { agentKey: workflowKey } });
    },
    [navigate]
  );

  // Auto-open sidebar when entering simulator mode, close when exiting
  useEffect(() => {
    setSidebarOpen(mode === "simulator");
  }, [mode]);

  // Initialize workflow SSE subscriptions for simulator updates
  useEffect(() => {
    initWorkflowEventSubscriptions();
    return () => {
      cleanupWorkflowEventSubscriptions();
    };
  }, []);

  // Initialize store when workflow loads
  useEffect(() => {
    if (workflow) {
      agentWorkflowActions.initialize(
        workflow.key,
        workflow.name,
        workflow.description || "",
        workflow.status,
        workflow.configuration,
        workflow.settings
      );
    }

    return () => {
      agentWorkflowActions.reset();
    };
  }, [workflow]);

  // Handle save - uses atomic save (single API call with server-side version ID)
  const handleSave = useCallback(
    async (options: { notes?: string; newStatus?: "draft" | "active" | "archived" }) => {
      const { settings } = agentWorkflowStore.state;
      const configuration = getConfiguration();
      const apiSettings = settingsToApi(settings);

      // Use new status from dialog if provided, otherwise use current settings status
      const finalStatus = options.newStatus ?? settings.status;

      try {
        // Single atomic call - updates workflow AND creates version in one transaction
        const result = await workflowVersionsApi.saveVersionAtomic(agentKey, {
          notes: options.notes,
          configuration,
          name: settings.name,
          description: settings.description,
          status: finalStatus,
          settings: apiSettings,
        });

        // Invalidate queries to refresh version list and workflow data
        await queryClient.invalidateQueries({ queryKey: agentWorkflowKeys.versions(agentKey) });
        await queryClient.invalidateQueries({ queryKey: agentWorkflowKeys.detail(agentKey) });

        // Update baseline BEFORE clearing dirty state
        // This ensures discardChanges reverts to last saved state, not initial load state
        agentWorkflowActions.commitSave();
        setShowSaveDialog(false);

        const action = finalStatus === "active" ? "Published" : "Saved";
        notify.success(`${action} as ${result.versionId}`);
      } catch {
        notify.error("Failed to save");
      }
    },
    [agentKey, queryClient]
  );

  // Handle save button click - commits form first, then opens the save dialog
  const handleSaveClick = useCallback(async () => {
    // Commit any open form changes first (closes panel if open)
    const success = await clearSelectionWithAutoSave();
    if (!success) {
      // Form validation failed, don't proceed
      return;
    }

    setShowSaveDialog(true);
  }, []);

  // Handle reset/discard changes
  const handleReset = useCallback(() => {
    setShowDiscardDialog(true);
  }, []);

  const handleConfirmDiscard = useCallback(() => {
    agentWorkflowActions.discardChanges();
    setShowDiscardDialog(false);
    notify.success("Changes discarded");
  }, []);

  // Populate header controls
  // Note: isDirty/canUndo/canRedo are read directly by AgentWorkflowHeaderControls
  // from agentWorkflowStore for proper reactivity (like JourneyHeaderControls)
  useEffect(() => {
    if (workflow) {
      agentWorkflowHeaderActions.setControls({
        workflowKey: agentKey,
        workflowName: workflow.name,
        workflowStatus: workflow.status,
        mode,
        onModeChange: handleModeChange,
        onWorkflowSelect: handleWorkflowSelect,
        onSave: handleSaveClick,
        onDiscard: handleReset,
        onUndo: () => agentWorkflowActions.undo(),
        onRedo: () => agentWorkflowActions.redo(),
        onHistoryClick: () => setShowVersionPanel(true),
        onSettings: () => agentWorkflowActions.openSettingsDialog(),
        onAutoLayout: (options) => agentWorkflowActions.applyAutoLayout(options),
      });
    }

    return () => {
      agentWorkflowHeaderActions.clearControls();
    };
  }, [workflow, agentKey, mode, handleModeChange, handleWorkflowSelect, handleSaveClick, handleReset]);

  // Handle restore version
  const handleRestoreVersion = useCallback(
    async (versionId: string): Promise<boolean> => {
      try {
        const versionData = await workflowVersionsApi.get(agentKey, versionId);
        // versionData.data is the WorkflowConfiguration from that version
        if (versionData?.data && workflow) {
          // Use current workflow metadata with restored configuration
          agentWorkflowActions.initialize(
            agentKey,
            workflow.name,
            workflow.description || "",
            workflow.status, // Keep current status
            versionData.data,
            workflow.settings // Keep current settings
          );
          // Mark as dirty since we restored but haven't saved yet
          agentWorkflowStore.setState((state) => ({ ...state, isDirty: true }));
          // Invalidate queries to refresh
          await queryClient.invalidateQueries({ queryKey: agentWorkflowKeys.versions(agentKey) });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [agentKey, workflow, queryClient]
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col h-full items-center justify-center">
        <Skeleton className="h-96 w-full max-w-4xl" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Agent not found</h2>
        <p className="text-muted-foreground">
          The agent "{agentKey}" does not exist or you don't have access to it.
        </p>
        <Button variant="outline" onClick={() => navigate({ to: "/agents" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <AgentWorkflowLayout
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
    >
      {/* Main Content - Canvas with overlay panels */}
      <div className="flex-1 overflow-hidden relative h-full">
        <AgentWorkflowCanvas readOnly={mode === "simulator"} />
      </div>

      {/* Version History Panel */}
      {showVersionPanel && (
        <AgentWorkflowVersionPanel
          workflowKey={agentKey}
          workflowName={workflow.name}
          onClose={() => setShowVersionPanel(false)}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Save Version Dialog with Status Selector */}
      <SaveVersionDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSave}
        currentStatus={workflowStatus}
        showStatusSelector={true}
        builderType="workflow"
      />

      {/* Agent Workflow Settings Dialog */}
      <AgentWorkflowSettingsDialog />

      {/* Navigation Protection Dialog */}
      <UnsavedChangesDialog
        open={blockerStatus === "blocked"}
        onProceed={proceed}
        onCancel={reset}
        title="Unsaved Changes"
        description="You have unsaved changes to this workflow. If you leave now, your changes will be lost."
      />

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
    </AgentWorkflowLayout>
  );
}
