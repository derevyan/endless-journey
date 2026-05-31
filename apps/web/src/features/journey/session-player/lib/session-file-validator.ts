/**
 * Session File Validator
 *
 * Validates JSON session files and provides error feedback.
 * Uses Zod for type validation and shows detailed error messages.
 *
 * @module features/journey/session-player/lib/session-file-validator
 */

import type { SessionExportValidationResult } from "@journey/schemas";
import { SessionExportSchema } from "@journey/schemas";

/**
 * Validate a JSON string as a SessionExport
 *
 * Returns detailed error message on validation failure.
 * Handles:
 * - JSON parsing errors
 * - Missing required fields
 * - Type mismatches
 * - Invalid UUIDs
 *
 * @param jsonString - Raw JSON string to validate
 * @returns Validation result with data or error
 */
export function validateSessionJson(
  jsonString: string
): SessionExportValidationResult {
  // 1. Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        success: false,
        error: `Invalid JSON: ${err.message}`,
      };
    }
    return {
      success: false,
      error: "Failed to parse JSON file",
    };
  }

  // 2. Validate structure is an object
  if (!data || typeof data !== "object") {
    return {
      success: false,
      error: "Session file must be a JSON object",
    };
  }

  // 3. Validate with Zod schema
  const result = SessionExportSchema.safeParse(data);

  if (!result.success) {
    // Extract first error for user-friendly message
    const issue = result.error.issues[0];

    if (!issue) {
      return {
        success: false,
        error: "Session file validation failed",
      };
    }

    const path = issue.path.length > 0 ? issue.path.join(".") : "unknown field";
    const message = issue.message;

    return {
      success: false,
      error: `Invalid session data at '${path}': ${message}`,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Sanitize a filename to remove special characters and limit length.
 *
 * Used for generating safe JSON filenames from user data.
 * Replaces invalid characters with hyphens, limits to 100 chars.
 *
 * @param name - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFileName(name: string): string {
  if (!name) {
    return "session";
  }

  return (
    name
      // Convert to lowercase
      .toLowerCase()
      // Replace spaces and special chars with hyphens
      .replace(/[^a-z0-9-]/g, "-")
      // Remove multiple consecutive hyphens
      .replace(/-+/g, "-")
      // Trim leading/trailing hyphens
      .replace(/^-+|-+$/g, "")
      // Limit to 100 chars
      .slice(0, 100) || "session"
  );
}

/**
 * Get human-readable error message for file issues
 */
export function getFileErrorMessage(error: Error | string): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
