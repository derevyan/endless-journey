/**
 * Plugin Utilities
 *
 * Utilities for generating and parsing synthetic plugin IDs,
 * and safely accessing embedded plugins from node data.
 *
 * With embedded plugins (node.data.plugins[]), we use synthetic IDs
 * in format {parentNodeId}-plugin-{index} for backward compatibility.
 *
 * @module schemas/plugins/utils
 */

import type { PluginData } from "./follow-up";

/**
 * Generate a synthetic plugin ID from parent node and index
 * Format: {parentNodeId}-plugin-{index}
 *
 * @param parentNodeId - The ID of the parent node containing the plugin
 * @param pluginIndex - The index of the plugin in node.data.plugins array
 * @returns Synthetic plugin ID string
 */
export function generatePluginId(parentNodeId: string, pluginIndex: number): string {
  return `${parentNodeId}-plugin-${pluginIndex}`;
}

/**
 * Parse a synthetic plugin ID to get parent node and index
 * Format: {parentNodeId}-plugin-{index}
 *
 * @param pluginId - The synthetic plugin ID to parse
 * @returns Object with parentNodeId and pluginIndex, or null if invalid format
 */
export function parsePluginId(pluginId: string): { parentNodeId: string; pluginIndex: number } | null {
  const match = pluginId.match(/^(.+)-plugin-(\d+)$/);
  if (!match) return null;
  return { parentNodeId: match[1], pluginIndex: parseInt(match[2], 10) };
}

/**
 * Safely extract plugins array from node data.
 *
 * Centralizes the type casting that was previously scattered across the codebase.
 * Returns an empty array if no plugins exist.
 *
 * @param nodeData - The node.data object (unknown type for flexibility)
 * @returns Array of plugin data, or empty array if none exist
 */
export function getNodePlugins(nodeData: unknown): PluginData[] {
  const data = nodeData as { plugins?: PluginData[] };
  return data?.plugins ?? [];
}
