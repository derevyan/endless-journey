/**
 * Plugin Debug State Registry
 *
 * A generic registry for plugin debug state providers.
 * Plugins register their debug state extractors, and the registry
 * collects all plugin states for SSE events to the simulator UI.
 *
 * This eliminates hardcoded plugin state handling in SimulatorAdapter.
 *
 * @module plugins/debug-state-registry
 */

import { createLogger } from "@journey/logger";
import type { EnhancedUserJourney } from "@journey/schemas";
import type { PluginDebugStateProvider } from "./types";

const log = createLogger("plugin-debug-registry");

/**
 * Registry for plugin debug state providers.
 *
 * Allows plugins to register extractors for their debug state,
 * which are then collected into a single object for SSE events.
 *
 * @example
 * ```typescript
 * const registry = new PluginDebugStateRegistry();
 * registry.register(followUpDebugProvider);
 * registry.register(analyticsDebugProvider);
 *
 * const pluginStates = registry.extractAll(session);
 * // { followup: [...], analytics: {...} }
 * ```
 */
export class PluginDebugStateRegistry {
  private providers = new Map<string, PluginDebugStateProvider>();

  /**
   * Register a debug state provider for a plugin type.
   *
   * @param provider - The debug state provider to register
   * @throws Error if a provider for this plugin type is already registered
   */
  register(provider: PluginDebugStateProvider): void {
    if (this.providers.has(provider.pluginType)) {
      log.warn(
        { pluginType: provider.pluginType },
        "debugRegistry:providerAlreadyRegistered"
      );
    }
    this.providers.set(provider.pluginType, provider);
    log.debug({ pluginType: provider.pluginType }, "debugRegistry:providerRegistered");
  }

  /**
   * Extract all plugin debug states from a session.
   *
   * Iterates through registered providers and extracts debug state
   * from the corresponding session fields.
   *
   * @param session - The current session state
   * @returns Record mapping pluginType to its debug state
   */
  extractAll(session: EnhancedUserJourney): Record<string, unknown> {
    const states: Record<string, unknown> = {};

    for (const [pluginType, provider] of this.providers) {
      const sessionState = session[provider.sessionStateKey];
      if (sessionState !== undefined) {
        states[pluginType] = provider.extractDebugState(sessionState);
      }
    }

    return states;
  }

  /**
   * Get a provider for a specific plugin type.
   *
   * @param pluginType - The plugin type to get the provider for
   * @returns The provider or undefined if not registered
   */
  getProvider(pluginType: string): PluginDebugStateProvider | undefined {
    return this.providers.get(pluginType);
  }

  /**
   * Check if a provider is registered for a plugin type.
   *
   * @param pluginType - The plugin type to check
   * @returns True if a provider is registered
   */
  hasProvider(pluginType: string): boolean {
    return this.providers.has(pluginType);
  }

  /**
   * Get all registered plugin types.
   *
   * @returns Array of registered plugin type names
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Clear all registered providers (mainly for testing).
   */
  clear(): void {
    this.providers.clear();
  }
}

/**
 * Create a new plugin debug state registry.
 *
 * By default, this creates an empty registry. Providers should be
 * registered by the session manager or engine initialization code.
 *
 * @param providers - Optional array of providers to pre-register
 * @returns A new PluginDebugStateRegistry instance
 */
export function createPluginDebugStateRegistry(
  providers?: PluginDebugStateProvider[]
): PluginDebugStateRegistry {
  const registry = new PluginDebugStateRegistry();

  if (providers) {
    for (const provider of providers) {
      registry.register(provider);
    }
  }

  return registry;
}
