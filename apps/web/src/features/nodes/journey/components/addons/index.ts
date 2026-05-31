/**
 * Plugin Addons System
 *
 * Universal system for rendering plugin addons attached to the bottom of nodes.
 * Each plugin type provides its own addon renderer that plugs into the base wrapper.
 *
 * To add a new plugin type:
 * 1. Create a new addon component (e.g., analytics-addon.tsx)
 * 2. Add a type guard and render case in plugin-addon-container.tsx
 * 3. Export from this index file
 */

export { PluginAddonContainer } from "./plugin-addon-container";
export { PluginAddon, ADDON_STYLES, type AddonHandle } from "./plugin-addon";
export { FollowUpAddon } from "./follow-up-addon";
