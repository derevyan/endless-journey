/**
 * Variable Autocomplete Extension
 *
 * CodeMirror extension that triggers a custom dropdown when {{variable}} syntax is detected.
 * Instead of using CodeMirror's built-in autocomplete, this extension emits events
 * to allow rendering a custom React-based variable selector.
 *
 * @module components/ui/codemirror/extensions/variable-autocomplete
 */

import { Extension } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Trigger info passed to the callback when {{ is detected
 */
export interface VariableTriggerInfo {
  /** X coordinate for dropdown positioning */
  x: number;
  /** Y coordinate for dropdown positioning (bottom of cursor) */
  y: number;
  /** Position in doc where the query starts (after {{) */
  queryFrom: number;
  /** Current cursor position in doc */
  cursorPos: number;
  /** Current query text (what's typed after {{) */
  query: string;
}

/**
 * Callback type for when variable autocomplete should be triggered/updated
 */
export type VariableTriggerCallback = (info: VariableTriggerInfo | null) => void;

// =============================================================================
// EXTENSION
// =============================================================================

/**
 * Create a CodeMirror extension that triggers a callback when {{ is detected.
 *
 * This allows the parent component to render a custom dropdown instead of
 * using CodeMirror's built-in autocomplete UI.
 *
 * @param onTrigger - Called with position info when {{ detected, or null to close
 *
 * @example
 * ```tsx
 * const triggerExtension = useMemo(
 *   () => createVariableTriggerExtension((info) => {
 *     if (info) {
 *       setDropdownState({ open: true, ...info });
 *     } else {
 *       setDropdownState({ open: false });
 *     }
 *   }),
 *   []
 * );
 * ```
 */
export function createVariableTriggerExtension(onTrigger: VariableTriggerCallback): Extension {
  return EditorView.updateListener.of((update: ViewUpdate) => {
    // Check on every update (doc change, selection change, etc.)
    const state = update.state;
    const cursorPos = state.selection.main.head;
    const beforeCursor = state.sliceDoc(0, cursorPos);

    // Look for {{ before cursor without a closing }}
    const match = beforeCursor.match(/\{\{([^}]*)$/);

    if (!match) {
      // No {{ found, close dropdown
      onTrigger(null);
      return;
    }

    // Found {{ - get cursor coordinates for dropdown positioning
    const coords = update.view.coordsAtPos(cursorPos);
    if (!coords) {
      onTrigger(null);
      return;
    }

    const query = match[1];
    const queryFrom = cursorPos - query.length;

    onTrigger({
      x: coords.left,
      y: coords.bottom,
      queryFrom,
      cursorPos,
      query,
    });
  });
}

/**
 * Empty extension for when no trigger is needed
 */
export const emptyVariableTriggerExtension: Extension = [];

// =============================================================================
// CODEMIRROR AUTOCOMPLETE (used by JsonEditor)
// =============================================================================

import { autocompletion, CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import type { AvailableVariable } from "@/shared/lib/variables/variable-resolver";

/**
 * Create a completion source for template variables (uses CodeMirror autocomplete)
 */
function createVariableCompletionSource(variables: AvailableVariable[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const beforeCursor = context.state.sliceDoc(0, context.pos);
    const match = beforeCursor.match(/\{\{([^}]*)$/);

    if (!match) {
      return null;
    }

    const query = match[1].toLowerCase();
    const from = context.pos - match[1].length;

    const filtered = variables.filter((v) => v.path.toLowerCase().includes(query));

    const options: Completion[] = filtered.map((v) => ({
      label: v.path,
      detail: v.category,
      info: v.description,
      type: "variable",
      apply: (view, completion, from, to) => {
        const insert = `${completion.label}}}`;
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + insert.length },
        });
      },
    }));

    return {
      from,
      options,
      validFor: /^[\w.]*$/,
    };
  };
}

/**
 * Create a CodeMirror extension for variable autocomplete
 *
 * Used by JsonEditor. For new editors, prefer createVariableTriggerExtension with custom dropdown.
 */
export function createVariableAutocomplete(variables: AvailableVariable[]): Extension {
  return autocompletion({
    override: [createVariableCompletionSource(variables)],
    icons: false,
    optionClass: (completion) => `cm-completion-${completion.type ?? "default"}`,
  });
}

/**
 * Empty variable autocomplete
 *
 * For new editors, prefer emptyVariableTriggerExtension.
 */
export const emptyVariableAutocomplete: Extension = autocompletion({
  override: [],
  icons: false,
});
