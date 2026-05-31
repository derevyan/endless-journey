/**
 * Frontend Plugin Descriptor
 *
 * Extends shared plugin descriptors with UI-specific configuration.
 */

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

import { createLogger } from "@journey/logger";
import { BaseRegistry, type PluginData, type PluginDescriptorBase } from "@journey/schemas";

import type {
  PluginAddonProps,
  PluginColorScheme,
  PluginEdgeSpec,
  PluginEditorComponentProps,
  PluginHandle,
} from "./types";

export interface FrontendPluginDescriptor<T extends PluginData = PluginData>
  extends PluginDescriptorBase<T> {
  /** Visual icon */
  icon: LucideIcon;
  /** Color scheme for plugin visuals */
  colors: PluginColorScheme;
  /** Editor panel component */
  Editor: ComponentType<PluginEditorComponentProps<T>>;
  /** Optional addon component rendered inside nodes */
  Addon?: ComponentType<PluginAddonProps<T>>;
  /** Handle generation for plugin edges */
  getHandles(data: T): PluginHandle[];
  /** Expected edge generation for plugin sync */
  getExpectedEdges?(pluginId: string, data: T): PluginEdgeSpec[];
}

const log = createLogger("frontend-plugin-registry");

export class FrontendPluginRegistry extends BaseRegistry<string, FrontendPluginDescriptor> {
  constructor() {
    super({
      onDuplicate: (pluginType) => {
        log.warn({ pluginType }, "frontendPluginRegistry:duplicateRegistration");
      },
      allowOverwrite: true,
    });
  }

  register(key: string, item: FrontendPluginDescriptor): void;
  register<T extends PluginData>(descriptor: FrontendPluginDescriptor<T>): void;
  register(
    keyOrDescriptor: string | FrontendPluginDescriptor,
    item?: FrontendPluginDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.register(keyOrDescriptor, item as FrontendPluginDescriptor);
      return;
    }
    super.register(keyOrDescriptor.pluginType, keyOrDescriptor);
  }

  override(key: string, item: FrontendPluginDescriptor): void;
  override<T extends PluginData>(descriptor: FrontendPluginDescriptor<T>): void;
  override(
    keyOrDescriptor: string | FrontendPluginDescriptor,
    item?: FrontendPluginDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.override(keyOrDescriptor, item as FrontendPluginDescriptor);
      return;
    }
    super.override(keyOrDescriptor.pluginType, keyOrDescriptor);
  }

  getTyped<T extends PluginData>(pluginType: T["pluginType"]): FrontendPluginDescriptor<T> | undefined {
    return this.get(pluginType) as FrontendPluginDescriptor<T> | undefined;
  }
}

export const frontendPluginRegistry = new FrontendPluginRegistry();
