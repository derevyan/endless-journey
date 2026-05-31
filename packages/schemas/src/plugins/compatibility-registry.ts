import type { NodeType } from "../nodes";
import { getNodeCapabilities } from "../nodes/capabilities";
import { BaseRegistry } from "../registry/base-registry";
import type { PluginCompatibility } from "./compatibility";

export class PluginCompatibilityRegistry extends BaseRegistry<string, PluginCompatibility> {
  register(key: string, item: PluginCompatibility): void;
  register(entry: PluginCompatibility & { pluginType: string }): void;
  register(
    keyOrEntry: string | (PluginCompatibility & { pluginType: string }),
    item?: PluginCompatibility
  ): void {
    if (typeof keyOrEntry === "string") {
      super.register(keyOrEntry, item as PluginCompatibility);
      return;
    }
    super.register(keyOrEntry.pluginType, keyOrEntry);
  }

  getCompatibility(pluginType: string): PluginCompatibility | undefined {
    return this.get(pluginType);
  }

  isCompatible(pluginType: string, nodeType: NodeType): boolean {
    const compatibility = this.get(pluginType);
    if (!compatibility) {
      return false;
    }

    if (!compatibility.compatibleNodeTypes.includes(nodeType)) {
      return false;
    }

    if (compatibility.requiredCapabilities?.length) {
      const capabilities = getNodeCapabilities(nodeType);
      const hasAll = compatibility.requiredCapabilities.every((capability) => capabilities[capability]);
      if (!hasAll) {
        return false;
      }
    }

    return true;
  }

  getCompatiblePlugins(nodeType: NodeType): string[] {
    return this.getKeys().filter((pluginType) => this.isCompatible(pluginType, nodeType));
  }

  getCompatibleNodes(pluginType: string): NodeType[] {
    return this.get(pluginType)?.compatibleNodeTypes ?? [];
  }
}

export const pluginCompatibilityRegistry = new PluginCompatibilityRegistry();
