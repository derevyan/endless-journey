/**
 * Plugin Edge Identity Utilities
 *
 * Web-specific wrappers around @journey/schemas plugin edge utilities.
 * Extends the core schema logic with React Flow handle IDs.
 *
 * Edge types:
 * - PluginConnectionEdgeId: Parent node → Plugin node connection
 * - PluginButtonEdgeId: Plugin button → Target node connections
 * - PluginExitEdgeId: Plugin exit path → Target node connections
 *
 * @module web/journey/nodes/utils/plugin-edge-identity
 */

import { PluginEdgeId, PluginEdgeIdPrefixes } from "@journey/schemas";

/**
 * Plugin Connection Edge ID
 * Format: plugin::{parentId}::{pluginId}
 *
 * These edges connect a parent node to its attached plugin node.
 * They are stored in journey.edges and represent the plugin attachment.
 */
export const PluginConnectionEdgeId = {
  PREFIX: PluginEdgeIdPrefixes.PLUGIN + "::",

  /**
   * Create a plugin connection edge ID
   */
  create: PluginEdgeId.connection,

  /**
   * Check if an edge ID is a plugin connection edge
   */
  is(edgeId: string): boolean {
    // Must start with plugin:: but NOT be a button or exit edge
    if (!edgeId.startsWith(this.PREFIX)) return false;
    if (PluginButtonEdgeId.is(edgeId)) return false;
    if (PluginExitEdgeId.is(edgeId)) return false;
    return true;
  },

  /**
   * Parse a plugin connection edge ID
   */
  parse: PluginEdgeId.parseConnection,

  /**
   * Source handle ID for plugin connection edges.
   * This positions the edge on the RIGHT side of the parent node.
   */
  SOURCE_HANDLE: "plugin-attachment" as const,

  /**
   * Get the source handle ID for a plugin connection edge.
   */
  getSourceHandle(): string {
    return this.SOURCE_HANDLE;
  },
};

/**
 * Plugin Button Edge ID
 * Format: plugin-btn::{pluginId}::{stepIdx}::{buttonId}
 *
 * These edges connect plugin step buttons to target nodes.
 * They are stored in journey.edges and auto-synced with plugin step button targets.
 */
export const PluginButtonEdgeId = {
  PREFIX: PluginEdgeIdPrefixes.PLUGIN_BUTTON + "::",

  /**
   * Create a plugin button edge ID
   */
  create: PluginEdgeId.button,

  /**
   * Check if an edge ID is a plugin button edge
   */
  is(edgeId: string): boolean {
    return edgeId.startsWith(this.PREFIX);
  },

  /**
   * Parse a plugin button edge ID
   */
  parse(edgeId: string): { pluginId: string; stepIdx: number; buttonId: string } | null {
    const result = PluginEdgeId.parseButton(edgeId);
    if (!result) return null;
    // Normalize field name to stepIdx for UI usage
    return { pluginId: result.pluginId, stepIdx: result.stepIndex, buttonId: result.buttonId };
  },

  /**
   * Get the source handle ID for a plugin button edge.
   * Format: plugin-btn-{stepIdx}-{buttonId}
   * This positions the edge on the RIGHT side of the plugin node.
   */
  getSourceHandle(stepIdx: number, buttonId: string): string {
    return `plugin-btn-${stepIdx}-${buttonId}`;
  },

  /**
   * Get the source handle from a parsed edge ID
   */
  getSourceHandleFromEdgeId(edgeId: string): string | null {
    const parsed = this.parse(edgeId);
    if (!parsed) return null;
    return this.getSourceHandle(parsed.stepIdx, parsed.buttonId);
  },
};

/**
 * Plugin Exit Edge ID
 * Format: plugin-exit::{pluginId}
 *
 * These edges connect the plugin's exit path to a target node.
 * They are stored in journey.edges and auto-synced with plugin exit path.
 */
export const PluginExitEdgeId = {
  PREFIX: PluginEdgeIdPrefixes.PLUGIN_EXIT + "::",

  /**
   * Create a plugin exit edge ID
   */
  create: PluginEdgeId.exit,

  /**
   * Check if an edge ID is a plugin exit edge
   */
  is(edgeId: string): boolean {
    return edgeId.startsWith(this.PREFIX);
  },

  /**
   * Parse a plugin exit edge ID
   */
  parse: PluginEdgeId.parseExit,

  /**
   * Source handle ID for plugin exit edges.
   * This positions the edge on the RIGHT side of the plugin node.
   */
  SOURCE_HANDLE: "plugin-exit" as const,

  /**
   * Get the source handle ID for a plugin exit edge.
   */
  getSourceHandle(): string {
    return this.SOURCE_HANDLE;
  },
};

/**
 * Check if an edge is any kind of plugin edge
 */
export function isPluginEdge(edgeId: string): boolean {
  return PluginEdgeId.isPluginEdge(edgeId);
}

/**
 * Get the plugin ID from any plugin edge
 */
export function getPluginIdFromEdge(edgeId: string): string | null {
  const connection = PluginEdgeId.parseConnection(edgeId);
  if (connection) return connection.pluginId;

  const button = PluginEdgeId.parseButton(edgeId);
  if (button) return button.pluginId;

  const exit = PluginEdgeId.parseExit(edgeId);
  if (exit) return exit.pluginId;

  return null;
}
