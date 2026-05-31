/**
 * Backend Plugin Descriptor
 *
 * Extends the shared plugin descriptor with backend execution and lifecycle hooks.
 */

import type { PluginData, PluginDescriptorBase } from "@journey/schemas";
import { BaseRegistry } from "@journey/schemas";

import type { PluginHandler, PluginActivationContext } from "./types";

export interface BackendPluginDescriptor<T extends PluginData = PluginData>
  extends PluginDescriptorBase<T> {
  execution?: PluginHandler<T>;
  lifecycle?: {
    onActivate?: (context: PluginActivationContext) => Promise<void>;
    onDeactivate?: (context: PluginActivationContext) => Promise<void>;
  };
}

type AnyBackendPluginDescriptor = BackendPluginDescriptor<PluginData>;

export class BackendPluginRegistry extends BaseRegistry<string, AnyBackendPluginDescriptor> {
  register(key: string, item: AnyBackendPluginDescriptor): void;
  register<T extends PluginData>(descriptor: BackendPluginDescriptor<T>): void;
  register(
    keyOrDescriptor: string | AnyBackendPluginDescriptor,
    item?: AnyBackendPluginDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.register(keyOrDescriptor, item as AnyBackendPluginDescriptor);
      return;
    }
    super.register(keyOrDescriptor.pluginType, keyOrDescriptor);
  }

  override(key: string, item: AnyBackendPluginDescriptor): void;
  override<T extends PluginData>(descriptor: BackendPluginDescriptor<T>): void;
  override(
    keyOrDescriptor: string | AnyBackendPluginDescriptor,
    item?: AnyBackendPluginDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.override(keyOrDescriptor, item as AnyBackendPluginDescriptor);
      return;
    }
    super.override(keyOrDescriptor.pluginType, keyOrDescriptor);
  }

  getHandler(pluginType: string): PluginHandler | undefined {
    return this.get(pluginType)?.execution;
  }

  getLifecycle(pluginType: string): BackendPluginDescriptor["lifecycle"] | undefined {
    return this.get(pluginType)?.lifecycle;
  }
}

export const backendPluginRegistry = new BackendPluginRegistry();
