/**
 * Types for the keyboard shortcuts system.
 *
 * @module shared/hooks/use-keyboard-shortcuts/types
 */

/** Declarative shortcut definition */
export interface ShortcutDefinition {
  /** Key(s) to match (lowercase) */
  key: string | string[];
  /** Requires Ctrl/Cmd modifier */
  modifier?: boolean;
  /** Requires Shift key (undefined = don't care, false = must NOT be pressed) */
  shift?: boolean;
  /** Only trigger if a node is selected */
  requiresNodeSelection?: boolean;
  /** Only trigger if any element (node or edge) is selected */
  requiresSelection?: boolean;
  /** Skip this shortcut if text is selected on the page (for copy-like operations) */
  skipIfTextSelected?: boolean;
  /** Handler to call when shortcut is triggered */
  handler: (() => void) | undefined;
}

/** Configuration for the useKeyboardShortcuts hook */
export interface KeyboardShortcutsConfig {
  /** Disable all shortcuts (e.g., when in read-only mode) */
  disabled?: boolean;
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Currently selected edge ID (optional, for workflows that support edge selection) */
  selectedEdgeId?: string | null;
  /** Array of shortcut definitions */
  shortcuts: ShortcutDefinition[];
}
