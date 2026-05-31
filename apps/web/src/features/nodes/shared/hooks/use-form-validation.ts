/**
 * Shared Form Validation Utilities
 *
 * Provides reusable Zod validation logic for node editor forms.
 * Handles error extraction, logging, and user notifications.
 *
 * @module features/nodes/shared/hooks/use-form-validation
 */

import { z } from "zod";
import { createLogger, serializeError } from "@journey/logger";
import { extractZodErrors } from "@/shared/lib/validation-utils";

const log = createLogger("form-validation");

export interface ValidationContext {
  /** ID of the item being validated (for logging) */
  id: string;
  /** Type of item being validated (for logging) */
  type: string;
}

export interface ValidationResult<T> {
  /** Whether validation succeeded */
  success: boolean;
  /** Validated data (only present if success is true) */
  data?: T;
  /** Validation errors map (path -> message) */
  errors: Map<string, string>;
  /** Array of error messages (for notifications) */
  errorMessages: string[];
}

/**
 * Validate form values against a Zod schema.
 *
 * Returns a structured result with:
 * - Validated data on success
 * - Error map for field highlighting
 * - Error messages for notifications
 *
 * @example
 * ```tsx
 * const result = validateFormData(schema, formValues, { id: node.id, type: "message" });
 *
 * if (!result.success) {
 *   setValidationErrors(result.errors);
 *   notify.error("Validation failed", { description: result.errorMessages.join(", ") });
 *   return false;
 * }
 *
 * // Use result.data safely
 * const nodeData = buildNodeData(result.data);
 * ```
 */
export function validateFormData<T>(
  schema: z.ZodType<T>,
  value: unknown,
  context: ValidationContext
): ValidationResult<T> {
  try {
    const data = schema.parse(value);
    return {
      success: true,
      data,
      errors: new Map(),
      errorMessages: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.error(
        {
          itemId: context.id,
          itemType: context.type,
          validationErrors: error.issues,
          err: serializeError(error),
        },
        "formValidation:failed"
      );

      return {
        success: false,
        errors: extractZodErrors(error),
        errorMessages: error.issues.map((e) => e.message),
      };
    }

    // Re-throw unexpected errors
    log.error(
      {
        itemId: context.id,
        itemType: context.type,
        err: serializeError(error),
      },
      "formValidation:unexpected"
    );
    throw error;
  }
}

/**
 * Type guard for checking if schema exists.
 * Useful for optional schema validation.
 */
export function hasSchema<T>(schema: z.ZodType<T> | null | undefined): schema is z.ZodType<T> {
  return schema != null;
}
