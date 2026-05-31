/**
 * JSONPath extraction utility
 * Wrapper around jsonpath-plus for safe data extraction
 */

import { JSONPath } from "jsonpath-plus";

/**
 * Result of JSONPath extraction
 */
export interface JsonPathResult {
  success: boolean;
  value: unknown;
  error?: string;
}

/**
 * Extract value from data using JSONPath expression
 *
 * @param data - The data object to extract from
 * @param path - JSONPath expression (e.g., "$.data.name", "$.items[0]")
 * @returns The extracted value, or undefined if extraction fails/no match
 *
 * @example
 * ```ts
 * const data = { data: { name: "John", items: [1, 2, 3] } };
 * extractJsonPath(data, "$.data.name");     // "John"
 * extractJsonPath(data, "$.data.items[0]"); // 1
 * extractJsonPath(data, "$.invalid");       // undefined
 * ```
 */
export function extractJsonPath(data: unknown, path: string): unknown {
  try {
    const jsonData = data as object | null;
    if (jsonData === null || typeof jsonData !== "object") {
      // Non-object data can't be extracted - return undefined
      return undefined;
    }
    const result = JSONPath({ path, json: jsonData, wrap: false });
    // JSONPath returns undefined if no match - this is intentional
    return result;
  } catch {
    // Return undefined if JSONPath extraction fails (not original data)
    return undefined;
  }
}

/**
 * Extract value from data using JSONPath with detailed result
 *
 * @param data - The data object to extract from
 * @param path - JSONPath expression
 * @returns Result object with success flag, value, and optional error
 */
export function extractJsonPathSafe(data: unknown, path: string): JsonPathResult {
  try {
    const jsonData = data as object | null;
    if (jsonData === null || typeof jsonData !== "object") {
      return { success: false, value: undefined, error: "Data is not an object" };
    }
    const result = JSONPath({ path, json: jsonData, wrap: false });
    if (result === undefined) {
      return { success: false, value: undefined, error: `No match for path: ${path}` };
    }
    return { success: true, value: result };
  } catch (error) {
    return {
      success: false,
      value: undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

