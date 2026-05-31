/**
 * FollowUpPluginEditor Component
 *
 * Full editor for Follow-Up Plugin nodes.
 * Allows editing of:
 * - Plugin label and enabled state
 * - Follow-up steps (add, edit, remove, reorder)
 * - Step delays, content, and buttons
 * - Exit path configuration
 * - Cancel on response behavior
 *
 * @module features/nodes/journey/editors/plugin-editors/follow-up-plugin-editor
 */

import {
  Bell,
  BellOff,
  BellRing,
  Clock,
  Info,
  MessageCircle,
  Plus,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useExpandedSteps } from "../../hooks/use-expanded-steps";

import type { FollowUpPluginData, FollowUpStep, FollowUpAiConfig, Duration } from "@journey/schemas";
import { isFollowUpPluginData, parsePluginId, getNodePlugins } from "@journey/schemas";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { generateStepId } from "@/shared/lib/utils/id";
import { notify } from "@/shared/lib/ui/notify";
import { journeyNodesActions, journeyNodesStore } from "@/stores/journey-nodes-store";
import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { setPluginFollowUpButtonTargetNode, setPluginFollowUpExitPath } from "@/stores/store-actions";
import { useEditorMode } from "@/features/journey/builder/hooks/selectors/editor-selectors";

import { EditorBase } from "../editor-base";
import { useNodeEditorContext } from "../../hooks/use-node-editor-context";
import { NodeSelectorPopover } from "../components/node-selector-popover";
import { FollowUpStepEditor } from "./follow-up-step-editor";
import { AIContextSettingsSection } from "../sections/ai-context-settings-section";

// =============================================================================
// TYPES
// =============================================================================

interface FollowUpPluginEditorProps {
  /** Plugin ID */
  pluginId: string;
  /** Plugin data */
  pluginData: FollowUpPluginData;
  /** Parent node ID the plugin is attached to */
  parentNodeId: string;
  /** Close handler */
  onClose?: () => void;
  /** Delete handler */
  onDelete?: () => void;
  /** Read-only mode */
  readOnly?: boolean;
}

