/**
 * PluginAddonContainer Component
 *
 * Container that renders all plugin addons attached to a parent node.
 * Manages vertical stacking when multiple plugins are attached.
 *
 * This component is rendered within BaseNode, between the body and output handle.
 * Uses the plugin registry to look up addon components dynamically.
 */

import { memo, useCallback } from "react";

import type { PluginNode } from "@journey/schemas";
import { uiActions } from "@/stores/ui-store";
import { pluginRegistry } from "../../plugins";
// Import definitions to trigger registration
import "../../plugins/definitions";

interface PluginAddonContainerProps {
  plugins: PluginNode[];
  parentNodeId: string;
  isEditMode: boolean;
  selectedPluginId?: string | null;
}

/**
 * Renders the appropriate addon component based on plugin type.
 * Uses the plugin registry for dynamic component lookup.
 */
function renderPluginAddon(
  plugin: PluginNode,
  isEditMode: boolean,
  isSelected: boolean,
  onSelect: () => void
) {
  const { data, id } = plugin;

  // Look up plugin definition from registry
  const definition = pluginRegistry.get(data.pluginType);
  if (!definition || !definition.isType(data)) {
    // Unknown plugin type - skip rendering
    return null;
  }

  // Render the addon component from the definition
  const AddonComponent = definition.Addon;
  if (!AddonComponent) {
    return null;
  }
  return (
    <AddonComponent
      key={id}
      data={data}
      pluginId={id}
      isEditMode={isEditMode}
      isSelected={isSelected}
      onSelect={onSelect}
    />
  );
}

export const PluginAddonContainer = memo(function PluginAddonContainer({
  plugins,
  parentNodeId,
  isEditMode,
  selectedPluginId,
}: PluginAddonContainerProps) {
  // Handler to select a plugin for editing
  const handleSelectPlugin = useCallback(
    (pluginId: string) => {
      if (!isEditMode) return;

      // Use atomic action that selects both parent node and plugin together
      // This avoids the race condition where setSelectedNode clears selectedPluginId
      uiActions.selectPluginWithNode(pluginId, parentNodeId);
    },
    [isEditMode, parentNodeId]
  );

  if (plugins.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {plugins.map((plugin) =>
        renderPluginAddon(
          plugin,
          isEditMode,
          selectedPluginId === plugin.id,
          () => handleSelectPlugin(plugin.id)
        )
      )}
    </div>
  );
});
