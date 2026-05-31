/**
 * Workflow Node Form Hook
 *
 * TanStack Form hook for workflow node configuration with auto-save pattern.
 * Changes are auto-saved when closing the panel via X button or canvas click.
 *
 * Simplified auto-save:
 * - Always calls validateAndSave on panel close (idempotent operation)
 * - No isDirty tracking for auto-save - handler validates and saves if needed
 * - Form isDirty tracked reactively via useStore for Save button UI only
 *
 * @module features/nodes/workflow/hooks/use-workflow-node-form
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { z } from "zod";
import { createLogger, serializeError } from "@journey/logger";
import type { WorkflowNodeType } from "@journey/schemas";

import { extractZodErrors } from "@/shared/lib/validation-utils";
import { notify } from "@/shared/lib/ui/notify";

import { agentWorkflowActions } from "@/features/agent-workflows/stores/agent-workflow-store";
import { useFormAutoSave } from "@/features/nodes/shared/hooks";
import type { NodeFormConfig } from "@/features/nodes/shared/frontend-descriptor";

import { workflowFormRegistry } from "../forms/form-registry";
import type { WorkflowNodeFormApi, WorkflowFormStoreState } from "../forms/workflow-form-types";

const log = createLogger("workflow-node-form");

// =============================================================================
// TYPES
// =============================================================================

export interface UseWorkflowNodeFormOptions {
  /** Node ID */
  nodeId: string;
  /** Node type */
  nodeType: WorkflowNodeType;
  /** Node data */
  data: unknown;
  /** Callback after successful save */
  onSaveSuccess?: () => void;
  /** Form behavior configuration */
  formConfig?: NodeFormConfig;
}

export interface UseWorkflowNodeFormReturn {
  /** TanStack Form API */
  form: WorkflowNodeFormApi;
  /** Whether form has unsaved changes (tracked reactively via useStore) */
  isDirty: boolean;
  /** Whether save is in progress */
  isSaving: boolean;
  /**
   * Validate and save form data. Used for auto-save on panel close.
   * Idempotent - safe to call even when no changes exist.
   * @returns true if saved successfully, false if validation failed
   */
  validateAndSave: (options?: SaveOptions) => Promise<boolean>;
  /** Field-level validation errors (path -> message) */
  validationErrors: Map<string, string>;
  /** Reset form to initial node values (for cancel) */
  resetForm: () => void;
}

