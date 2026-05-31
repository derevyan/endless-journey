/**
 * Edge Editor Form Hook
 *
 * Form hook for editing edge properties (guard, fallback, label).
 * Note: edgeType is read-only and not editable via the form.
 * Uses TanStack Form for state management and validation.
 *
 * Auto-save pattern:
 * - Returns validateAndSave() for auto-save on panel close
 * - Returns isDirty to check if there are unsaved form changes
 *
 * Uses EditorActionsContext for dependency injection, enabling:
 * - Component isolation and testability
 * - Mock actions for unit tests without store setup
 */

import { createLogger } from "@journey/logger";
import type { EdgeGuard } from "@journey/schemas";
import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useState, useRef } from "react";

import type { JourneyEdge } from "@/features/nodes/journey/react-flow-types";
import { journeyNodesActions } from "@/stores/journey-nodes-store";
import { saveManagerActions } from "@/stores/save-manager-store";

const log = createLogger("edge-editor-form");

/**
 * Form values for edge editor
 * Note: edgeType is read-only (determined by source node) and not included here
 */
export interface EdgeFormValues {
  label: string;
  guard: EdgeGuard | null;
  fallback: boolean;
}

/**
 * Extract form values from edge
 */
function extractEdgeFields(edge: JourneyEdge): EdgeFormValues {
  // Get the guard from the edge (schema includes guard and fallback fields)
  const edgeWithGuard = edge as JourneyEdge & { guard?: EdgeGuard; fallback?: boolean };

  // Edge.label can be ReactNode, but we only support string labels
  const labelValue = typeof edge.label === "string" ? edge.label : "";

  return {
    label: labelValue,
    guard: edgeWithGuard.guard ?? null,
    fallback: edgeWithGuard.fallback ?? false,
  };
}

// ============================================================================
// Types
// ============================================================================

export interface UseEdgeEditorFormReturn {
  /** TanStack Form API */
  form: ReturnType<typeof useForm>;
  /** Whether form has unsaved changes */
  isDirty: boolean;
  /** Whether save is in progress */
  isSaving: boolean;
  /**
   * Validate and save form data. Used for auto-save on panel close.
   * @returns true if saved successfully
   */
  validateAndSave: () => Promise<boolean>;
  /** Field-level validation errors (path -> message) */
  validationErrors: Map<string, string>;
  /** Reset form to initial edge values (for cancel) */
  resetForm: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Form hook for edge editor
 *
 * Auto-save pattern:
 * - Returns validateAndSave() for auto-save on panel close
 * - Returns isDirty to check if there are unsaved form changes
 *
 * Now uses SaveManager for centralized dirty state tracking.
 */
export function useEdgeEditorForm(edge: JourneyEdge): UseEdgeEditorFormReturn {
  // Track saving state for UI feedback
  const [isSaving, setIsSaving] = useState(false);

  // Field-level validation errors for form highlighting (currently unused but provided for API consistency)
  const [validationErrors] = useState<Map<string, string>>(new Map());

  // Initialize form with edge data
  // TanStack Form infers type from defaultValues - no cast needed
  const form = useForm({
    defaultValues: extractEdgeFields(edge),
    onSubmit: async () => {
      // onSubmit is now a no-op - we use validateAndSave instead
      // This is kept for TanStack Form compatibility
    },
  });

  // Track form dirty state to enable Header Save while typing
  const isDirty = useStore(form.store, (state) => state.isDirty);

  // Sync dirty state to SaveManager (centralized tracking)
  useEffect(() => {
    saveManagerActions.setFormDirty(edge.id, isDirty);
  }, [edge.id, isDirty]);

  // Track previous edge data for external change detection
  const prevEdgeIdRef = useRef(edge.id);
  const prevEdgeLabelRef = useRef(edge.label);

  // Reset form on edge ID change OR external data change (when form is not dirty)
  // This handles: 1) switching between edges, 2) external updates (undo/redo, discard)
  useEffect(() => {
    const edgeIdChanged = prevEdgeIdRef.current !== edge.id;
    const labelChanged = prevEdgeLabelRef.current !== edge.label;

    // Always reset on edge ID change
    if (edgeIdChanged) {
      form.reset(extractEdgeFields(edge));
      prevEdgeIdRef.current = edge.id;
      prevEdgeLabelRef.current = edge.label;
      return;
    }

    // Reset on external data change ONLY if form is not dirty
    // This prevents losing user edits when store updates
    if (labelChanged && !isDirty) {
      form.reset(extractEdgeFields(edge));
      prevEdgeLabelRef.current = edge.label;
    }
  }, [form, edge, isDirty]);

  /**
   * Validate and save edge form data.
   * Used for auto-save on panel close.
   *
   * @returns true (edge form has no validation that can fail)
   */
  const validateAndSave = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const value = form.state.values as EdgeFormValues;

      // Build edge updates (edgeType is read-only, not included)
      const updates: Partial<JourneyEdge> & { guard?: EdgeGuard | null; fallback?: boolean } = {
        label: value.label || undefined,
        guard: value.guard ?? undefined,
        fallback: value.fallback || undefined,
      };

      // Update edge via store action
      journeyNodesActions.updateEdge(edge.id, updates as Partial<JourneyEdge>);

      // Reset form dirty state after successful save
      // CRITICAL: Use form.state.values instead of re-extracting from edge
      // This avoids stale references and extractor asymmetries
      form.reset(form.state.values);

      log.info({ edgeId: edge.id, updates }, "edgeEditorForm:saved");

      return true;
    } finally {
      setIsSaving(false);
    }
  }, [form, edge]);

  // Register auto-save handler with SaveManager using edgeId for proper ownership
  // This enables canvas clicks and mode switches to flush pending changes
  useEffect(() => {
    saveManagerActions.registerEditor(edge.id, validateAndSave);
    log.debug({ edgeId: edge.id }, "edgeEditorForm:registered");

    return () => {
      saveManagerActions.unregisterEditor(edge.id);
      log.debug({ edgeId: edge.id }, "edgeEditorForm:unregistered");
    };
  }, [edge.id, validateAndSave]);

  /**
   * Reset form to initial edge values.
   * Used for cancel action to discard unsaved changes.
   */
  const resetForm = useCallback(() => {
    form.reset(extractEdgeFields(edge));
    log.debug({ edgeId: edge.id }, "edgeEditorForm:reset");
  }, [form, edge]);

  // Cast form to expected return type - TanStack Form's complex generics
  // require this bridge when using type-inferred defaultValues
  return {
    form: form as ReturnType<typeof useForm>,
    isDirty,
    isSaving,
    validateAndSave,
    validationErrors,
    resetForm,
  };
}
