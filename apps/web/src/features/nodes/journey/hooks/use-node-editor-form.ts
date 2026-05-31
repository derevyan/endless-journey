/**
 * Unified Node Editor Form Hook
 *
 * Single hook that handles form state for all node types.
 * Uses formRegistry for type-safe schema/extractor/builder resolution.
 *
 * Uses EditorActionsContext for dependency injection, enabling:
 * - Component isolation and testability
 * - Mock actions for unit tests without store setup
 *
 * Auto-save pattern:
 * - Returns validateAndSave() for auto-save on panel close
 * - Returns isDirty to check if there are unsaved form changes
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { createLogger, serializeError } from "@journey/logger";
import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { z } from "zod";

import { extractZodErrors } from "@/shared/lib/validation-utils";
import { useEditorActionsContext } from "@/features/journey/builder/context";
import type { JourneyNode, JourneyNodeWithMetadata, NodeType } from "@/features/nodes/journey/react-flow-types";
import { useFormAutoSave } from "@/features/nodes/shared/hooks";
import { buildNodeMetadata } from "../forms/form-utils";
import type { NodeEditorFormApi, FormStoreState } from "../forms/form-types";
import { formRegistry } from "../registry";
import { nodeRegistry } from "../registry/node-registry";
import { messageFormHandlers } from "../types/message/form";

const log = createLogger("node-editor-form");

// ============================================================================
// Helper Functions (using formRegistry)
// ============================================================================

/**
 * Get schema for a node type from registry.
 * Falls back to messageNodeSchema for unregistered types.
 */
function getSchemaForNodeType(nodeType: string): z.ZodType<unknown> {
  const schema = formRegistry.getSchema(nodeType as NodeType);
  return schema ?? messageFormHandlers.schema;
}

/**
 * Get default values for a node using the registered extractor.
 * Falls back to message field extractor for unregistered types.
 */
function getDefaultValuesForNode(node: JourneyNode): Record<string, unknown> {
  const extractor = formRegistry.getExtractor(node.data.type as NodeType);
  if (extractor) {
    return extractor(node);
  }
  // Fallback to message extractor
  return messageFormHandlers.extract(node);
}

/**
 * Build node data using the registered builder.
 * Falls back to message builder for unregistered types.
 */
function buildNodeDataForType(nodeType: string, validated: unknown): Record<string, unknown> {
  const builder = formRegistry.getBuilder(nodeType as NodeType);
  if (builder) {
    return builder(validated as Record<string, unknown>);
  }
  // Fallback to message builder
  return messageFormHandlers.build(validated as Record<string, unknown>);
}

// ============================================================================
// Types
// ============================================================================

export interface UseNodeEditorFormReturn {
  /** TanStack Form API */
  form: NodeEditorFormApi;
  /** Whether form has unsaved changes */
  isDirty: boolean;
  /** Whether save is in progress */
  isSaving: boolean;
  /**
   * Validate and save form data. Used for auto-save on panel close.
   * @returns true if saved successfully, false if validation failed
   */
  validateAndSave: (options?: SaveOptions) => Promise<boolean>;
  /** Validation errors from last failed save attempt (path -> message) */
  validationErrors: Map<string, string>;
  /** Reset form to initial node values (for cancel) */
  resetForm: () => void;
}

