/**
 * useCodeMirror Hook
 *
 * Core hook for managing CodeMirror editor lifecycle in React.
 * Handles initialization, value synchronization, dynamic configuration,
 * and cleanup.
 *
 * @module components/ui/codemirror/use-codemirror
 */

import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { Compartment, EditorState, Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExt, ViewUpdate } from "@codemirror/view";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { getThemeExtension } from "./theme";

// =============================================================================
// TYPES
// =============================================================================

export interface UseCodeMirrorOptions {
  /** Current value (controlled) */
  value: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Language/syntax extension */
  language?: Extension;
  /** Additional extensions */
  extensions?: Extension[];
  /** Placeholder text when empty */
  placeholder?: string;
  /** Disable editing */
  readOnly?: boolean;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Called when editor is focused */
  onFocus?: () => void;
  /** Called when editor loses focus */
  onBlur?: () => void;
}

export interface UseCodeMirrorReturn {
  /** Ref to attach to container element */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Ref to the editor view instance (for advanced usage) */
  viewRef: React.RefObject<EditorView | null>;
}

// =============================================================================
// COMPARTMENTS
// =============================================================================

// Compartments allow dynamic reconfiguration without recreating the editor
const themeCompartment = new Compartment();
const languageCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const placeholderCompartment = new Compartment();
const extensionsCompartment = new Compartment();

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for managing CodeMirror editor in React
 *
 * @example
 * ```tsx
 * const { containerRef } = useCodeMirror({
 *   value,
 *   onChange,
 *   language: jexlLanguage(),
 *   placeholder: "Enter expression...",
 * });
 *
 * return <div ref={containerRef} className="border rounded-md" />;
 * ```
 */
export function useCodeMirror({
  value,
  onChange,
  language,
  extensions = [],
  placeholder = "",
  readOnly = false,
  minHeight,
  maxHeight,
  onFocus,
  onBlur,
}: UseCodeMirrorOptions): UseCodeMirrorReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const { resolvedTheme } = useTheme();

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    const isDark = resolvedTheme === "dark";

    // Build sizing styles
    const sizingStyles: Record<string, string> = {};
    if (minHeight) sizingStyles["minHeight"] = `${minHeight}px`;
    if (maxHeight) sizingStyles["maxHeight"] = `${maxHeight}px`;

    // Ensure doc is always a string - handle undefined, null, and objects
    const docValue = value == null
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2);

    const state = EditorState.create({
      doc: docValue,
      extensions: [
        // Core features
        history(),
        bracketMatching(),
        autocompletion({
          icons: false,
          addToOptions: [],
        }),
        EditorView.lineWrapping,

        // Keymaps
        keymap.of([...defaultKeymap, ...historyKeymap]),

        // Dynamic compartments
        themeCompartment.of(getThemeExtension(isDark)),
        languageCompartment.of(language ?? []),
        readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
        placeholderCompartment.of(placeholder ? placeholderExt(placeholder) : []),
        extensionsCompartment.of(extensions),

        // Sizing
        EditorView.theme({
          "&": sizingStyles,
          ".cm-scroller": { overflow: "auto" },
        }),

        // Update listener for onChange
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged && onChangeRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),

        // Focus/blur handlers
        EditorView.domEventHandlers({
          focus: () => {
            onFocus?.();
            return false;
          },
          blur: () => {
            onBlur?.();
            return false;
          },
        }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // Only run on mount - other updates handled by effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes to editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // Ensure value is always a string - handle undefined, null, and objects
    const safeValue = value == null
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2);
    const currentValue = view.state.doc.toString();
    if (safeValue !== currentValue) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: safeValue },
        // Don't trigger onChange for external updates
        annotations: [],
      });
    }
  }, [value]);

  // Update theme when it changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const isDark = resolvedTheme === "dark";
    view.dispatch({
      effects: themeCompartment.reconfigure(getThemeExtension(isDark)),
    });
  }, [resolvedTheme]);

  // Update language when it changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: languageCompartment.reconfigure(language ?? []),
    });
  }, [language]);

  // Update readOnly state
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  // Update placeholder
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: placeholderCompartment.reconfigure(placeholder ? placeholderExt(placeholder) : []),
    });
  }, [placeholder]);

  // Update additional extensions
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: extensionsCompartment.reconfigure(extensions),
    });
  }, [extensions]);

  return {
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    viewRef: viewRef as React.RefObject<EditorView | null>,
  };
}

/**
 * Focus the editor programmatically
 */
export function focusEditor(view: EditorView | null): void {
  view?.focus();
}

/**
 * Get current cursor position
 */
export function getCursorPosition(view: EditorView | null): number {
  return view?.state.selection.main.head ?? 0;
}

/**
 * Insert text at cursor position
 */
export function insertAtCursor(view: EditorView | null, text: string): void {
  if (!view) return;

  const pos = view.state.selection.main.head;
  view.dispatch({
    changes: { from: pos, to: pos, insert: text },
    selection: { anchor: pos + text.length },
  });
  view.focus();
}
