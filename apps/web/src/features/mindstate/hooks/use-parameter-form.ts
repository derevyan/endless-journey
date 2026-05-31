import { createLogger, serializeError } from "@journey/logger";
import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { StateParameterSchema, type StateParameter } from "@journey/schemas";

import { extractZodErrors } from "@/shared/lib/validation-utils";
import { builderActions } from "@/features/mindstate/stores/builder-store";
import { notify } from "@/shared/lib/ui/notify";
import { generateId } from "@/features/mindstate/lib/defaults";
import type { ParameterFormApi, ParameterFormValues, FormStoreState } from "../types/form-types";

const log = createLogger("parameter-form");

// CRITICAL: Form stores raw values with specific formats:
// - options: Array<string> (NOT comma-separated string)
// - detectionHints: { phrasesRaise: string[], ... } (NOT newline strings)
// - currentValue: number | string | boolean (typed based on scaleType)

function getDefaultValues(
  editingParameter: StateParameter | null,
  defaultAgentId: string,
  defaultCategory: string
): ParameterFormValues {
  if (editingParameter) {
    return {
      id: editingParameter.id,
      name: editingParameter.name,
      category: editingParameter.category,
      description: editingParameter.description,
      scaleType: editingParameter.scaleType,
      min: editingParameter.min,
      max: editingParameter.max,
      options: editingParameter.options, // Already an array
      currentValue: editingParameter.currentValue,
      responsibleAgentId: editingParameter.responsibleAgentId || defaultAgentId,
      semanticDirection: editingParameter.semanticDirection,
      detectionHints: editingParameter.detectionHints, // Already structured
    };
  }

  // New parameter defaults
  return {
    id: generateId("param"),
    name: "",
    category: defaultCategory,
    description: "",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    options: undefined,
    currentValue: 5,
    responsibleAgentId: defaultAgentId,
    semanticDirection: "high_is_good",
    detectionHints: undefined,
  };
}

export interface UseParameterFormReturn {
  form: ParameterFormApi;
  isDirty: boolean;
  isSaving: boolean;
  validateAndSave: () => Promise<boolean>;
  /** Field-level validation errors (path -> message) */
  validationErrors: Map<string, string>;
  /** Reset form to initial parameter values (for cancel) */
  resetForm: () => void;
}

export function useParameterForm(
  editingParameter: StateParameter | null,
  defaultAgentId: string,
  defaultCategory: string
): UseParameterFormReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  const form = useForm({
    defaultValues: getDefaultValues(editingParameter, defaultAgentId, defaultCategory),
    onSubmit: async () => {
      // no-op
    },
  });

  // Track previous parameter ID for change detection
  // CRITICAL: Initialize to undefined so first render detects the parameter change
  const prevParameterIdRef = useRef<string | undefined>(undefined);

  // Reset form when editingParameter changes
  // This handles: 1) initial mount with data, 2) switching between parameters
  useEffect(() => {
    const parameterIdChanged = prevParameterIdRef.current !== editingParameter?.id;

    // Always reset on parameter ID change
    if (parameterIdChanged) {
      form.reset(getDefaultValues(editingParameter, defaultAgentId, defaultCategory));
      prevParameterIdRef.current = editingParameter?.id;
    }
  }, [form, editingParameter, defaultAgentId, defaultCategory]);

  const isDirty = useStore(form.store, (state: FormStoreState<ParameterFormValues>) => state.isDirty);

  const validateAndSave = useCallback(async (): Promise<boolean> => {
    if (!form.state.isDirty) {
      log.debug({ parameterId: editingParameter?.id }, "parameterForm:validateAndSave:skipped:notDirty");
      return true;
    }

    setIsSaving(true);

    try {
      const value = form.state.values;

      // Manual Zod validation (includes all 3 refinements)
      let validated;
      try {
        validated = StateParameterSchema.parse(value);
        // Clear errors on successful validation
        setValidationErrors(new Map());
      } catch (error) {
        if (error instanceof z.ZodError) {
          setValidationErrors(extractZodErrors(error));
          log.error(
            { parameterId: editingParameter?.id, validationErrors: error.issues, err: serializeError(error) },
            "parameterForm:validation:failed"
          );
          notify.error("Validation failed", {
            description: error.issues.map((e) => e.message).join(", "),
          });
          return false;
        }
        throw error;
      }

      // Preserve history only if scale type unchanged
      const finalParameter: StateParameter = {
        ...validated,
        history: editingParameter?.scaleType === validated.scaleType ? editingParameter?.history ?? [] : [],
      };

      // Call correct builder store actions
      if (editingParameter) {
        builderActions.updateParameter(editingParameter.id, finalParameter);
      } else {
        builderActions.addParameter(finalParameter);
      }

      notify.success(editingParameter ? "State component updated" : "State component created");
      log.info({ parameterId: validated.id }, "parameterForm:saved");

      // Reset form dirty state
      form.reset(form.state.values);

      return true;
    } catch (error) {
      log.error({ err: serializeError(error) }, "parameterForm:save:error");
      notify.error("Failed to save parameter");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [form, editingParameter]);

  // Reset form to initial values (for cancel action)
  const resetForm = useCallback(() => {
    form.reset(getDefaultValues(editingParameter, defaultAgentId, defaultCategory));
    log.debug({ parameterId: editingParameter?.id }, "parameterForm:reset");
  }, [form, editingParameter, defaultAgentId, defaultCategory]);

  return {
    form: form as unknown as ParameterFormApi,
    isDirty,
    isSaving,
    validateAndSave,
    validationErrors,
    resetForm,
  };
}

/**
 * Subscribe to parameter form field value (for conditional rendering)
 */
export function useParameterFormFieldValue<K extends keyof ParameterFormValues>(
  form: ParameterFormApi,
  field: K
): ParameterFormValues[K] {
  return useStore(form.store, (state: FormStoreState<ParameterFormValues>) => state.values[field]);
}
