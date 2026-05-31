/**
 * Plugin Edge Generation Utility
 *
 * Generates plugin edges (button targets, exit paths) from embedded plugin data.
 * Called during journey load to recreate edges that are not stored in JSON.
 *
 * @module features/nodes/journey/plugins/utils/generate-plugin-edges
 */

import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { generatePluginId, getNodePlugins } from "@journey/schemas";
import { pluginRegistry } from "..";

/**
 * Generate plugin edges from embedded node.data.plugins[] arrays.
 *
 * This function iterates through all nodes, extracts embedded plugins,
 * and uses each plugin definition's `getExpectedEdges()` to generate
 * the edges that should exist for that plugin.
 *
 * @param nodes - Array of journey nodes with embedded plugins
 * @returns Array of edges for plugin button targets and exit paths
 */
export function generatePluginEdges(nodes: JourneyNode[]): JourneyEdge[] {
  const pluginEdges: JourneyEdge[] = [];

  for (const node of nodes) {
    const plugins = getNodePlugins(node.data);

    for (let pluginIndex = 0; pluginIndex < plugins.length; pluginIndex++) {
      const plugin = plugins[pluginIndex];
      // Use the same ID format as useNodePlugins() and store actions: {parentNodeId}-plugin-{index}
      const pluginId = generatePluginId(node.id, pluginIndex);
      const definition = pluginRegistry.get(plugin.pluginType);

      if (!definition || !definition.isType(plugin) || !definition.getExpectedEdges) {
        // Unknown plugin type or no edge spec - skip
        continue;
      }

      // Get expected edges from plugin definition
      const expectedEdges = definition.getExpectedEdges(pluginId, plugin);

      for (const spec of expectedEdges) {
        pluginEdges.push({
          id: spec.id,
          source: node.id,
          target: spec.target,
          sourceHandle: spec.sourceHandle,
          label: spec.label,
          // Note: Styles are applied by journey-canvas.tsx based on edge ID patterns
          // (PluginButtonEdgeId.is(), PluginExitEdgeId.is())
        });
      }
    }
  }

  return pluginEdges;
}