export interface SaveOptions {
  notifyOnSuccess?: boolean;
  notifyOnError?: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for managing workflow node configuration forms.
 *
 * Features:
 * - Auto-save pattern (changes saved when panel closes)
 * - Zod validation before save
 * - Automatic sync when node data changes externally (undo/redo)
 *
 * @example
 * ```tsx
 * const { form, isDirty, validateAndSave } = useWorkflowNodeForm({
 *   nodeId: node.id,
 *   nodeType: "guard",
 *   data: node.data,
 * });
 *
 * // Pass validateAndSave to EditorPanel for auto-save on close
 * return (
 *   <EditorPanel onAutoSaveClose={validateAndSave} isDirty={isDirty}>
 *     <form.Field name="blockedMessage">
 *       {(field) => <Input value={field.state.value} onChange={...} />}
 *     </form.Field>
 *   </EditorPanel>
 * );
 * ```
 */
export function useWorkflowNodeForm({
  nodeId,
  nodeType,
  data,
  onSaveSuccess,
  formConfig,
}: UseWorkflowNodeFormOptions): UseWorkflowNodeFormReturn {
  const autoSaveEnabled = formConfig?.autoSave ?? true;
  const saveDebounceMs = formConfig?.saveDebounceMs ?? 300;

  // Get schema for validation
  const schema = workflowFormRegistry.getSchema(nodeType);

  // Extract initial form values from node data
  const defaultValues = extractWorkflowValues(nodeType, data);

  // Field-level validation errors for form highlighting (defined before useForm for onSubmit access)
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  // Create form - no onChange listener needed, we track isDirty reactively via useStore
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      // Validate with Zod if schema exists
      if (schema) {
        try {
          schema.parse(value);
          // Clear errors on successful validation
          setValidationErrors(new Map());
        } catch (error) {
          if (error instanceof z.ZodError) {
            setValidationErrors(extractZodErrors(error));
            log.error(
              { nodeId, nodeType, validationErrors: error.issues, err: serializeError(error) },
              "workflowNodeForm:validation:failed"
            );
            notify.error("Validation failed", {
              description: error.issues.map((e) => e.message).join(", "),
            });
            return;
          }
          throw error;
        }
      }

      // Build node data from form values
      const nodeData = buildWorkflowNodeData(nodeType, value, data);

      // Update store
      agentWorkflowActions.updateNodeData(nodeId, nodeData as Record<string, unknown>);

      // Call success callback if provided
      onSaveSuccess?.();
    },
  });

  // Track isDirty reactively via useStore - works for ALL field changes including
  // programmatic setFieldValue calls (toggles, selects, checkboxes)
  const isDirty = useStore(form.store, (state: WorkflowFormStoreState) => state.isDirty);
  const formValues = useStore(form.store, (state: WorkflowFormStoreState) => state.values);

  // Track saving state for UI feedback (spinner on Save button)
  const [isSaving, setIsSaving] = useState(false);

  // Validate and save for auto-save pattern
  // Idempotent - skip if nothing changed to avoid store thrashing
  const validateAndSave = useCallback(
    async (options: SaveOptions = {}): Promise<boolean> => {
      const notifyOnSuccess = options.notifyOnSuccess ?? true;
      const notifyOnError = options.notifyOnError ?? true;
    // Early return if nothing changed - prevents redundant store updates
    if (!form.state.isDirty) {
      log.debug({ nodeId, nodeType }, "workflowNodeForm:validateAndSave:skipped:notDirty");
      return true;
    }

    setIsSaving(true);

    try {
      const value = form.state.values;

      // Validate with Zod if schema exists
      if (schema) {
        try {
          schema.parse(value);
          // Clear errors on successful validation
          setValidationErrors(new Map());
        } catch (error) {
          if (error instanceof z.ZodError) {
            setValidationErrors(extractZodErrors(error));
            log.error(
              { nodeId, nodeType, validationErrors: error.issues, err: serializeError(error) },
              "workflowNodeForm:validateAndSave:failed"
            );
            if (notifyOnError) {
              notify.error("Validation failed", {
                description: error.issues.map((e) => e.message).join(", "),
              });
            }
            return false;
          }
          throw error;
        }
      }

      // Build node data from form values
      const nodeData = buildWorkflowNodeData(nodeType, value, data);

      // Update store
      agentWorkflowActions.updateNodeData(nodeId, nodeData as Record<string, unknown>);

      // Show success toast
      if (notifyOnSuccess) {
        notify.success("Changes saved");
      }

      log.info({ nodeId, nodeType }, "workflowNodeForm:autoSaved");

      // Mark that we just saved to avoid self-reset loop in the reset effect
      justSavedRef.current = true;

      // Reset form dirty state after successful save
      // CRITICAL: Use form.state.values instead of local variable to avoid stale references
      form.reset(form.state.values);

      return true;
    } finally {
      setIsSaving(false);
    }
    },
    [form, schema, nodeId, nodeType, data]
  );

  // Use shared auto-save hook for dirty state sync, debounced save, and save manager registration
  // Note: Dirty state is tracked via saveManagerStore.formDirtyMap (updated by setFormDirty)
  // which the header controls read directly (aligned with Journey pattern)
  useFormAutoSave({
    editorId: nodeId,
    isDirty,
    formValues,
    autoSaveEnabled,
    saveDebounceMs,
    validateAndSave,
  });

  // Track previous node data for external change detection
  const prevNodeIdRef = useRef(nodeId);
  const prevDataRef = useRef(data);
  // Track when we just saved to avoid self-reset loop
  const justSavedRef = useRef(false);

  // Reset form on node ID change OR external data change (when form is not dirty)
  // This handles: 1) switching between nodes, 2) external updates (undo/redo, discard)
  useEffect(() => {
    const nodeIdChanged = prevNodeIdRef.current !== nodeId;
    const dataChanged = prevDataRef.current !== data;

    // Always reset on node ID change
    if (nodeIdChanged) {
      form.reset(extractWorkflowValues(nodeType, data));
      prevNodeIdRef.current = nodeId;
      prevDataRef.current = data;
      justSavedRef.current = false;
      return;
    }

    // Reset on external data change ONLY if form is not dirty
    // This prevents losing user edits when store updates
    if (dataChanged && !isDirty) {
      // Skip reset if we just saved (avoid self-reset loop)
      // The data change came from our own auto-save, not an external source
      if (justSavedRef.current) {
        justSavedRef.current = false;
        prevDataRef.current = data;
        return;
      }
      form.reset(extractWorkflowValues(nodeType, data));
      prevDataRef.current = data;
    }
  }, [form, nodeType, nodeId, data, isDirty]);

  // Reset form to initial values (for cancel action)
  const resetForm = useCallback(() => {
    form.reset(extractWorkflowValues(nodeType, data));
    log.debug({ nodeId, nodeType }, "workflowNodeForm:reset");
  }, [form, nodeType, data, nodeId]);

  return {
    form: form as unknown as WorkflowNodeFormApi,
    isDirty,
    isSaving,
    validateAndSave,
    validationErrors,
    resetForm,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

export function extractWorkflowValues(
  nodeType: WorkflowNodeType,
  data: unknown
): Record<string, unknown> {
  const extractor = workflowFormRegistry.getExtractor(nodeType);
  if (extractor) {
    return (extractor(data) as Record<string, unknown>) ?? {};
  }
  return (data as Record<string, unknown>) ?? {};
}

export function buildWorkflowNodeData(
  nodeType: WorkflowNodeType,
  values: unknown,
  existingData?: unknown
): unknown {
  const builder = workflowFormRegistry.getBuilder(nodeType);
  if (builder) {
    return builder(values, existingData);
  }
  return values;
}

/**
 * Subscribe to a specific form field value.
 */
export function useWorkflowFormFieldValue<T = unknown>(
  form: WorkflowNodeFormApi,
  field: string
): T | undefined {
  return useStore(form.store, (state: WorkflowFormStoreState) =>
    (state.values as Record<string, unknown>)[field]
  ) as T | undefined;
}
