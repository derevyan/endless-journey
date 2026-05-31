/**
 * useKeyboardShortcuts - Generic keyboard shortcuts hook for canvas-based editors.
 *
 * Features:
 * - Uses capture phase to intercept events before React Flow
 * - Map-based O(1) key lookup for performance
 * - Lazy text selection check (only when needed)
 * - Skips shortcuts when user is typing in inputs/textareas
 *
 * @module shared/hooks/use-keyboard-shortcuts/use-keyboard-shortcuts
 */

import { useCallback, useEffect, useMemo } from "react";

import type { KeyboardShortcutsConfig, ShortcutDefinition } from "./types";
import { hasTextSelection, isInTextEditingContext, matchesShortcut } from "./utils";

/**
 * Generic keyboard shortcuts hook for canvas-based editors.
 * Uses capture phase to intercept events before ReactFlow handles them.
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig): void {
  const { disabled = false, selectedNodeId, selectedEdgeId, shortcuts } = config;

  // Build key -> shortcuts map for O(1) lookup
  const shortcutMap = useMemo(() => {
    const map = new Map<string, ShortcutDefinition[]>();
    for (const shortcut of shortcuts) {
      const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
      for (const key of keys) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(shortcut);
      }
    }
    return map;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Early exit: not a registered shortcut key
      const potentialShortcuts = shortcutMap.get(key);
      if (!potentialShortcuts) return;

      // Skip if user is in text editing context (input, textarea, contenteditable)
      if (isInTextEditingContext()) return;

      // Lazy text selection check - only compute when a shortcut needs it
      let textSelected: boolean | null = null;
      const getTextSelected = () => {
        if (textSelected === null) textSelected = hasTextSelection();
        return textSelected;
      };

      // Find matching shortcut
      for (const shortcut of potentialShortcuts) {
        if (!shortcut.handler) continue;
        if (shortcut.requiresNodeSelection && !selectedNodeId) continue;
        if (shortcut.requiresSelection && !selectedNodeId && !selectedEdgeId) continue;
        if (shortcut.skipIfTextSelected && getTextSelected()) continue;
        if (!matchesShortcut(event, shortcut)) continue;

        // Match found - execute handler and stop propagation
        event.preventDefault();
        event.stopPropagation();
        shortcut.handler();
        return;
      }
    },
    [shortcutMap, selectedNodeId, selectedEdgeId]
  );

  useEffect(() => {
    if (disabled) return;

    // Use capture phase to get events before ReactFlow
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [disabled, handleKeyDown]);
}
