/**
 * Unwrap Variable Path
 *
 * Utility to strip {{}} wrapper from variable paths before resolution.
 * Allows storage of wrapped paths while maintaining resolver compatibility.
 *
 * @module llm/workflow/utilities/unwrap-variable-path
 */

/**
 * Unwrap {{ }} from variable path for resolution.
 * Idempotent - safe to call on already clean paths.
 *
 * @example unwrapVariablePath("{{nodes.agent.response}}") → "nodes.agent.response"
 * @example unwrapVariablePath("nodes.agent.response") → "nodes.agent.response"
 */
export function unwrapVariablePath(path: string): string {
  if (!path) return path;
  return path.replace(/^\{\{|\}\}$/g, "").trim();
}
