/**
 * Template Variable Highlighting Utilities
 *
 * Shared utilities for parsing and highlighting {{variable}} patterns
 * in template strings. Used by HighlightedInput and HighlightedTextarea.
 *
 * @module shared/lib/template/highlight-variables
 */

import type { ReactNode } from "react";

/**
 * Parse text and wrap {{...}} patterns in highlighted spans
 *
 * @param text - The text containing {{variable}} patterns
 * @param highlightClass - CSS class to apply to highlighted variables
 * @param options - Optional configuration
 * @returns Array of React nodes with variables wrapped in spans
 *
 * @example
 * highlightVariables("Hello {{user.name}}!", "text-sky-500")
 * // Returns: ["Hello ", <span className="text-sky-500">{{user.name}}</span>, "!"]
 */
export function highlightVariables(
  text: string,
  highlightClass: string,
  options?: {
    /** Add trailing newline (for textarea matching) */
    trailingNewline?: boolean;
    /** Placeholder when text is empty */
    emptyPlaceholder?: string;
    /** Transform variable path for display (path stays the same for data attribute) */
    displayTransform?: (path: string) => string;
  }
): ReactNode[] {
  const { trailingNewline = false, emptyPlaceholder, displayTransform } = options ?? {};

  if (!text) {
    return emptyPlaceholder ? [emptyPlaceholder] : [];
  }

  const parts: ReactNode[] = [];
  const regex = /(\{\{[^}]*\}\})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Extract variable path (remove {{ and }})
    const fullMatch = match[1];
    const variablePath = fullMatch.slice(2, -2); // Remove {{ and }}

    // Transform path for display (e.g., nodes.agent-id → nodes.Friendly_Name)
    const displayPath = displayTransform ? displayTransform(variablePath) : variablePath;
    const displayText = `{{${displayPath}}}`;

    // Add highlighted variable with data attribute for hover detection
    // Note: data-variable-path uses original path for tooltip/actions
    parts.push(
      <span key={match.index} className={highlightClass} data-variable-path={variablePath}>
        {displayText}
      </span>
    );

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // Add trailing newline to match textarea behavior
  if (trailingNewline) {
    parts.push("\n");
  }

  return parts;
}
