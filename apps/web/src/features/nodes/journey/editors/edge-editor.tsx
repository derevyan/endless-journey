/**
 * EdgeEditor Component
 *
 * Editor panel for edge properties: label, type, guard, and fallback.
 * Uses EditorBase for consistent shell with other node editors.
 *
 * Only shown for editable edges (not managed edges).
 * Check editability with: !ManagedEdgeId.is(id)
 */

import { useCallback } from "react";

import { useEditorActionsContext } from "@/features/journey/builder/context";
import { useEditorJourneyData, useEditorMode } from "@/features/journey/builder/hooks/selectors/editor-selectors";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { ArrowRight, LifeBuoy } from "lucide-react";

import { journeyNodesActions } from "@/stores/journey-nodes-store";
import { useEdgeEditorForm } from "../hooks/use-edge-editor-form";
import type { StringFieldApi, BooleanFieldApi } from "../forms/form-types";
import type { JourneyEdge } from "../react-flow-types";
import { EditorBase } from "./editor-base";
import { DynamicEdgeSections } from "../edges/dynamic-edge-sections";

interface EdgeEditorProps {
  edge: JourneyEdge;
  onClose?: () => void;
  readOnly?: boolean;
}

/**
 * Edge type options for dropdown
 */
const EDGE_TYPE_OPTIONS = [
  { value: "default", label: "Default", description: "Standard transition" },
  { value: "success", label: "Success", description: "Success path (green)" },
  { value: "timer", label: "Timer", description: "Timeout transition (orange)" },
  { value: "retry", label: "Retry", description: "Error/retry path" },
  { value: "dropoff", label: "Drop-off", description: "Exit journey path" },
  { value: "exit", label: "Exit", description: "Clean exit path" },
] as const;

export function EdgeEditor({ edge, onClose, readOnly: propReadOnly }: EdgeEditorProps) {
  // Derive readOnly from store if not explicitly provided
  const { isEditMode } = useEditorMode();
  const effectiveReadOnly = propReadOnly ?? !isEditMode;

  // Get journey data for variable resolution in guards
  const { nodes, edges, journeyId } = useEditorJourneyData();

  // Get injected actions from context
  const { clearSelection } = useEditorActionsContext();

  // Initialize form with auto-save support
  const { form, isDirty, isSaving, validateAndSave, resetForm } = useEdgeEditorForm(edge);

  // Handle delete
  const handleDelete = useCallback(() => {
    journeyNodesActions.deleteEdge(edge.id);
    clearSelection();
  }, [edge.id, clearSelection]);

  // Cancel handler: reset form (does not close editor)
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  return (
    <EditorBase
      title={effectiveReadOnly ? "Edge Details" : "Edit Edge"}
      nodeId={edge.id}
      onClose={onClose}
      onDelete={handleDelete}
      onAutoSaveClose={validateAndSave}
      onSave={validateAndSave}
      onCancel={handleCancel}
      isSaving={isSaving}
      isDirty={isDirty}
      readOnly={effectiveReadOnly}
      testId="edge-editor"
    >
      {/* Edge Info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowRight className="h-3 w-3" />
        <span className="font-mono">{edge.source}</span>
        <span>→</span>
        <span className="font-mono">{edge.target}</span>
      </div>

      {/* Label */}
      <form.Field name="label">
        {(field: StringFieldApi) => (
          <div className="space-y-2">
            <Label htmlFor={`label-${edge.id}`} className="text-xs font-medium">
              Label
            </Label>
            <Input
              id={`label-${edge.id}`}
              value={field.state.value || ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="e.g., 'Success', 'On timeout'"
              className="text-sm"
              disabled={effectiveReadOnly}
            />
            <p className="text-[10px] text-muted-foreground">Optional label shown on the edge.</p>
          </div>
        )}
      </form.Field>

      {/* Edge Type (Read-only) */}
      {(() => {
        const edgeTypeValue = edge.edgeType || "default";
        const selectedOption = EDGE_TYPE_OPTIONS.find((opt) => opt.value === edgeTypeValue);

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium">Edge Type</Label>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50 text-sm">
              <span>{selectedOption?.label || "Default"}</span>
              <span className="text-xs text-muted-foreground">({selectedOption?.description})</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Edge type is determined by the source node configuration and cannot be changed directly.</p>
          </div>
        );
      })()}

      {/* Dynamic Edge Sections (Guard, etc.) */}
      <DynamicEdgeSections
        edge={edge}
        form={form}
        readOnly={effectiveReadOnly}
        nodes={nodes}
        edges={edges}
        journeyId={journeyId}
      />

      {/* Fallback Toggle */}
      <form.Field name="fallback">
        {(field: BooleanFieldApi) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-green-600" />
                <Label htmlFor={`fallback-${edge.id}`} className="text-xs font-medium">
                  Fallback Edge
                </Label>
              </div>
              <Switch
                id={`fallback-${edge.id}`}
                checked={field.state.value || false}
                onCheckedChange={(checked) => field.handleChange(checked)}
                disabled={effectiveReadOnly}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Used as safety net when all other edges' guards fail. Only one edge per node should be marked as fallback.
            </p>
          </div>
        )}
      </form.Field>
    </EditorBase>
  );
}
