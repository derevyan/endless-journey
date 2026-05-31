/**
 * useNodePlugins Hook
 *
 * Efficient store subscription for getting plugins attached to a specific node.
 * Returns an array of PluginNode objects from the node's embedded plugins.
 *
 * With the embedded plugin architecture, plugins live in node.data.plugins[].
 * This hook derives PluginNode-shaped objects for UI rendering (addons, edges).
 */

import { useStore } from "@tanstack/react-store";
import { useMemo } from "react";

import type { PluginNode } from "@journey/schemas";
import { journeyNodesStore } from "@/stores/journey-nodes-store";
import { buildPluginNodesForNode } from "../plugins/utils/derive-plugin-nodes";

/**
 * Get plugins attached to a specific node
 *
 * @param nodeId - The parent node ID to get plugins for
 * @returns Array of PluginNode objects derived from embedded plugin data
 */
export function useNodePlugins(nodeId: string): PluginNode[] {
  // Subscribe to nodes array to read embedded plugins
  const nodes = useStore(journeyNodesStore, (s) => s.nodes);

  // Create synthetic PluginNode objects from embedded plugin data
  return useMemo(() => {
    if (!nodeId || !nodes) return [];

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return [];

    return buildPluginNodesForNode(node);
  }, [nodeId, nodes]);
}