interface PluginFormValues {
  label: string;
  enabled: boolean;
  cancelOnAnyResponse: boolean;
  steps: FollowUpStep[];
  exitPath: { nodeId: string; timeout?: Duration } | undefined;
  ai: FollowUpAiConfig | undefined;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_STEPS = 5;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const FollowUpPluginEditor = memo(function FollowUpPluginEditor({
  pluginId,
  pluginData,
  parentNodeId,
  onClose,
  onDelete,
  readOnly: propsReadOnly,
}: FollowUpPluginEditorProps) {

  // Derive readOnly from store if not explicitly provided
  // This ensures correct behavior regardless of prop chain timing
  const { isEditMode } = useEditorMode();
  const readOnly = propsReadOnly ?? !isEditMode;

  // Get context for available nodes
  const context = useNodeEditorContext();

  // Track expanded steps (UI-only state, not in form)
  const expandedSteps = useExpandedSteps(pluginData.steps?.length ?? 0);

  // Saving state for UI feedback
  const [isSaving, setIsSaving] = useState(false);

  // Parse pluginId to get parent node and index for embedded plugin lookup
  const parsedPluginId = useMemo(() => parsePluginId(pluginId), [pluginId]);

  // Subscribe to node's embedded plugins for external changes (undo/redo)
  // The embedded plugin array is stored in node.data.plugins[]
  const currentPluginData = useStore(journeyNodesStore, (s) => {
    if (!parsedPluginId) return null;
    const node = s.nodes.find((n) => n.id === parsedPluginId.parentNodeId);
    if (!node) return null;
    const plugins = getNodePlugins(node.data);
    return plugins[parsedPluginId.pluginIndex] ?? null;
  });

  // Get initial data from store or prop
  const storeData: FollowUpPluginData =
    (currentPluginData && isFollowUpPluginData(currentPluginData) ? currentPluginData : null) ?? pluginData;

  // =========================================================================
  // FORM STATE MANAGEMENT
  // =========================================================================

  // Initialize form with plugin data
  const form = useForm({
    defaultValues: {
      label: storeData.label || "",
      enabled: storeData.enabled ?? true,
      cancelOnAnyResponse: storeData.cancelOnAnyResponse !== false,
      steps: storeData.steps ?? [],
      exitPath: storeData.exitPath,
      ai: storeData.ai,
    } as PluginFormValues,
  });

  // Track dirty state reactively via store subscription
  const isDirty = useStore(form.store, (state) => state.isDirty);

  // Track previous store data for external change detection
  const prevStoreDataRef = useRef(storeData);

  // Reset form on external data change (undo/redo) when form is not dirty
  useEffect(() => {
    if (prevStoreDataRef.current !== storeData && !isDirty) {
      form.reset({
        label: storeData.label || "",
        enabled: storeData.enabled ?? true,
        cancelOnAnyResponse: storeData.cancelOnAnyResponse !== false,
        steps: storeData.steps ?? [],
        exitPath: storeData.exitPath,
        ai: storeData.ai,
      });
    }
    prevStoreDataRef.current = storeData;
  }, [form, storeData, isDirty]);

  // Get current form values reactively - MUST use useStore to ensure proper re-renders
  // Using form.state.values directly causes form freezing after first edit
  const formValues = useStore(form.store, (state) => state.values) as PluginFormValues;

  // Available nodes for targeting (excludes parent node and start nodes)
  const availableNodes = useMemo(
    () =>
      context.nodes
        .filter((n) => n.id !== parentNodeId && n.data.type !== "start")
        .map((n) => ({
          id: n.id,
          label: n.data.label || n.id,
          type: n.data.type,
        })),
    [context.nodes, parentNodeId]
  );

  // =========================================================================
  // SAVE HANDLER
  // =========================================================================

  /**
   * Validate and save form data to store.
   * Called on explicit Save click or auto-save on close.
   * Syncs edges for button targets and exit path.
   */
  const validateAndSave = useCallback(async (): Promise<boolean> => {
    // Skip if nothing changed
    if (!form.state.isDirty) {
      return true;
    }

    setIsSaving(true);
    try {
      const values = form.state.values;

      // Note: Step content is now optional when AI is enabled (uses defaultInstructions → system default)

      // Update plugin data in store
      journeyNodesActions.updatePlugin(pluginId, {
        label: values.label,
        enabled: values.enabled,
        cancelOnAnyResponse: values.cancelOnAnyResponse,
        steps: values.steps,
        exitPath: values.exitPath,
        ai: values.ai,
      });

      // Sync edges for all button targets in steps
      values.steps.forEach((step, stepIndex) => {
        step.buttons?.forEach((btn) => {
          if (btn.targetNodeId) {
            setPluginFollowUpButtonTargetNode(pluginId, stepIndex, btn.id, btn.targetNodeId);
          }
        });
      });

      // Sync exit path edge
      setPluginFollowUpExitPath(pluginId, values.exitPath?.nodeId);

      // Reset form to mark as clean
      form.reset(values);
      notify.success("Changes saved");

      return true;
    } catch {
      notify.error("Failed to save changes");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [form, pluginId]);

  // =========================================================================
  // FORM FIELD HANDLERS
  // =========================================================================

  // Label change
  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      form.setFieldValue("label", e.target.value);
    },
    [form]
  );

  // Enabled toggle
  const handleEnabledChange = useCallback(
    (checked: boolean) => {
      form.setFieldValue("enabled", checked);
    },
    [form]
  );

  // Cancel on response toggle
  const handleCancelOnResponseChange = useCallback(
    (checked: boolean) => {
      form.setFieldValue("cancelOnAnyResponse", checked);
    },
    [form]
  );

  // AI enabled toggle - no content migration for predictable round-trip behavior
  const handleAiEnabledChange = useCallback(
    (checked: boolean) => {
      const currentAi = form.state.values.ai;
      // No content migration - user manages fields manually
      // This ensures toggle OFF → ON is a true round-trip that preserves state
      form.setFieldValue("ai", {
        ...currentAi,
        enabled: checked,
      } as FollowUpAiConfig);
    },
    [form]
  );

  // AI context settings change (for AIContextSettingsSection and defaultInstructions)
  const handleAiContextChange = useCallback(
    (updates: Partial<FollowUpAiConfig>) => {
      const currentAi = form.state.values.ai;
      form.setFieldValue("ai", {
        ...currentAi,
        enabled: currentAi?.enabled ?? true,
        ...updates,
      } as FollowUpAiConfig);
    },
    [form]
  );

  // Add new step
  const handleAddStep = useCallback(() => {
    const newStep: FollowUpStep = {
      id: generateStepId(),
      delay: { minutes: 30 },
      content: "",
      buttons: [],
      exitOnTimeout: false,
    };
    const currentSteps = form.state.values.steps;
    const updatedSteps = [...currentSteps, newStep];
    form.setFieldValue("steps", updatedSteps);

    // Expand the new step
    expandedSteps.onStepAdded(updatedSteps.length - 1);
  }, [form, expandedSteps]);

  // Update a step
  const handleUpdateStep = useCallback(
    (index: number, updates: Partial<FollowUpStep>) => {
      const currentSteps = [...form.state.values.steps];
      if (!currentSteps[index]) return;
      currentSteps[index] = { ...currentSteps[index], ...updates };
      form.setFieldValue("steps", currentSteps);
    },
    [form]
  );

  // Remove a step
  const handleRemoveStep = useCallback(
    (index: number) => {
      const currentSteps = [...form.state.values.steps];
      currentSteps.splice(index, 1);
      form.setFieldValue("steps", currentSteps);

      // Update expanded steps (shift indices)
      expandedSteps.onStepRemoved(index);
    },
    [form, expandedSteps]
  );

  // Button target change (updates form state only, edge sync happens on save)
  const handleButtonTargetChange = useCallback(
    (stepIndex: number, buttonId: string, targetNodeId: string | undefined) => {
      const currentSteps = [...form.state.values.steps];
      const step = currentSteps[stepIndex];
      if (!step?.buttons) return;

      step.buttons = step.buttons.map((btn) =>
        btn.id === buttonId
          ? { ...btn, targetNodeId: targetNodeId ?? "" }
          : btn
      );
      form.setFieldValue("steps", currentSteps);
    },
    [form]
  );

  // Exit path change (updates form state only, edge sync happens on save)
  const handleExitPathChange = useCallback(
    (nodeId: string) => {
      const currentExitPath = form.state.values.exitPath;
      const exitPath = nodeId ? { nodeId, timeout: currentExitPath?.timeout } : undefined;
      form.setFieldValue("exitPath", exitPath);
    },
    [form]
  );

  // Exit path timeout change
  const handleExitPathTimeoutChange = useCallback(
    (field: keyof Duration, value: string) => {
      const currentExitPath = form.state.values.exitPath;
      if (!currentExitPath) return;

      const numValue = value === "" ? undefined : parseInt(value, 10);
      const newTimeout: Duration = { ...currentExitPath.timeout, [field]: numValue };

      // Clear timeout if all fields are empty
      const hasValue = Object.values(newTimeout).some((v) => v !== undefined && v > 0);
      form.setFieldValue("exitPath", {
        ...currentExitPath,
        timeout: hasValue ? newTimeout : undefined,
      });
    },
    [form]
  );

  // =========================================================================
  // CANCEL HANDLER
  // =========================================================================

  /**
   * Reset form to initial plugin data values.
   * Used for cancel action to discard unsaved changes.
   */
  const resetForm = useCallback(() => {
    form.reset({
      label: storeData.label || "",
      enabled: storeData.enabled ?? true,
      cancelOnAnyResponse: storeData.cancelOnAnyResponse !== false,
      steps: storeData.steps ?? [],
      exitPath: storeData.exitPath,
      ai: storeData.ai,
    });
  }, [form, storeData]);

  /**
   * Cancel handler: reset form (does not close editor).
   */
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  // =========================================================================
  // RENDER
  // =========================================================================

  const stepCount = formValues.steps.length;
  const canAddStep = stepCount < MAX_STEPS;

  return (
    <EditorBase
      title="Follow-Up Plugin"
      nodeId={pluginId}
      onClose={onClose}
      onDelete={onDelete}
      onAutoSaveClose={validateAndSave}
      onSave={validateAndSave}
      onCancel={handleCancel}
      isSaving={isSaving}
      isDirty={isDirty}
      readOnly={readOnly}
    >
      {/* Header with Label and Status */}
      <div className="space-y-4">
        {/* Label Input */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Label</Label>
          <Input
            value={formValues.label}
            onChange={handleLabelChange}
            placeholder="Follow-Up Sequence"
            className="h-8 text-sm"
            disabled={readOnly}
          />
        </div>

        {/* Status Toggle */}
        <div className="flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
              <MessageCircle className="size-4" />
            </div>
            <div>
              <div className="text-sm font-medium">
                {formValues.enabled ? "Active" : "Disabled"}
              </div>
              <div className="text-xs text-muted-foreground">
                {stepCount} step{stepCount !== 1 ? "s" : ""} configured
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {formValues.enabled ? (
              <Bell className="size-4 text-muted-foreground" />
            ) : (
              <BellOff className="size-4 text-muted-foreground" />
            )}
            <Switch
              checked={formValues.enabled}
              onCheckedChange={handleEnabledChange}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* AI Generation Section */}
        <AIContextSettingsSection
          values={formValues.ai}
          onChange={handleAiContextChange}
          nodeId={pluginId}
          readOnly={readOnly}
          showModelSelector={true}
          showEnabledToggle={true}
          isEnabled={formValues.ai?.enabled ?? false}
          onEnabledChange={handleAiEnabledChange}
        />

        {/* Default Instructions when AI is enabled */}
        {formValues.ai?.enabled && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Default Instructions</Label>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs max-w-[200px]">
                      Used when a step has no task instructions. Leave empty for system default.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              value={formValues.ai?.defaultInstructions ?? ""}
              onChange={(e) => handleAiContextChange({ defaultInstructions: e.target.value || undefined })}
              placeholder="e.g., Generate a friendly follow-up based on context. Match user's language."
              className="min-h-[60px] text-sm resize-y"
              disabled={readOnly}
            />
            <p className="text-[10px] text-muted-foreground">
              System default: "Analyze context and generate a friendly notification. Match user's language."
            </p>
          </div>
        )}
      </div>

      {/* Steps Section */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Follow-Up Steps</Label>
          {!readOnly && canAddStep && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleAddStep}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Step
            </Button>
          )}
        </div>

        {stepCount > 0 ? (
          <div className="space-y-2">
            {formValues.steps.map((step, index) => (
              <FollowUpStepEditor
                key={step.id}
                step={step}
                stepIndex={index}
                availableNodes={availableNodes}
                onUpdate={(updates) => handleUpdateStep(index, updates)}
                onRemove={() => handleRemoveStep(index)}
                onButtonTargetChange={(buttonId, targetNodeId) =>
                  handleButtonTargetChange(index, buttonId, targetNodeId)
                }
                isExpanded={expandedSteps.isExpanded(index)}
                onToggleExpand={() => expandedSteps.toggleStep(index)}
                readOnly={readOnly}
                aiEnabled={formValues.ai?.enabled ?? false}
                cancelOnAnyResponse={formValues.cancelOnAnyResponse}
              />
            ))}
          </div>
        ) : (
          <div className="py-6 text-center border border-dashed border-border/50 rounded-md">
            <BellRing className="size-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No follow-up steps configured
            </p>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleAddStep}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add First Step
              </Button>
            )}
          </div>
        )}

        {!canAddStep && (
          <p className="text-[10px] text-muted-foreground text-center">
            Maximum {MAX_STEPS} steps allowed
          </p>
        )}
      </div>

      {/* Exit Path Section */}
      <div className="space-y-3 pt-4 border-t border-border/50">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium">Exit Path</Label>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs max-w-[200px]">
                    Navigate here when sequence ends without user response. If not set, user stays on this node.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Where to go when sequence ends without response
          </p>
        </div>
        <NodeSelectorPopover
          value={formValues.exitPath?.nodeId ?? ""}
          onChange={handleExitPathChange}
          nodes={availableNodes}
          disabled={readOnly}
          placeholder="Select exit node..."
          allowNone
          noneLabel="No exit path (end journey)"
          className="w-full"
        />

        {/* Response Timeout (only shown when exit path is set) */}
        {formValues.exitPath?.nodeId && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              <span>Wait for response before exiting</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={formValues.exitPath.timeout?.minutes ?? ""}
                  onChange={(e) => handleExitPathTimeoutChange("minutes", e.target.value)}
                  placeholder="0"
                  className="h-7 text-xs"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Sec</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={formValues.exitPath.timeout?.seconds ?? ""}
                  onChange={(e) => handleExitPathTimeoutChange("seconds", e.target.value)}
                  placeholder="59"
                  className="h-7 text-xs"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Hours</Label>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  value={formValues.exitPath.timeout?.hours ?? ""}
                  onChange={(e) => handleExitPathTimeoutChange("hours", e.target.value)}
                  placeholder="0"
                  className="h-7 text-xs"
                  disabled={readOnly}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              After sending the last follow-up, wait this long for user to respond. Default: 59 seconds.
            </p>
          </div>
        )}
      </div>

      {/* Response Handling Section */}
      <div className="space-y-3 pt-4 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-medium">Response Handling</Label>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs max-w-[200px]">
                  Controls what happens when user sends a message while follow-ups are active
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <div className="text-sm">Stop on User Reply</div>
            <p className="text-[10px] text-muted-foreground">
              When user replies, stop sending follow-ups
            </p>
          </div>
          <Switch
            checked={formValues.cancelOnAnyResponse}
            onCheckedChange={handleCancelOnResponseChange}
            disabled={readOnly}
          />
        </div>
      </div>

      {/* Read-only notice */}
      {readOnly && (
        <div className="mt-4 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground text-center">
          View mode - switch to edit mode to make changes
        </div>
      )}
    </EditorBase>
  );
});
