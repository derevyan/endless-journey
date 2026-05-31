/**
 * PluginNodeEditor Component
 *
 * Editor for plugin nodes. Routes to plugin-type specific editors
 * using the plugin registry for dynamic component lookup.
 *
 * Currently supports:
 * - Follow-Up Plugin: Timed reminder sequences
 *
 * New plugins are added by registering with the plugin registry.
 */

import { Puzzle } from "lucide-react";

import { EditorBase } from "./editor-base";
import type { PluginEditorProps } from "./types";
import { pluginRegistry } from "../plugins";
// Import definitions to trigger registration
import "../plugins/definitions";

/**
 * Main plugin editor - routes to plugin-specific editors via registry.
 */
export function PluginNodeEditor({
  pluginId,
  pluginData,
  parentNodeId,
  onClose,
  onDelete,
  readOnly,
}: PluginEditorProps) {
  // Look up plugin definition from registry
  const definition = pluginRegistry.get(pluginData.pluginType);

  // Route to plugin-specific editor if definition exists and type matches
  if (definition && definition.isType(pluginData)) {
    const EditorComponent = definition.Editor;
    return (
      <EditorComponent
        pluginId={pluginId}
        pluginData={pluginData}
        parentNodeId={parentNodeId}
        onClose={onClose}
        onDelete={onDelete}
        readOnly={readOnly}
      />
    );
  }

  // Fallback for unknown plugin types
  return (
    <EditorBase
      title="Plugin"
      nodeId={pluginId}
      onClose={onClose}
      onDelete={onDelete}
      readOnly={readOnly}
    >
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Puzzle className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Unknown plugin type</p>
        <p className="text-xs mt-1">{pluginData.pluginType}</p>
      </div>
    </EditorBase>
  );
}
