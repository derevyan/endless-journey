/**
 * Middleware Utility Functions
 *
 * Helper functions for common middleware patterns to reduce boilerplate
 * and improve type safety.
 */

import type { AgentState } from "./types";

/**
 * Safely get a number value from middleware state
 *
 * Handles the common pattern of extracting typed values from the
 * dynamic state object with proper defaults.
 *
 * @example
 * ```typescript
 * // Before (boilerplate)
 * const runCount = (state._mwModelCallCount as number) || 0;
 *
 * // After (clean)
 * const runCount = getStateNumber(state, "_mwModelCallCount");
 * ```
 */
export function getStateNumber(
  state: AgentState,
  key: string,
  defaultValue: number = 0
): number {
  const value = state[key];
  if (typeof value === "number") {
    return value;
  }
  return defaultValue;
}

/**
 * Safely get a string value from middleware state
 *
 * @example
 * ```typescript
 * const summary = getStateString(state, "_mwSummary", "");
 * ```
 */
export function getStateString(
  state: AgentState,
  key: string,
  defaultValue: string = ""
): string {
  const value = state[key];
  if (typeof value === "string") {
    return value;
  }
  return defaultValue;
}

/**
 * Safely get a boolean value from middleware state
 *
 * @example
 * ```typescript
 * const isApproved = getStateBoolean(state, "_mwHitlApproved", false);
 * ```
 */
export function getStateBoolean(
  state: AgentState,
  key: string,
  defaultValue: boolean = false
): boolean {
  const value = state[key];
  if (typeof value === "boolean") {
    return value;
  }
  return defaultValue;
}

/**
 * Safely get an array value from middleware state
 *
 * @example
 * ```typescript
 * const todos = getStateArray<TodoItem>(state, "_mwTodos");
 * ```
 */
export function getStateArray<T>(
  state: AgentState,
  key: string,
  defaultValue: T[] = []
): T[] {
  const value = state[key];
  if (Array.isArray(value)) {
    return value as T[];
  }
  return defaultValue;
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique ID with a prefix
 *
 * Consolidates the common pattern used across middleware for generating
 * unique identifiers (todo IDs, HITL request IDs, etc.)
 *
 * @example
 * ```typescript
 * generateId("todo")   // "todo_1734567890123_abc123def"
 * generateId("hitl")   // "hitl_1734567890123_xyz789ghi"
 * ```
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
