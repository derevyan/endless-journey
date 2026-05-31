/**
 * Shared Format Utilities
 *
 * Common formatting functions for system event cards.
 *
 * @module features/simulator/components/chat/system-events/utils/format
 */

/**
 * Format duration in human-readable form
 *
 * @example
 * formatDuration(500)    // "500ms"
 * formatDuration(2500)   // "2.5s"
 * formatDuration(65000)  // "1m 5s"
 * formatDuration(3600000) // "1h"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * Format value for display (handles strings, objects, null, undefined)
 *
 * @example
 * formatValue(null)           // "null"
 * formatValue("John")         // '"John"'
 * formatValue({ a: 1 })       // '{"a":1}'
 * formatValue("very long...") // '"very long..."' (truncated)
 */
export function formatValue(value: unknown, maxLength = 30): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    return value.length > maxLength ? `"${value.slice(0, maxLength)}..."` : `"${value}"`;
  }
  if (typeof value === "object") {
    try {
      const str = JSON.stringify(value);
      return str.length > maxLength + 10 ? str.slice(0, maxLength + 10) + "..." : str;
    } catch {
      return "[Object]";
    }
  }
  return String(value);
}
