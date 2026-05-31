/**
 * Monaco Editor Configuration
 *
 * Centralized configuration for Monaco editor appearance and behavior.
 * Edit this file to customize fonts, themes, and editor options.
 *
 * @module components/ui/monaco/monaco-config
 */

import type * as Monaco from "monaco-editor";

// =============================================================================
// THEME CONFIGURATION
// =============================================================================

/**
 * Available themes (just change the value below to switch):
 *
 * DARK: night-owl, github-dark, dracula, monokai, nord,
 *       oceanic-next, tomorrow-night, cobalt2, solarized-dark
 *
 * LIGHT: github-light, solarized-light, tomorrow, clouds, dawn
 */
export const THEMES = {
  dark: "night-owl",
  light: "github-light",
} as const;

// =============================================================================
// FONT CONFIGURATION
// =============================================================================

/**
 * Editor font configuration.
 *
 * Font stack priority:
 * 1. JetBrains Mono - Popular programming font with ligatures
 * 2. Fira Code - Well-known Nerd font with ligatures
 * 3. Cascadia Code - Microsoft's modern programming font
 * 4. SF Mono - Apple's monospace font
 * 5. Menlo - macOS default monospace
 * 6. Consolas - Windows default monospace
 * 7. monospace - System fallback
 */
export const FONT_CONFIG = {
  /** Font family stack (first available font is used) */
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace",
  /** Font size in pixels */
  fontSize: 13,
  /** Line height in pixels */
  lineHeight: 18,
  /** Enable font ligatures (e.g., => becomes arrow) */
  fontLigatures: true,
} as const;

// =============================================================================
// EDITOR OPTIONS
// =============================================================================

/**
 * Default Monaco editor options.
 * These can be overridden by passing options to the component.
 */
export const DEFAULT_EDITOR_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
  // Font settings
  fontFamily: FONT_CONFIG.fontFamily,
  fontSize: FONT_CONFIG.fontSize,
  lineHeight: FONT_CONFIG.lineHeight,
  fontLigatures: FONT_CONFIG.fontLigatures,

  // Layout
  minimap: { enabled: false },
  lineNumbers: "on",
  lineNumbersMinChars: 4,
  wordWrap: "on",
  scrollBeyondLastLine: false,
  folding: false,
  glyphMargin: false,
  padding: { top: 8, bottom: 8 },
  lineDecorationsWidth: 24,

  // Scrollbar
  scrollbar: {
    vertical: "auto",
    horizontal: "auto",
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    // Allow scroll events to propagate to parent when editor doesn't need to scroll
    alwaysConsumeMouseWheel: false,
  },

  // Behavior
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  renderWhitespace: "none",
  cursorBlinking: "blink",
  cursorSmoothCaretAnimation: "off",

  // Selection & highlighting
  renderLineHighlight: "none",
  selectionHighlight: false,
  occurrencesHighlight: "off",

  // Performance: Disable visual features
  matchBrackets: "never",
  renderControlCharacters: false,
  guides: { indentation: false, bracketPairs: false },
  bracketPairColorization: { enabled: false },
  colorDecorators: false,
  colorDecoratorsLimit: 0,

  // Performance: Disable hover/tooltips
  hover: { enabled: false },
  inlayHints: { enabled: "off" },

  // Performance: Disable sticky scroll & linked editing
  stickyScroll: { enabled: false },
  linkedEditing: false,
  dropIntoEditor: { enabled: false },

  // Performance: Optimize scrolling
  smoothScrolling: false,
  scrollBeyondLastColumn: 0,

  // Performance: Optimize long lines/large files
  stopRenderingLineAfter: 10000,
  maxTokenizationLineLength: 20000,
  wrappingStrategy: "simple",

  // Disable unnecessary features for markdown editing
  unicodeHighlight: {
    ambiguousCharacters: false,
    invisibleCharacters: false,
    nonBasicASCII: false,
  },
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  parameterHints: { enabled: false },
  codeLens: false,
  contextmenu: true,
};
