/**
 * Workflow Form Types
 *
 * Centralized type definitions for workflow node forms.
 *
 * @module features/nodes/workflow/forms/workflow-form-types
 */

import type { ReactNode } from "react";

// =============================================================================
// FORM FIELD API
// =============================================================================

/**
 * Simplified field API for form fields
 */
export interface WorkflowFormFieldApi<T = unknown> {
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

// =============================================================================
// FORM API
// =============================================================================

/**
 * Simplified form API for workflow node forms
 */
export interface WorkflowNodeFormApi {
  Field: <T = unknown>(props: {
    name: string;
    children: (field: WorkflowFormFieldApi<T>) => ReactNode;
  }) => ReactNode | Promise<ReactNode>;
  handleSubmit: () => void;
  getFieldValue: <T = unknown>(name: string) => T;
  setFieldValue: <T = unknown>(name: string, value: T) => void;
  reset: (values?: Record<string, unknown>) => void;
  /** TanStack Store for reactive value subscriptions */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: any;
}

// =============================================================================
// FORM STORE STATE
// =============================================================================

/**
 * TanStack Form store state shape
 */
export interface WorkflowFormStoreState {
  values: Record<string, unknown>;
  isDirty: boolean;
}
