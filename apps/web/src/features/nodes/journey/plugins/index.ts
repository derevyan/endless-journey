/**
 * Plugin System Barrel Export
 *
 * Central export for the frontend plugin registry system.
 *
 * Usage:
 * ```ts
 * import { pluginRegistry, type FrontendPluginDescriptor } from "@/features/nodes/journey/plugins";
 *
 * // Get a plugin definition
 * const def = pluginRegistry.get("followup");
 * ```
 *
 * @module plugins
 */

// Core types
export type {
  PluginHandle,
  PluginHandleType,
  PluginEdgeSpec,
  PluginColorScheme,
  PluginAddonProps,
  PluginEditorComponentProps,
} from "./types";

// Registry + descriptor types
export { pluginRegistry, type FrontendPluginDescriptor } from "./registry";

// Plugin definitions (import to trigger registration)
export * from "./definitions";
