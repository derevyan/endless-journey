/**
 * Parse Structured AI Output
 *
 * Extracts response text and buttons from structured JSON output.
 * LLM agents with structured output return JSON like:
 * {"response": "text here", "buttons": [{"label": "Option", "emoji": "..."}]}
 *
 * This utility safely parses such output and falls back to raw content
 * if the format doesn't match.
 */

export interface ParsedStructuredOutput {
  /** The response text to display */
  text: string;
  /** Optional quick-reply buttons extracted from structured output */
  buttons?: Array<{ label: string; emoji?: string }>;
}

/**
 * Parse structured AI output, extracting response text and buttons.
 * If content is not valid JSON or doesn't have response field, returns original content.
 *
 * @param content - The raw response string (may be JSON or plain text)
 * @returns Parsed output with text and optional buttons
 *
 * @example
 * // JSON structured output
 * parseStructuredOutput('{"response":"Hello!","buttons":[{"label":"Hi"}]}')
 * // => { text: "Hello!", buttons: [{ label: "Hi" }] }
 *
 * @example
 * // Plain text (non-JSON)
 * parseStructuredOutput("Just plain text")
 * // => { text: "Just plain text" }
 */
export function parseStructuredOutput(content: string): ParsedStructuredOutput {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null && typeof parsed.response === "string") {
      return {
        text: parsed.response,
        buttons: Array.isArray(parsed.buttons) ? parsed.buttons : undefined,
      };
    }
  } catch {
    // Not JSON, return as-is
  }
  return { text: content };
}
