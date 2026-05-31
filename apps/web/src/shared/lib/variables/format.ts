/**
 * Variable Path Formatting
 *
 * Utilities for wrapping/unwrapping variable paths with {{ }} delimiters.
 * Used for consistent display and storage of template variables.
 *
 * @module lib/variables/format
 */

/**
 * Wrap variable path with {{ }} for display/copying.
 * Idempotent - returns as-is if already wrapped.
 *
 * @example wrapVariablePath("nodes.agent.response") → "{{nodes.agent.response}}"
 * @example wrapVariablePath("{{already.wrapped}}") → "{{already.wrapped}}"
 */
export const wrapVariablePath = (path: string): string => {
  if (!path) return path;
  if (path.startsWith("{{") && path.endsWith("}}")) return path;
  return `{{${path}}}`;
};

/**
 * Unwrap {{ }} from variable path for storage.
 * Idempotent - returns as-is if not wrapped.
 *
 * @example unwrapVariablePath("{{nodes.agent.response}}") → "nodes.agent.response"
 * @example unwrapVariablePath("already.clean") → "already.clean"
 */
export const unwrapVariablePath = (path: string): string => {
  if (!path) return path;
  return path.replace(/^\{\{|\}\}$/g, "").trim();
};
