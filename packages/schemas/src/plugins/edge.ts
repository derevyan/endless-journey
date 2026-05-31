import { z } from "zod";

/**
 * Plugin Edge Types
 *
 * Defines the edge types used for plugin connections.
 * Plugin edges are managed (auto-created) and have deterministic IDs.
 */
export const PluginEdgeTypes = {
  /** Parent → Plugin connection edge */
  PLUGIN: "plugin",
  /** Plugin → Exit node (when sequence exhausts) */
  PLUGIN_EXIT: "plugin_exit",
  /** Plugin button → Target node */
  PLUGIN_BUTTON: "plugin_button",
} as const;

export const PluginEdgeTypeValues = [
  PluginEdgeTypes.PLUGIN,
  PluginEdgeTypes.PLUGIN_EXIT,
  PluginEdgeTypes.PLUGIN_BUTTON,
] as const;

export const PluginEdgeTypeSchema = z.enum(PluginEdgeTypeValues);

export type PluginEdgeType = z.infer<typeof PluginEdgeTypeSchema>;

/**
 * Plugin Edge ID Formats
 *
 * Deterministic, parseable edge ID formats for plugin edges.
 *
 * Examples:
 * - plugin::v1-button::plugin-fu-v1-button         (parent → plugin)
 * - plugin-btn::plugin-fu-v1-button::0::btn-watch  (step 0 button → target)
 * - plugin-exit::plugin-fu-v1-button               (plugin → exit node)
 */
export const PluginEdgeIdPrefixes = {
  /** Parent → Plugin: plugin::{parentId}::{pluginId} */
  PLUGIN: "plugin",
  /** Button → Target: plugin-btn::{pluginId}::{stepIdx}::{buttonId} */
  PLUGIN_BUTTON: "plugin-btn",
  /** Plugin → Exit: plugin-exit::{pluginId} */
  PLUGIN_EXIT: "plugin-exit",
} as const;

/**
 * Plugin Edge ID utilities
 */
export const PluginEdgeId = {
  /**
   * Create parent → plugin connection edge ID
   */
  connection(parentId: string, pluginId: string): string {
    return `${PluginEdgeIdPrefixes.PLUGIN}::${parentId}::${pluginId}`;
  },

  /**
   * Create plugin button → target edge ID
   */
  button(pluginId: string, stepIndex: number, buttonId: string): string {
    return `${PluginEdgeIdPrefixes.PLUGIN_BUTTON}::${pluginId}::${stepIndex}::${buttonId}`;
  },

  /**
   * Create plugin → exit node edge ID
   */
  exit(pluginId: string): string {
    return `${PluginEdgeIdPrefixes.PLUGIN_EXIT}::${pluginId}`;
  },

  /**
   * Check if edge ID is a plugin edge
   */
  isPluginEdge(edgeId: string): boolean {
    return (
      edgeId.startsWith(PluginEdgeIdPrefixes.PLUGIN + "::") ||
      edgeId.startsWith(PluginEdgeIdPrefixes.PLUGIN_BUTTON + "::") ||
      edgeId.startsWith(PluginEdgeIdPrefixes.PLUGIN_EXIT + "::")
    );
  },

  /**
   * Parse a plugin connection edge ID
   * Returns { parentId, pluginId } or null if not a valid connection edge
   */
  parseConnection(edgeId: string): { parentId: string; pluginId: string } | null {
    const prefix = PluginEdgeIdPrefixes.PLUGIN + "::";
    if (!edgeId.startsWith(prefix)) return null;

    const parts = edgeId.slice(prefix.length).split("::");
    if (parts.length !== 2) return null;

    return { parentId: parts[0], pluginId: parts[1] };
  },

  /**
   * Parse a plugin button edge ID
   * Returns { pluginId, stepIndex, buttonId } or null if not valid
   */
  parseButton(edgeId: string): { pluginId: string; stepIndex: number; buttonId: string } | null {
    const prefix = PluginEdgeIdPrefixes.PLUGIN_BUTTON + "::";
    if (!edgeId.startsWith(prefix)) return null;

    const parts = edgeId.slice(prefix.length).split("::");
    if (parts.length !== 3) return null;

    const stepIndex = parseInt(parts[1], 10);
    if (isNaN(stepIndex)) return null;

    return { pluginId: parts[0], stepIndex, buttonId: parts[2] };
  },

  /**
   * Parse a plugin exit edge ID
   * Returns { pluginId } or null if not valid
   */
  parseExit(edgeId: string): { pluginId: string } | null {
    const prefix = PluginEdgeIdPrefixes.PLUGIN_EXIT + "::";
    if (!edgeId.startsWith(prefix)) return null;

    const pluginId = edgeId.slice(prefix.length);
    if (!pluginId || pluginId.includes("::")) return null;

    return { pluginId };
  },
};
