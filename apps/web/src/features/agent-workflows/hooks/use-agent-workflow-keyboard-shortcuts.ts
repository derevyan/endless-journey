/**
 * useAgentWorkflowKeyboardShortcuts - Keyboard shortcuts for the agent workflow canvas
 *
 * Handles:
 * - Ctrl/Cmd + Z: Undo
 * - Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
 * - Ctrl/Cmd + C: Copy selected node
 * - Ctrl/Cmd + V: Paste node from clipboard
 * - Ctrl/Cmd + D: Duplicate selected node (copy + paste)
 * - Delete/Backspace: Delete selected node or edge
 *
 * Uses the shared keyboard shortcuts system with workflow-specific configuration.
 * Disabled when typing in inputs/textareas.
 *
 * @module features/agent-workflows/hooks/use-agent-workflow-keyboard-shortcuts
 */
import { useMemo } from "react";

import { useKeyboardShortcuts, type ShortcutDefinition } from "@/shared/hooks/use-keyboard-shortcuts";

interface AgentWorkflowKeyboardShortcutsConfig {
  /** Whether the canvas is in read-only mode (shortcuts disabled when true) */
  readOnly?: boolean;
  /** ID of the currently selected node */
  selectedNodeId: string | null;
  /** ID of the currently selected edge */
  selectedEdgeId: string | null;
  /** Undo callback */
  onUndo?: () => void;
  /** Redo callback */
  onRedo?: () => void;
  /** Delete node callback */
  onDeleteNode?: (nodeId: string) => void;
  /** Delete edge callback */
  onDeleteEdge?: (edgeId: string) => void;
  /** Copy selected node to clipboard callback */
  onCopyNode?: () => void;
  /** Paste node from clipboard callback */
  onPasteNode?: () => void;
  /** Quick duplicate (copy + paste) callback */
  onDuplicateNode?: () => void;
}

/**
 * Set up keyboard shortcuts for the workflow canvas.
 * Uses the shared useKeyboardShortcuts hook with workflow-specific configuration.
 */
export function useAgentWorkflowKeyboardShortcuts(config: AgentWorkflowKeyboardShortcutsConfig): void {
  const {
    readOnly = false,
    selectedNodeId,
    selectedEdgeId,
    onUndo,
    onRedo,
    onDeleteNode,
    onDeleteEdge,
    onCopyNode,
    onPasteNode,
    onDuplicateNode,
  } = config;

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
      // Delete: Delete or Backspace (works for both nodes and edges)
      {
        key: ["delete", "backspace"],
        requiresSelection: true,
        handler: selectedNodeId
          ? () => onDeleteNode?.(selectedNodeId)
          : selectedEdgeId
            ? () => onDeleteEdge?.(selectedEdgeId)
            : undefined,
      },
    ],
    [onUndo, onRedo, onCopyNode, onPasteNode, onDuplicateNode, onDeleteNode, onDeleteEdge, selectedNodeId, selectedEdgeId]
  );

  useKeyboardShortcuts({
    disabled: readOnly,
    selectedNodeId,
    selectedEdgeId,
    shortcuts,
  });
}
