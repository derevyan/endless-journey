/**
 * NodeEditorPanel Component
 *
 * Main entry point for node editing.
 * Routes to type-specific editors based on node type using the node registry.
 * Also handles plugin addons when a plugin is selected within a node.
 */

import { useStore } from "@tanstack/react-store";
import { Panel } from "@xyflow/react";
import { nodeRegistry } from "@/features/nodes/journey/registry/node-registry";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { useNodePlugins } from "@/features/nodes/journey/hooks/use-node-plugins";
import { MessageNodeEditor, PluginNodeEditor } from "@/features/nodes/journey/editors";
import { journeyNodesActions } from "@/stores/journey-nodes-store";
import { uiActions, uiStore } from "@/stores/ui-store";

interface NodeEditorPanelProps {
  node: JourneyNode;
  onClose: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
  sidebarOpen?: boolean;
}

export function NodeEditorPanel({ node, onClose, onDelete, readOnly = false, sidebarOpen = false }: NodeEditorPanelProps) {
  // Check if a plugin addon is selected
  const selectedPluginId = useStore(uiStore, (s) => s.selectedPluginId);
  const plugins = useNodePlugins(node.id);
  const selectedPlugin = selectedPluginId ? plugins.find((p) => p.id === selectedPluginId) : null;

  // Common props for all editors
  const editorProps = {
    node,
    onClose,
    onDelete,
    readOnly,
    sidebarOpen,
  };

  // If a plugin addon is selected, show the plugin editor
  if (selectedPlugin) {
    // Override onDelete to delete the plugin, not the parent node
    const handlePluginDelete = onDelete ? () => {
      journeyNodesActions.deletePlugin(selectedPlugin.id);
      uiActions.clearPluginSelection();
    } : undefined;

    // Pass plugin props directly for type safety
    return (
      <PluginNodeEditor
        pluginId={selectedPlugin.id}
        pluginData={selectedPlugin.data}
        parentNodeId={node.id}
        onClose={onClose}
        onDelete={handlePluginDelete}
        readOnly={readOnly}
      />
    );
  }

  // Regular journey nodes - get editor from registry
  const nodeType = node.data?.type || "message";
  const Editor = nodeRegistry.getEditor(nodeType);

  if (Editor) {
    return <Editor {...editorProps} />;
  }

  // Fallback to message editor for unknown types
  return <MessageNodeEditor {...editorProps} />;
}

export function NodeEditorPanelNotFound() {
  return (
    <Panel position="top-right" className="bg-card p-4 rounded-lg shadow-md border w-96">
      <div className="text-sm text-muted-foreground">Node not found</div>
    </Panel>
  );
}
