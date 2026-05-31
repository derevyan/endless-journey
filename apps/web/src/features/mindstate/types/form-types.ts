import type { ReactNode } from "react";

import type { Store } from "@tanstack/react-store";
import type { ScaleType, SemanticDirection } from "@journey/schemas";

// =============================================================================
// SIMPLIFIED FIELD API (avoids complex TanStack Form generics)
// =============================================================================

export interface FormFieldApi<T = unknown> {
  state: {
    value: T;
    meta: {
      errors: (string | undefined)[];
      isTouched: boolean;
      isDirty: boolean;
    };
  };
  handleChange: (value: T) => void;
  handleBlur: () => void;
}

// Common field types
export type StringFieldApi = FormFieldApi<string>;
export type NumberFieldApi = FormFieldApi<number | undefined>;
export type BooleanFieldApi = FormFieldApi<boolean>;
export type ScaleTypeFieldApi = FormFieldApi<ScaleType>;
export type SemanticDirectionFieldApi = FormFieldApi<SemanticDirection | undefined>;

// =============================================================================
// FORM VALUES (matches Zod schema shapes)
// =============================================================================

export type AgentFormValues = {
  id: string;
  name: string;
  role: string;
  /** Prompt mode: inline text or repository reference */
  promptSource: "inline" | "repository";
  /** Inline system prompt (used when promptSource="inline") */
  systemPrompt: string;
  /** Prompt name from repository (used when promptSource="repository") */
  promptRefName?: string;
  /** Prompt version label (default: "production") */
  promptRefLabel?: string;
  /** Prompt variable mappings (promptVar -> sourcePath) */
  promptVariables?: Record<string, string>;
  avatar: string;
  color: string;
  llmConfig: {
    model: string;
    provider?: string;
    temperature?: number;
    reasoningEffort?: "low" | "medium" | "high";
    maxTokens?: number;
  };
};

export type ParameterFormValues = {
  id: string;
  name: string;
  category: string;
  description: string;
  scaleType: ScaleType;
  min?: number;
  max?: number;
  options?: string[]; // CRITICAL: Array, not comma-separated string
  currentValue: number | string | boolean;
  responsibleAgentId: string;
  semanticDirection?: SemanticDirection;
  detectionHints?: {
    phrasesRaise?: string[]; // CRITICAL: Array, not newline string
    phrasesLower?: string[];
    observations?: string[];
  };
};

// =============================================================================
// FORM API (simplified to avoid TanStack generics)
// =============================================================================

export interface FormStoreState<TValues extends Record<string, unknown> = Record<string, unknown>> {
  values: TValues;
  isDirty: boolean;
}

export interface FormApi<TValues extends Record<string, unknown> = Record<string, unknown>> {
  Field: <T = unknown>(props: {
    name: string;
    children: (field: FormFieldApi<T>) => ReactNode;
  }) => ReactNode | Promise<ReactNode>;
  handleSubmit: () => void;
  getFieldValue: <T = unknown>(name: string) => T;
  setFieldValue: <T = unknown>(name: string, value: T) => void;
  reset: (values?: TValues) => void;
  store: Store<FormStoreState<TValues>>;
  state: FormStoreState<TValues>;
}

export type AgentFormApi = FormApi<AgentFormValues>;
export type ParameterFormApi = FormApi<ParameterFormValues>;

// =============================================================================
// FORM STORE STATE (for useStore subscriptions)
// =============================================================================
