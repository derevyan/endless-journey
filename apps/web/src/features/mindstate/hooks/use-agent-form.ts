import { createLogger, serializeError } from "@journey/logger";
import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { MainAgentSchema, SystemAgentSchema, type MainAgent, type SystemAgent, llmConfig } from "@journey/schemas";

import { extractZodErrors } from "@/shared/lib/validation-utils";
import { builderActions } from "@/features/mindstate/stores/builder-store";
import { notify } from "@/shared/lib/ui/notify";
import { generateId } from "@/features/mindstate/lib/defaults";
import type { AgentFormApi, AgentFormValues, FormStoreState } from "../types/form-types";

const log = createLogger("agent-form");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Default values generator with defensive handling of optional fields
function getDefaultValues(
  editingAgent: MainAgent | SystemAgent | null,
  agentType: "main" | "system"
): AgentFormValues {
  // Define complete default llmConfig with explicit defaults (matches UI fallback)
  const defaultLlmConfig = {
    model: llmConfig.agent.model.id,
    temperature: 0.3,
    reasoningEffort: "medium" as const, // Explicit default prevents flash
    maxTokens: agentType === "main" ? 2000 : 1000,
  };

  if (editingAgent) {
    return {
      id: editingAgent.id,
      name: editingAgent.name,
      role: editingAgent.role,
      // Prompt source fields
      promptSource: editingAgent.promptSource ?? "inline",
      systemPrompt: editingAgent.systemPrompt ?? "",
      promptRefName: editingAgent.promptRef?.name,
      promptRefLabel: editingAgent.promptRef?.label ?? "production",
      promptVariables: editingAgent.promptVariables,
      avatar: editingAgent.avatar ?? "Bot",
      color: editingAgent.color ?? (agentType === "main" ? "indigo" : "blue"),
      // Merge defaults with existing config to ensure all fields populated
      llmConfig: {
        ...defaultLlmConfig,
        ...editingAgent.llmConfig, // Preserves saved values like "high" or "low"
      },
    };
  }

  // New agent defaults
  return {
    id: generateId("agent"),
    name: "",
    role: "",
    promptSource: "inline",
    systemPrompt: "",
    promptRefName: undefined,
    promptRefLabel: "production",
    promptVariables: undefined,
    avatar: "Bot",
    color: agentType === "main" ? "indigo" : "blue",
    llmConfig: defaultLlmConfig,
  };
}

export interface UseAgentFormReturn {
  form: AgentFormApi;
  isDirty: boolean;
  isSaving: boolean;
  validateAndSave: () => Promise<boolean>;
  /** Field-level validation errors (path -> message) */
  validationErrors: Map<string, string>;
  /** Reset form to initial agent values (for cancel) */
  resetForm: () => void;
}

