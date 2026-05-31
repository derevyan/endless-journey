/**
 * JSON Extraction Utilities
 *
 * Shared utilities for extracting JSON from LLM response text.
 *
 * @module workflow/utilities/json-extractor
 */

/**
 * Extract JSON from a string value.
 *
 * Attempts to parse JSON in the following order:
 * 1. Direct JSON parse of the entire string
 * 2. JSON code blocks (```json ... ```)
 * 3. Raw JSON objects ({...})
 *
 * @param value - The value to extract JSON from
 * @returns The parsed JSON object, or the original value if parsing fails
 *
 * @example
 * ```ts
 * // From code block
 * extractJson('Here is the result:\n```json\n{"foo": "bar"}\n```');
 * // Returns: { foo: "bar" }
 *
 * // From raw JSON
 * extractJson('The answer is {"count": 42}');
 * // Returns: { count: 42 }
 * ```
 */
export function extractJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    // Try direct parse first
    return JSON.parse(value);
  } catch {
    // Look for JSON in code blocks
    const jsonBlockMatch = value.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      try {
        return JSON.parse(jsonBlockMatch[1]);
      } catch {
        // Fall through to next attempt
      }
    }

    // Look for raw JSON objects
    const objectMatch = value.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fall through to return original
      }
    }

    return value;
  }
}

/**
 * Extract structured data from agent response text.
 *
 * Similar to extractJson but returns an empty object on failure.
 * Useful for optional structured outputs from LLM agents.
 *
 * @param response - The LLM response text
 * @returns The extracted data object, or empty object if extraction fails
 */
export function extractStructuredData(response: string): Record<string, unknown> {
  const result = extractJson(response);

  if (typeof result === "object" && result !== null && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }

  return {};
}
