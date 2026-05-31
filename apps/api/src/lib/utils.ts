/**
 * Utility Functions
 *
 * General-purpose helper functions for the API.
 *
 * @module lib/utils
 */

/**
 * Simple hash function for creating deterministic short hashes
 * Uses djb2 algorithm - fast and produces good distribution
 *
 * @param str - String to hash
 * @returns Base36 encoded hash string (alphanumeric, no special characters)
 *
 * @example
 * ```ts
 * simpleHash('{"key":"value"}') // Returns something like "1x2y3z"
 * ```
 */
export function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit and then to base36 for compact representation
  return (hash >>> 0).toString(36);
}

/**
 * Truncate a string to a maximum length with ellipsis
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated string with "..." if it exceeds maxLength
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
