/**
 * JSON View Component
 *
 * Reusable component for displaying JSON with syntax highlighting.
 * Features:
 * - Syntax highlighting (keys, strings, numbers, booleans, null)
 * - Auto-formatting option
 * - Template variable detection ({{variable}})
 * - Dark theme optimized
 */

import { cn } from "@/shared/lib/utils";
import { useMemo } from "react";

interface JsonViewProps {
  /** JSON string to display */
  value: string;
  /** Whether to format/prettify the JSON (default: true) */
  format?: boolean;
  /** Additional class names for the container */
  className?: string;
  /** Font size class (default: text-xs) */
  fontSize?: string;
}

/**
 * Syntax highlight JSON tokens with colors
 */
function highlightJson(json: string): React.ReactNode[] {
  const tokenRegex = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\],:])|(\{\{[^}]+\}\})/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = tokenRegex.exec(json)) !== null) {
    // Add any whitespace/text before this match
    if (match.index > lastIndex) {
      parts.push(
        <span key={`ws-${keyIndex++}`} className="text-zinc-500">
          {json.slice(lastIndex, match.index)}
        </span>
      );
    }

    const [fullMatch, key, stringVal, numberVal, boolVal, nullVal, punctuation, template] = match;

    if (template) {
      // Template variable {{...}} - green color
      parts.push(
        <span key={`t-${keyIndex++}`} className="text-emerald-400">
          {template}
        </span>
      );
    } else if (key) {
      // Key (property name) - cyan color
      parts.push(
        <span key={`k-${keyIndex++}`} className="text-cyan-400">
          {key.slice(0, -1)}
        </span>,
        <span key={`c-${keyIndex++}`} className="text-zinc-500">
          :
        </span>
      );
    } else if (stringVal) {
      // String value - amber/yellow color
      parts.push(
        <span key={`s-${keyIndex++}`} className="text-amber-300">
          {stringVal}
        </span>
      );
    } else if (numberVal) {
      // Number - violet/purple color
      parts.push(
        <span key={`n-${keyIndex++}`} className="text-violet-400">
          {numberVal}
        </span>
      );
    } else if (boolVal) {
      // Boolean - orange color
      parts.push(
        <span key={`b-${keyIndex++}`} className="text-orange-400">
          {boolVal}
        </span>
      );
    } else if (nullVal) {
      // Null - rose/red color
      parts.push(
        <span key={`null-${keyIndex++}`} className="text-rose-400">
          {nullVal}
        </span>
      );
    } else if (punctuation) {
      // Punctuation - muted zinc color
      parts.push(
        <span key={`p-${keyIndex++}`} className="text-zinc-500">
          {punctuation}
        </span>
      );
    } else {
      parts.push(
        <span key={`x-${keyIndex++}`} className="text-zinc-400">
          {fullMatch}
        </span>
      );
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Add any remaining text
  if (lastIndex < json.length) {
    parts.push(
      <span key={`end-${keyIndex}`} className="text-zinc-500">
        {json.slice(lastIndex)}
      </span>
    );
  }

  return parts;
}

/**
 * Try to format JSON, return original if not valid JSON
 * Handles template variables like {{variable}} by escaping them first
 */
function tryFormatJson(json: string): string {
  if (!json.trim()) return json;

  // Check if contains templates - escape them, parse, format, restore
  // Match templates that are string values: "{{...}}"
  const stringTemplatePattern = /"(\{\{[^}]+\}\})"/g;
  const bareTemplatePattern = /\{\{[^}]+\}\}/g;
  const templates: string[] = [];

  // First, replace quoted templates "{{...}}" with placeholder strings
  let escaped = json.replace(stringTemplatePattern, (_, template) => {
    templates.push(template);
    return `"__TPL_${templates.length - 1}__"`;
  });

  // Then replace any remaining bare templates {{...}} with placeholder strings
  escaped = escaped.replace(bareTemplatePattern, (match) => {
    templates.push(match);
    return `"__TPL_${templates.length - 1}__"`;
  });

  try {
    const parsed = JSON.parse(escaped);
    let formatted = JSON.stringify(parsed, null, 2);

    // Restore templates
    templates.forEach((template, i) => {
      // Remove quotes around the placeholder since we're restoring the original
      formatted = formatted.replace(`"__TPL_${i}__"`, `"${template}"`);
    });

    return formatted;
  } catch {
    // Not valid JSON even with escaped templates, return as-is
    return json;
  }
}

/**
 * JSON View - displays JSON with syntax highlighting
 */
export function JsonView({ value, format = true, className, fontSize = "text-xs" }: JsonViewProps) {
  const displayValue = useMemo(() => {
    if (!value) return "";
    return format ? tryFormatJson(value) : value;
  }, [value, format]);

  const highlighted = useMemo(() => {
    if (!displayValue) return null;
    return highlightJson(displayValue);
  }, [displayValue]);

  if (!highlighted) {
    return (
      <div className={cn("p-3 rounded-md border bg-background", className)}>
        <span className="text-zinc-500 italic">Empty</span>
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border overflow-hidden bg-background", className)}>
      <pre className={cn("p-3 overflow-x-auto font-mono leading-relaxed", fontSize)}>
        <code>{highlighted}</code>
      </pre>
    </div>
  );
}

/**
 * Inline JSON - for single-line JSON display without container
 */
export function JsonInline({ value, className }: { value: string; className?: string }) {
  const highlighted = useMemo(() => {
    if (!value) return null;
    return highlightJson(value);
  }, [value]);

  if (!highlighted) return null;

  return <span className={cn("font-mono", className)}>{highlighted}</span>;
}
