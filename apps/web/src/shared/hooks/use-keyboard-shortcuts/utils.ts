/**
 * Utility functions for keyboard shortcuts.
 *
 * @module shared/hooks/use-keyboard-shortcuts/utils
 */

import type { ShortcutDefinition } from "./types";

/**
 * Check if a keyboard event matches a shortcut definition.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  const hasModifier = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();
  const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];

  // Check key match
  if (!keys.includes(key)) return false;

  // Check modifier requirement
  if (shortcut.modifier && !hasModifier) return false;
  if (!shortcut.modifier && hasModifier) return false;

  // Check shift requirement (undefined = don't care)
  if (shortcut.shift && !event.shiftKey) return false;
  if (shortcut.shift === false && event.shiftKey) return false;

  return true;
}

/**
 * Check if we should skip shortcuts because user is in a text editing context.
 *
 * Returns true when:
 * - Focus is on an input, textarea, or contenteditable element
 * - Focus is inside a dialog (prevents shortcuts while editing in modals like Monaco)
 */
export function isInTextEditingContext(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  // Check standard text input elements
  const isTextInput =
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    (activeElement instanceof HTMLElement && activeElement.isContentEditable);

  if (isTextInput) return true;

  // Check if focus is inside a dialog (e.g., fullscreen Monaco editor in modal)
  // This prevents Delete/Backspace from triggering canvas actions while editing
  if (activeElement instanceof HTMLElement) {
    return activeElement.closest('[role="dialog"]') !== null;
  }

  return false;
}

/**
 * Check if there's text selected on the page.
 * Used to allow native copy behavior when text is selected.
 */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && selection.toString().trim().length > 0);
}
