import { z } from "zod";

/**
 * Base Plugin Data Schema
 *
 * All plugin types extend this base schema.
 * Plugins are composable features that attach to parent nodes.
 */
export const BasePluginDataSchema = z.object({
  /** Plugin type identifier (e.g., "followup", "analytics") */
  pluginType: z.string(),
  /** Optional display label for the plugin node */
  label: z.string().optional(),
  /** Master toggle - plugin only active when enabled */
  enabled: z.boolean().default(true),
});

export type BasePluginData = z.infer<typeof BasePluginDataSchema>;
