/**
 * JsonHighlight Component
 *
 * Production-grade JSON syntax highlighting with proper theme support.
 *
 * @module components/ui/json-highlight
 */

import { Fragment, useMemo } from "react";

interface JsonHighlightProps {
  /** JSON string or object to highlight */
  value: unknown;
  /** Additional class name for the container */
  className?: string;
}

/**
 * Recursively renders JSON with syntax highlighting
 */
function renderValue(value: unknown, indent: number = 0): React.ReactNode {
  const indentStr = "  ".repeat(indent);
  const nextIndent = indent + 1;
  const nextIndentStr = "  ".repeat(nextIndent);

  if (value === null) {
    return <span className="text-rose-400 dark:text-rose-400">null</span>;
  }

  if (value === undefined) {
    return <span className="text-rose-400 dark:text-rose-400">undefined</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span className="text-amber-600 dark:text-amber-400 font-medium">
        {value ? "true" : "false"}
      </span>
    );
  }

  if (typeof value === "number") {
    return (
      <span className="text-blue-600 dark:text-blue-400">{String(value)}</span>
    );
  }

  if (typeof value === "string") {
    // Escape and format the string, handling newlines
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    return (
      <span className="text-emerald-600 dark:text-emerald-400">
        "{escaped}"
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span className="text-muted-foreground">{"[]"}</span>
      );
    }

    return (
      <>
        <span className="text-muted-foreground">{"["}</span>
        {"\n"}
        {value.map((item, index) => (
          <Fragment key={index}>
            {nextIndentStr}
            {renderValue(item, nextIndent)}
            {index < value.length - 1 && (
              <span className="text-muted-foreground">,</span>
            )}
            {"\n"}
          </Fragment>
        ))}
        {indentStr}
        <span className="text-muted-foreground">{"]"}</span>
      </>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-muted-foreground">{"{}"}</span>;
    }

    return (
      <>
        <span className="text-muted-foreground">{"{"}</span>
        {"\n"}
        {entries.map(([key, val], index) => (
          <Fragment key={key}>
            {nextIndentStr}
            <span className="text-sky-600 dark:text-sky-400">"{key}"</span>
            <span className="text-muted-foreground">: </span>
            {renderValue(val, nextIndent)}
            {index < entries.length - 1 && (
              <span className="text-muted-foreground">,</span>
            )}
            {"\n"}
          </Fragment>
        ))}
        {indentStr}
        <span className="text-muted-foreground">{"}"}</span>
      </>
    );
  }

  // Fallback for unknown types
  return <span className="text-muted-foreground">{String(value)}</span>;
}

export function JsonHighlight({ value, className }: JsonHighlightProps) {
  const rendered = useMemo(() => {
    // If it's a string, try to parse it as JSON first
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return renderValue(parsed, 0);
      } catch {
        // If not valid JSON, just render as string
        return renderValue(value, 0);
      }
    }
    return renderValue(value, 0);
  }, [value]);

  return <code className={className}>{rendered}</code>;
}
