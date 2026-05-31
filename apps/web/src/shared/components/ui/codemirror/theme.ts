/**
 * CodeMirror Theme Configuration
 *
 * Provides light/dark theme support using CSS variables from the design system.
 * Uses Compartment for dynamic theme switching without recreating the editor.
 *
 * @module components/ui/codemirror/theme
 */

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * Base editor theme - applies to both light and dark modes
 */
export const baseTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    fontSize: "14px",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
    padding: "8px 12px",
    minHeight: "inherit",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
    borderLeftWidth: "2px",
  },
  ".cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--primary) 30%, transparent) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-line": {
    padding: "0",
  },
  "&.cm-focused": {
    outline: "none",
    boxShadow: "none",
  },
  ".cm-placeholder": {
    color: "var(--muted-foreground)",
    fontStyle: "normal",
  },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.5",
    overflow: "auto",
  },
  // Autocomplete styling
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    "& > ul": {
      fontFamily: "inherit",
      maxHeight: "200px",
      backgroundColor: "var(--popover)",
    },
    "& > ul > li": {
      padding: "4px 8px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      color: "var(--popover-foreground)",
    },
    "& > ul > li[aria-selected]": {
      backgroundColor: "var(--accent)",
      color: "var(--accent-foreground)",
    },
  },
  ".cm-completionLabel": {
    fontSize: "13px",
    color: "var(--foreground)",
  },
  ".cm-completionDetail": {
    fontSize: "11px",
    color: "var(--muted-foreground)",
    marginLeft: "auto",
    fontStyle: "normal",
  },
});

/**
 * Light mode syntax highlighting
 */
const lightHighlightStyle = HighlightStyle.define([
  // Template variables {{...}} - Sky color
  { tag: tags.special(tags.variableName), color: "#0284c7" }, // sky-600

  // Operators - Purple
  { tag: tags.operator, color: "#9333ea" }, // purple-600
  { tag: tags.compareOperator, color: "#9333ea" },
  { tag: tags.logicOperator, color: "#9333ea" },

  // Functions - Blue
  { tag: tags.function(tags.variableName), color: "#2563eb" }, // blue-600

  // Strings - Green
  { tag: tags.string, color: "#16a34a" }, // green-600

  // Numbers - Orange
  { tag: tags.number, color: "#ea580c" }, // orange-600

  // Booleans - Yellow
  { tag: tags.bool, color: "#a16207" }, // yellow-700

  // Null/undefined - Gray
  { tag: tags.null, color: "#6b7280" }, // gray-500

  // Property names - Default foreground
  { tag: tags.propertyName, color: "#0891b2" }, // cyan-600 (for JSON keys)

  // Punctuation - Muted
  { tag: tags.punctuation, color: "#71717a" }, // zinc-500
  { tag: tags.bracket, color: "#71717a" },

  // Comments
  { tag: tags.comment, color: "#9ca3af", fontStyle: "italic" }, // gray-400

  // Keywords
  { tag: tags.keyword, color: "#be185d" }, // pink-700
]);

/**
 * Dark mode syntax highlighting
 */
const darkHighlightStyle = HighlightStyle.define([
  // Template variables {{...}} - Sky color
  { tag: tags.special(tags.variableName), color: "#38bdf8" }, // sky-400

  // Operators - Purple
  { tag: tags.operator, color: "#c084fc" }, // purple-400
  { tag: tags.compareOperator, color: "#c084fc" },
  { tag: tags.logicOperator, color: "#c084fc" },

  // Functions - Blue
  { tag: tags.function(tags.variableName), color: "#60a5fa" }, // blue-400

  // Strings - Green
  { tag: tags.string, color: "#4ade80" }, // green-400

  // Numbers - Orange
  { tag: tags.number, color: "#fb923c" }, // orange-400

  // Booleans - Yellow
  { tag: tags.bool, color: "#facc15" }, // yellow-400

  // Null/undefined - Gray
  { tag: tags.null, color: "#9ca3af" }, // gray-400

  // Property names - Cyan (for JSON keys)
  { tag: tags.propertyName, color: "#22d3ee" }, // cyan-400

  // Punctuation - Muted
  { tag: tags.punctuation, color: "#a1a1aa" }, // zinc-400
  { tag: tags.bracket, color: "#a1a1aa" },

  // Comments
  { tag: tags.comment, color: "#6b7280", fontStyle: "italic" }, // gray-500

  // Keywords
  { tag: tags.keyword, color: "#f472b6" }, // pink-400
]);

/**
 * Get theme extension based on current theme mode
 */
export function getThemeExtension(isDark: boolean): Extension {
  return [
    baseTheme,
    syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle),
  ];
}

/**
 * Light theme extension (for explicit usage)
 */
export const lightTheme: Extension = [
  baseTheme,
  syntaxHighlighting(lightHighlightStyle),
];

/**
 * Dark theme extension (for explicit usage)
 */
export const darkTheme: Extension = [
  baseTheme,
  syntaxHighlighting(darkHighlightStyle),
];
