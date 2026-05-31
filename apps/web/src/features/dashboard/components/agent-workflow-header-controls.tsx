/**
 * Agent Workflow Header Controls
 *
 * Self-managing component that renders agent workflow-specific controls in the dashboard header.
 * Includes workflow selector dropdown, mode switch, undo/redo, save/discard actions, and version history.
 *
 * Layout follows JourneyHeaderControls for UI consistency:
 * - WorkflowSelector → ModeSwitch → [Edit actions only in edit mode]
 *
 * Note: Like JourneyHeaderControls, this component reads reactive state (isDirty, canUndo, canRedo)
 * directly from the canvas store for proper reactivity, while callbacks come from the header store.
 *
 * @module components/dashboard/agent-workflow-header-controls
 */

import { useStore } from "@tanstack/react-store";
import { History, LayoutGrid, Redo2, Rocket, RotateCcw, Settings, Undo2 } from "lucide-react";

import { agentWorkflowHeaderStore } from "@/features/dashboard/store/agent-workflow-header-store";
import { agentWorkflowStore, agentWorkflowActions } from "@/features/agent-workflows/stores/agent-workflow-store";
import { saveManagerStore } from "@/stores/save-manager-store";
import { AgentWorkflowSelector } from "@/features/agent-workflows/components/agent-workflow-selector";
import { Button } from "@/shared/components/ui/button";
import { ModeSwitch } from "@/shared/components/ui/mode-switch";
import { Separator } from "@/shared/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

/**
 * Self-managing Agent Workflow Header Controls.
 * Reads callbacks from agentWorkflowHeaderStore, reactive state from agentWorkflowStore.
 */
export function AgentWorkflowHeaderControls() {
  // Get callbacks and metadata from header store
  const {
    workflowKey,
    mode,
    onModeChange,
    onWorkflowSelect,
    onSave,
    onDiscard,
    onUndo,
    onRedo,
    onHistoryClick,
    onSettings,
    onAutoLayout,
    isActive,
  } = useStore(agentWorkflowHeaderStore);

  // Get reactive state directly from stores (aligned with JourneyHeaderControls pattern)
  // Canvas dirty = node moves, edge changes, layout changes
  const canvasDirty = useStore(agentWorkflowStore, (s) => s.isDirty);
  // Form dirty = active form has unsaved changes (tracked by saveManagerStore)
  const formDirtyMap = useStore(saveManagerStore, (s) => s.formDirtyMap);
  const hasFormDirty = Object.values(formDirtyMap).some(Boolean);
  // Combined dirty state for save button
  const isDirty = canvasDirty || hasFormDirty;

  const canUndo = useStore(agentWorkflowStore, (s) => s.history.past.length > 0);
  const canRedo = useStore(agentWorkflowStore, (s) => s.history.future.length > 0);
  const autoLayoutPanelOpen = useStore(agentWorkflowStore, (s) => s.autoLayoutPanelOpen);

  const isEditMode = mode === "edit";

  // Don't render if not on workflow page
  if (!isActive) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Workflow Selector */}
        {workflowKey && onWorkflowSelect && (
          <AgentWorkflowSelector
            selectedWorkflowKey={workflowKey}
            onWorkflowSelect={onWorkflowSelect}
          />
        )}

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Mode Switch - Edit/Simulator (same position as journey header) */}
        {onModeChange && <ModeSwitch mode={mode} onModeChange={onModeChange} />}

        {/* Edit Actions - Only visible in edit mode (same as journey header) */}
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
                    onClick={() => agentWorkflowActions.toggleAutoLayoutPanel()}
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
                <Button variant="ghost" size="icon" onClick={onSave ?? undefined} disabled={!isDirty} className="h-7 w-7">
                  <Rocket className={cn("h-3.5 w-3.5", isDirty && "text-foreground")} />
                  <span className="sr-only">Publish</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isDirty ? "Publish changes" : "No changes to publish"}</TooltipContent>
            </Tooltip>

            {/* Discard */}
            {onDiscard && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDiscard}
                    disabled={!isDirty}
                    className={cn("h-7 w-7", isDirty && "text-foreground")}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="sr-only">Discard</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Discard all changes</TooltipContent>
              </Tooltip>
            )}

            {/* History */}
            {onHistoryClick && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onHistoryClick} className="h-7 w-7">
                    <History className="h-3.5 w-3.5" />
                    <span className="sr-only">History</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Version history</TooltipContent>
              </Tooltip>
            )}

            {/* Settings - icon-only like journey header */}
            {onSettings && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSettings}
                    className="h-7 w-7"
                    data-testid="workflow-settings-button"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span className="sr-only">Settings</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Workflow settings</TooltipContent>
              </Tooltip>
            )}

            {/* Unsaved indicator */}
            {isDirty && (
              <span className="text-xs text-amber-600 dark:text-amber-400 px-2 font-medium">Unsaved</span>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
