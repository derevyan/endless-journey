import type { z } from "zod";

import type { PluginData } from "./follow-up";
import type { PluginCompatibility } from "./compatibility";

export interface PluginDescriptorBase<T extends PluginData = PluginData> {
  // Identity
  readonly pluginType: T["pluginType"];
  readonly version: number;
  readonly displayName: string;
  readonly description: string;

  // Schema
  readonly schema: z.ZodType<T>;

  // Compatibility
  readonly compatibility: PluginCompatibility;

  // Factory
  createDefaultData(): T;

  // Type guard
  isType(data: PluginData): data is T;
}
