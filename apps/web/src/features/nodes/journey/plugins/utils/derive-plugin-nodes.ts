/**
 * Plugin Node Derivation Utilities
 *
 * Helpers for creating synthetic PluginNode objects from embedded plugin data.
 * Keeps ID + position logic consistent across UI + store layers.
 */

import { generatePluginId, getNodePlugins } from "@journey/schemas";
import type { PluginNode } from "@journey/schemas";

import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";

const PLUGIN_NODE_OFFSET_X = 300;

/**
 * Create a synthetic PluginNode for a single plugin entry.
 */
export function buildPluginNode(parentNode: JourneyNode, pluginIndex: number, pluginData: PluginNode["data"]): PluginNode {
  return {
    id: generatePluginId(parentNode.id, pluginIndex),
    type: "plugin",
    data: pluginData,
    position: { x: parentNode.position.x + PLUGIN_NODE_OFFSET_X, y: parentNode.position.y },
    parentNodeId: parentNode.id,
  };
}

/**
 * Create PluginNode wrappers for all plugins attached to a parent node.
 */
export function buildPluginNodesForNode(parentNode: JourneyNode): PluginNode[] {
  const plugins = getNodePlugins(parentNode.data);
  return plugins.map((pluginData, pluginIndex) => buildPluginNode(parentNode, pluginIndex, pluginData));
}

/**
 * Create PluginNode wrappers for all plugins across a journey.
 */
export function buildPluginNodesForJourney(nodes: JourneyNode[]): PluginNode[] {
  const pluginNodes: PluginNode[] = [];
  for (const node of nodes) {
    pluginNodes.push(...buildPluginNodesForNode(node));
  }
  return pluginNodes;
}
