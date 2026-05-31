/**
 * Validation Utilities
 *
 * Shared utilities for extracting and managing Zod validation errors.
 * Used by form hooks across journey, workflow, and mindstate editors.
 *
 * @module shared/lib/validation-utils
 */

import { z } from "zod";

/**
 * Extract field-level errors from a Zod error into a Map.
 *
 * @param error - Zod error object from schema.parse() failure
 * @returns Map with dot-notation paths as keys (e.g., "buttons.0.text") and error messages as values
 *
 * @example
 * ```ts
 * try {
 *   schema.parse(value);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     const errors = extractZodErrors(error);
 *     // errors.get("name") → "Name is required"
 *     // errors.get("buttons.0.text") → "Button text is required"
 *   }
 * }
 * ```
 */
export function extractZodErrors(error: z.ZodError): Map<string, string> {
  const errors = new Map<string, string>();
  for (const issue of error.issues) {
    errors.set(issue.path.join("."), issue.message);
  }
  return errors;
}

/**
 * Create an error getter function for array fields.
 *
 * @param validationErrors - Map of field path to error message
 * @param prefix - The array field name (e.g., "buttons", "headers")
 * @returns A function that retrieves errors by index and optional field name
 *
 * @example
 * ```tsx
 * const getButtonError = createArrayFieldErrorGetter(validationErrors, "buttons");
 *
 * // Get error for buttons.0.text
 * getButtonError(0, "text") → "Button text is required"
 *
 * // Get error for buttons.1 (no sub-field)
 * getButtonError(1) → "Button is invalid"
 * ```
 */
export function createArrayFieldErrorGetter(
  validationErrors: Map<string, string> | undefined,
  prefix: string
) {
  return (index: number, field?: string): string | undefined => {
    if (!validationErrors) return undefined;
    const path = field ? `${prefix}.${index}.${field}` : `${prefix}.${index}`;
    return validationErrors.get(path);
  };
}