export interface SaveOptions {
  notifyOnSuccess?: boolean;
  notifyOnError?: boolean;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Unified form hook for all node editor types
 *
 * Auto-save pattern:
 * - Returns validateAndSave() for auto-save on panel close
 * - Returns isDirty to check if there are unsaved form changes
 *
 * Uses EditorActionsContext for updateNode and notify.
 */
export function useNodeEditorForm(node: JourneyNode): UseNodeEditorFormReturn {
  const nodeWithMetadata = node as JourneyNodeWithMetadata;
  const nodeType = node.data.type;
  const schema = getSchemaForNodeType(nodeType);

  // Get injected actions from context (enables mocking in tests)
  const { updateNode, notify } = useEditorActionsContext();

  // Track saving state for UI feedback
  const [isSaving, setIsSaving] = useState(false);

  // Track validation errors for field highlighting (populated on failed save)
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  // Initialize form with node data
  // TanStack Form infers type from defaultValues - no cast needed
  const form = useForm({
    defaultValues: getDefaultValuesForNode(node),
    onSubmit: async () => {
      // onSubmit is now a no-op - we use validateAndSave instead
      // This is kept for TanStack Form compatibility
    },
  });

  // Track dirty state via direct store subscription (reactive, no race conditions)
  // This pattern matches use-edge-editor-form.ts and use-workflow-node-form.ts
  const isDirty = useStore(form.store, (state: FormStoreState) => state.isDirty);
  const formValues = useStore(form.store, (state: FormStoreState) => state.values);

  const formConfig = nodeRegistry.getFormConfig(nodeType);
  const autoSaveEnabled = formConfig.autoSave;
  const saveDebounceMs = formConfig.saveDebounceMs ?? 300;

  // Track previous node data for external change detection
  const prevNodeIdRef = useRef(node.id);
  const prevNodeDataRef = useRef(node.data);

  // Reset form on node ID change OR external data change (when form is not dirty)
  // This handles: 1) switching between nodes, 2) external updates (undo/redo, discard)
  useEffect(() => {
    const nodeIdChanged = prevNodeIdRef.current !== node.id;
    const dataChanged = prevNodeDataRef.current !== node.data;

    // Always reset on node ID change
    if (nodeIdChanged) {
      form.reset(getDefaultValuesForNode(node));
      prevNodeIdRef.current = node.id;
      prevNodeDataRef.current = node.data;
      return;
    }

    // Reset on external data change ONLY if form is not dirty
    // This prevents losing user edits when store updates
    if (dataChanged && !isDirty) {
      form.reset(getDefaultValuesForNode(node));
      prevNodeDataRef.current = node.data;
    }
  }, [form, node, isDirty]);

  /**
   * Validate form data and save to store if valid.
   * Used for auto-save on panel close.
   * Idempotent - skips if nothing changed to avoid redundant store updates.
   *
   * @returns true if saved successfully, false if validation failed
   */
  const validateAndSave = useCallback(
    async (options: SaveOptions = {}): Promise<boolean> => {
      const notifyOnSuccess = options.notifyOnSuccess ?? true;
      const notifyOnError = options.notifyOnError ?? true;
    // Debug logging to trace dirty detection
    log.debug(
      { nodeId: node.id, nodeType, isDirty: form.state.isDirty },
      "nodeEditorForm:validateAndSave:start"
    );

    // Early return if nothing changed - prevents redundant store updates
    if (!form.state.isDirty) {
      log.debug({ nodeId: node.id }, "nodeEditorForm:validateAndSave:skipped:notDirty");
      return true;
    }

    setIsSaving(true);

    try {
      const value = form.state.values;

      // Validate form data with error handling
      let validated;
      try {
        validated = schema.parse(value);
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Log structured error for debugging
          log.error(
            {
              nodeId: node.id,
              nodeType,
              validationErrors: error.issues,
              err: serializeError(error),
            },
            "nodeEditorForm:validation:failed"
          );

          // Extract field paths and messages for field-level highlighting
          setValidationErrors(extractZodErrors(error));

          if (notifyOnError) {
            notify.error("Please fix validation errors before closing", {
              description: error.issues.map((e) => e.message).join(", "),
            });
          }
          return false;
        }

        // Log unexpected errors
        log.error(
          {
            nodeId: node.id,
            nodeType,
            err: serializeError(error),
          },
          "nodeEditorForm:validation:unexpected"
        );
        throw error;
      }

      // Clear validation errors on successful validation
      setValidationErrors(new Map());

      // Cast validated data to record for safe property access
      const validatedData = validated as Record<string, unknown>;

      // Build node data using registered builder
      const nodeData = buildNodeDataForType(nodeType, validatedData);

      // Build metadata - access properties safely after cast
      const metadata = buildNodeMetadata(nodeWithMetadata.metadata, {
        status: validatedData.status as string | undefined,
        notes: validatedData.notes as string | undefined,
        customJson: validatedData.customJson as string | undefined,
      });

      // Update node via context-injected action
      updateNode(node.id, {
        data: nodeData as JourneyNode["data"],
        metadata,
      } as Partial<JourneyNode>);

      // Show success toast (matching Workflow Builder UX)
      if (notifyOnSuccess) {
        notify.success("Changes saved");
      }

      log.info({ nodeId: node.id, nodeType }, "nodeEditorForm:saved");

      // Reset form dirty state after successful save
      // CRITICAL: Use form.state.values instead of re-extracting from node
      // This avoids stale references and extractor/builder asymmetries
      // isDirty automatically becomes false via useStore subscription - no guards needed
      form.reset(form.state.values);

      return true;
    } finally {
      setIsSaving(false);
    }
    },
    [form, schema, node, nodeWithMetadata.metadata, nodeType, updateNode, notify]
  );

  // Use shared auto-save hook for dirty state sync, debounced save, and save manager registration
  useFormAutoSave({
    editorId: node.id,
    isDirty,
    formValues,
    autoSaveEnabled,
    saveDebounceMs,
    validateAndSave,
  });

  /**
   * Reset form to initial node values.
   * Used for cancel action to discard unsaved changes.
   */
  const resetForm = useCallback(() => {
    form.reset(getDefaultValuesForNode(node));
    log.debug({ nodeId: node.id }, "nodeEditorForm:reset");
  }, [form, node]);

  return { form: form as unknown as NodeEditorFormApi, isDirty, isSaving, validateAndSave, validationErrors, resetForm };
}

// ============================================================================
// Form Field Subscription Helper
// ============================================================================

/**
 * Subscribe to a specific form field value with proper typing.
 *
 * Use when you need reactive updates for a single field (e.g., to trigger
 * dependent queries when a selection changes). This provides type-safe
 * access to form values without manual type casting.
 *
 * @example
 * ```tsx
 * // Subscribe to pipelineId changes for dependent stage query
 * const selectedPipelineId = useFormFieldValue(form, "pipelineId");
 *
 * // Subscribe to questions array for reactive rendering
 * const questions = useFormFieldValue(form, "questions") || [];
 * ```
 */
export function useFormFieldValue<K extends string>(
  form: UseNodeEditorFormReturn["form"],
  field: K
): unknown {
  return useStore(form.store, (state: FormStoreState) => state.values[field]);
}
