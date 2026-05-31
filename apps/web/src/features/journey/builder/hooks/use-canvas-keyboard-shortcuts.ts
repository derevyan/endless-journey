/**
 * useCanvasKeyboardShortcuts - Keyboard shortcuts for the journey canvas
 *
 * Handles:
 * - Ctrl/Cmd + Z: Undo
 * - Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
 * - Ctrl/Cmd + C: Copy selected node
 * - Ctrl/Cmd + V: Paste node from clipboard
 * - Ctrl/Cmd + D: Duplicate selected node (copy + paste)
 * - Delete/Backspace: Delete selected node or plugin
 *
 * Shortcuts are only active in edit mode and are disabled when typing in inputs.
 */
import { useMemo } from "react";

import { useKeyboardShortcuts, type ShortcutDefinition } from "@/shared/hooks/use-keyboard-shortcuts";

interface CanvasKeyboardShortcutsConfig {
  /** Whether edit mode is active (shortcuts disabled when false) */
  isEditMode: boolean;
  /** ID of the currently selected node (for delete, copy, duplicate) */
  selectedNodeId: string | null;
  /** ID of the currently selected plugin (for delete) */
  selectedPluginId?: string | null;
  /** Undo callback */
  onUndo?: () => void;
  /** Redo callback */
  onRedo?: () => void;
  /** Delete node callback */
  onDeleteNode?: (nodeId: string) => void;
  /** Delete plugin callback */
  onDeletePlugin?: (pluginId: string) => void;
  /** Copy selected node to clipboard callback */
  onCopyNode?: () => void;
  /** Paste node from clipboard callback */
  onPasteNode?: () => void;
  /** Quick duplicate (copy + paste) callback */
  onDuplicateNode?: () => void;
}

/**
 * Set up keyboard shortcuts for the journey canvas.
 * Uses the shared useKeyboardShortcuts hook with journey-specific configuration.
 */
export function useCanvasKeyboardShortcuts(config: CanvasKeyboardShortcutsConfig): void {
  const { isEditMode, selectedNodeId, selectedPluginId, onUndo, onRedo, onDeleteNode, onDeletePlugin, onCopyNode, onPasteNode, onDuplicateNode } = config;

  // Delete handler that prioritizes plugin deletion over node deletion
  const handleDelete = useMemo(() => {
    return () => {
      // If a plugin is selected, delete the plugin
      if (selectedPluginId && onDeletePlugin) {
        onDeletePlugin(selectedPluginId);
        return;
      }
      // Otherwise delete the node
      if (selectedNodeId && onDeleteNode) {
        onDeleteNode(selectedNodeId);
      }
    };
  }, [selectedNodeId, selectedPluginId, onDeleteNode, onDeletePlugin]);

  const shortcuts = useMemo<ShortcutDefinition[]>(
    () => [
      // Undo: Ctrl/Cmd + Z
      { key: "z", modifier: true, shift: false, handler: onUndo },
      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      { key: "z", modifier: true, shift: true, handler: onRedo },
      { key: "y", modifier: true, shift: false, handler: onRedo },
      // Copy: Ctrl/Cmd + C (skip if text is selected to allow native copy)
      { key: "c", modifier: true, shift: false, requiresNodeSelection: true, skipIfTextSelected: true, handler: onCopyNode },
      // Paste: Ctrl/Cmd + V
      { key: "v", modifier: true, shift: false, handler: onPasteNode },
      // Duplicate: Ctrl/Cmd + D
      { key: "d", modifier: true, shift: false, requiresNodeSelection: true, handler: onDuplicateNode },
      // Delete: Delete or Backspace (handles both plugins and nodes)
      { key: ["delete", "backspace"], requiresNodeSelection: true, handler: handleDelete },
    ],
    [onUndo, onRedo, onCopyNode, onPasteNode, onDuplicateNode, handleDelete]
  );

  useKeyboardShortcuts({
    disabled: !isEditMode,
    selectedNodeId,
    shortcuts,
  });
}