export function useAgentForm(
  agentType: "main" | "system",
  editingAgent: MainAgent | SystemAgent | null
): UseAgentFormReturn {
  const schema = agentType === "main" ? MainAgentSchema : SystemAgentSchema;
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  // Initialize form - NO validators, validation happens in validateAndSave
  const form = useForm({
    defaultValues: getDefaultValues(editingAgent, agentType),
    onSubmit: async () => {
      // no-op - TanStack Form compatibility
    },
  });

  // Track previous agent ID for change detection
  // Initialize with actual agent ID to avoid unnecessary reset on mount
  const prevAgentIdRef = useRef<string | undefined>(editingAgent?.id);
  const hasInitialized = useRef(false);

  // Reset form when editingAgent changes
  // This handles: 1) switching between agents (NOT initial mount)
  useEffect(() => {
    // Skip reset on initial mount since form already has correct defaultValues
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      prevAgentIdRef.current = editingAgent?.id;
      return;
    }

    // Only reset when switching to a DIFFERENT agent
    const agentIdChanged = prevAgentIdRef.current !== editingAgent?.id;
    if (agentIdChanged) {
      form.reset(getDefaultValues(editingAgent, agentType));
      prevAgentIdRef.current = editingAgent?.id;
    }
  }, [form, editingAgent, agentType]);

  // Reactive dirty tracking (matches use-node-editor-form pattern)
  const isDirty = useStore(form.store, (state: FormStoreState<AgentFormValues>) => state.isDirty);

  const validateAndSave = useCallback(async (): Promise<boolean> => {
    // Early return if nothing changed (idempotent)
    if (!form.state.isDirty) {
      log.debug({ agentType }, "agentForm:validateAndSave:skipped:notDirty");
      return true;
    }

    setIsSaving(true);

    try {
      const formValues = form.state.values;

      // Transform flat form fields to schema format
      // The form uses promptRefName/promptRefLabel, but schema expects promptRef object
      const { promptRefName, promptRefLabel, promptVariables, ...rest } = formValues;
      const schemaValue = {
        ...rest,
        // Build promptRef object only if name is provided
        promptRef: promptRefName ? { name: promptRefName, label: promptRefLabel ?? "production" } : undefined,
        // Include promptVariables only for repository prompts with mappings
        promptVariables: promptRefName && promptVariables && Object.keys(promptVariables).length > 0
          ? promptVariables
          : undefined,
      };

      // Manual Zod validation (matches project pattern)
      let validated;
      try {
        validated = schema.parse(schemaValue);
        // Clear errors on successful validation
        setValidationErrors(new Map());
      } catch (error) {
        if (error instanceof z.ZodError) {
          setValidationErrors(extractZodErrors(error));
          log.error(
            { agentType, validationErrors: error.issues, err: serializeError(error) },
            "agentForm:validation:failed"
          );
          notify.error("Validation failed", {
            description: error.issues.map((e) => e.message).join(", "),
          });
          return false;
        }
        throw error;
      }

      // Call correct builder store actions
      if (agentType === "main") {
        builderActions.updateMainAgent(validated as MainAgent);
      } else {
        if (editingAgent) {
          builderActions.updateSystemAgent(editingAgent.id, validated as SystemAgent);
        } else {
          builderActions.addSystemAgent(validated as SystemAgent);
        }
      }

      // Differentiate between create and update operations
      const isCreate = !editingAgent;
      notify.success(isCreate ? "Agent created" : "Agent updated");
      log.info({ agentType, agentId: validated.id, isCreate }, "agentForm:saved");

      // Reset form dirty state (critical: use form.state.values to avoid stale refs)
      form.reset(form.state.values);

      return true;
    } catch (error) {
      log.error({ err: serializeError(error) }, "agentForm:save:error");
      notify.error("Failed to save agent");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [form, schema, agentType, editingAgent]);

  // Reset form to initial values (for cancel action)
  const resetForm = useCallback(() => {
    form.reset(getDefaultValues(editingAgent, agentType));
    log.debug({ agentType, agentId: editingAgent?.id }, "agentForm:reset");
  }, [form, editingAgent, agentType]);

  return {
    form: form as unknown as AgentFormApi,
    isDirty,
    isSaving,
    validateAndSave,
    validationErrors,
    resetForm,
  };
}

/**
 * Subscribe to a specific form field value with proper typing.
 * Use for reactive conditional rendering (e.g., showing reasoningEffort only for o1 models).
 */
export function useAgentFormFieldValue<K extends string>(
  form: AgentFormApi,
  field: K
): unknown {
  return useStore(form.store, (state: FormStoreState) => state.values[field]);
}

/**
 * Subscribe to nested field values (e.g., "llmConfig.model")
 */
export function useAgentFormNestedValue(form: AgentFormApi, path: string): unknown {
  return useStore(form.store, (state: FormStoreState<AgentFormValues>) => {
    const keys = path.split(".");
    let value: unknown = state.values;
    for (const key of keys) {
      if (!isRecord(value)) {
        return undefined;
      }
      value = value[key];
    }
    return value;
  });
}
