/**
 * Shared Validation Utilities
 *
 * Type guards and validation helpers used across route handlers.
 *
 * @module utils/validation
 */

/**
 * Type guard: checks if value is Record<string, string>
 */
export function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}

/**
 * Type guard: checks if value is a non-null object (not array)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Type guard: checks if value is array of strings
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
