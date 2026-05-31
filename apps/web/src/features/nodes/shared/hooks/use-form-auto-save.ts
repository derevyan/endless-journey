/**
 * Shared Form Auto-Save Hook
 *
 * Provides reusable auto-save functionality for node editor forms.
 * Handles debounced saving, dirty state syncing, and save manager registration.
 *
 * @module features/nodes/shared/hooks/use-form-auto-save
 */

import { useEffect } from "react";
import { createLogger } from "@journey/logger";
import { saveManagerActions } from "@/stores/save-manager-store";

const log = createLogger("form-auto-save");

export interface UseFormAutoSaveOptions {
  /** Unique ID for the editor (node ID or edge ID) */
  editorId: string;
  /** Whether form has unsaved changes */
  isDirty: boolean;
  /** Form values (used as dependency for debounce effect) */
  formValues: unknown;
  /** Whether auto-save is enabled */
  autoSaveEnabled: boolean;
  /** Debounce delay in milliseconds */
  saveDebounceMs: number;
  /** Function to validate and save the form */
  validateAndSave: (options?: { notifyOnSuccess?: boolean; notifyOnError?: boolean }) => Promise<boolean>;
  /** Optional callback when dirty state changes */
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * Hook for managing form auto-save behavior.
 *
 * Features:
 * - Syncs dirty state to SaveManager
 * - Debounced auto-save when enabled
 * - Registers with SaveManager for flush-on-click behavior
 *
 * @example
 * ```tsx
 * useFormAutoSave({
 *   editorId: node.id,
 *   isDirty,
 *   formValues,
 *   autoSaveEnabled: true,
 *   saveDebounceMs: 300,
 *   validateAndSave,
 * });
 * ```
 */
export function useFormAutoSave({
  editorId,
  isDirty,
  formValues,
  autoSaveEnabled,
  saveDebounceMs,
  validateAndSave,
  onDirtyChange,
}: UseFormAutoSaveOptions): void {
  // Sync dirty state to SaveManager (centralized tracking)
  useEffect(() => {
    saveManagerActions.setFormDirty(editorId, isDirty);
    onDirtyChange?.(isDirty);
  }, [editorId, isDirty, onDirtyChange]);

  // Debounced auto-save when enabled
  useEffect(() => {
    if (!autoSaveEnabled || !isDirty) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void validateAndSave({ notifyOnSuccess: false, notifyOnError: false });
    }, saveDebounceMs);

    return () => clearTimeout(timeoutId);
  }, [autoSaveEnabled, saveDebounceMs, formValues, isDirty, validateAndSave]);

  // Register auto-save handler with SaveManager
  // Enables canvas clicks and mode switches to flush pending changes
  useEffect(() => {
    saveManagerActions.registerEditor(editorId, validateAndSave);
    log.debug({ editorId }, "formAutoSave:registered");

    return () => {
      saveManagerActions.unregisterEditor(editorId);
      log.debug({ editorId }, "formAutoSave:unregistered");
    };
  }, [editorId, validateAndSave]);
}
