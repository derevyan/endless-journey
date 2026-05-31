/**
 * Variable Name Sanitization Utilities
 *
 * Shared functions for sanitizing node labels and variable names
 * to ensure they are valid identifiers for variable paths.
 *
 * @module lib/variables/sanitize
 */

/**
 * Sanitize a node label for use as a variable path segment.
 *
 * Transforms human-readable labels into valid identifier format:
 * - Replaces non-alphanumeric characters with underscores
 * - Collapses multiple consecutive underscores
 * - Removes leading and trailing underscores
 *
 * @example
 * ```ts
 * sanitizeNodeLabel("Ask Question")    // "Ask_Question"
 * sanitizeNodeLabel("Step 1 - Intro")  // "Step_1_Intro"
 * sanitizeNodeLabel("_internal_")      // "internal"
 * sanitizeNodeLabel("name--test")      // "name_test"
 * ```
 *
 * @param label - The node label to sanitize
 * @returns Sanitized label suitable for variable paths
 */
export function sanitizeNodeLabel(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
