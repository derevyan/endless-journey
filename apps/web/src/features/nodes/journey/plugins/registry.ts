/**
 * Plugin Registry (Frontend)
 *
 * Facade export for the unified frontend plugin registry.
 */

import { frontendPluginRegistry, type FrontendPluginDescriptor } from "./frontend-plugin-descriptor";

export { frontendPluginRegistry as pluginRegistry };
export type { FrontendPluginDescriptor };
