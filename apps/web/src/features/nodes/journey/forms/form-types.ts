/**
 * Form Type Helpers
 *
 * Centralized type definitions for TanStack Form to reduce `any` usage.
 * These types provide just enough type safety for our use cases without
 * requiring full generic propagation through all components.
 *
 * @module lib/form-types
 */

import type { Store } from "@tanstack/react-store";
import type { ButtonConfig } from "@journey/schemas";
import type { ReactNode } from "react";

// =============================================================================
// FIELD API TYPES
// =============================================================================

/**
 * Simplified field API for form fields
 * Covers the most common field operations used in node editors
 */
export interface FormFieldApi<T = unknown> {
  state: {
    value: T;
    meta: {
      // Note: When no validators are used, TanStack Form may return undefined in errors array
      errors: (string | undefined)[];
      isTouched: boolean;
      isDirty: boolean;
    };
  };
  handleChange: (value: T) => void;
  handleBlur: () => void;
}

// =============================================================================
// FORM API TYPES
// =============================================================================

/**
 * Simplified form API for node editor forms
 * Covers the operations used across all node editors
 */
export interface NodeEditorFormApi {
  Field: <T = unknown>(props: {
    name: string;
    children: (field: FormFieldApi<T>) => ReactNode;
  }) => ReactNode | Promise<ReactNode>;
  handleSubmit: () => void;
  getFieldValue: <T = unknown>(name: string) => T;
  setFieldValue: <T = unknown>(name: string, value: T) => void;
  reset: (values?: Record<string, unknown>) => void;
  /** TanStack Store for reactive value subscriptions */
  store: Store<FormStoreState>;
}

// =============================================================================
// COMMON FIELD VALUE TYPES
// =============================================================================

/**
 * Common field value types for node editors
 * Use these for specific field type annotations
 */
export type StringFieldApi = FormFieldApi<string>;
export type NumberFieldApi = FormFieldApi<number | undefined>;
export type StringArrayFieldApi = FormFieldApi<string[]>;
export type BooleanFieldApi = FormFieldApi<boolean>;
export type ButtonConfigArrayFieldApi = FormFieldApi<ButtonConfig[]>;

/**
 * Condition rules field type
 * Used by ConditionNodeEditor for the rules field
 */
export type ConditionRulesFieldApi = FormFieldApi<
  | Array<{
      field: string;
      operator: string;
      value?: string | number | boolean;
    }>
  | undefined
>;

/**
 * Rules operator field type ("and" | "or")
 */
export type RulesOperatorFieldApi = FormFieldApi<"and" | "or" | undefined>;

// =============================================================================
// STORE TYPES
// =============================================================================

/**
 * TanStack Form store state shape (simplified).
 *
 * This interface represents the minimal shape of TanStack Form's store state
 * needed for reactive value subscriptions. The actual store state has more
 * properties, but we need `values` for field subscriptions and `isDirty`
 * for reliable dirty tracking.
 *
 * @see https://tanstack.com/form/latest/docs/reference/FormApi#store
 */
export interface FormStoreState {
  /** Form field values keyed by field name */
  values: Record<string, unknown>;
  /** Whether form has been modified from default values */
  isDirty: boolean;
}

