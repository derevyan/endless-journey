import { z } from "zod";
import { BasePluginDataSchema } from "./base";

/**
 * Plugin Config Schema
 *
 * Base schema for plugin configs embedded in node.data.plugins.
 * This is the minimal schema used for type-safe array definition in nodes.
 *
 * The full plugin data validation (FollowUpPluginData, etc.) happens at
 * the engine level when processing plugins.
 *
 * NOTE: This file must NOT import from nodes/ to avoid circular dependencies.
 * The plugins/ folder can import from nodes/, but nodes/ can only import
 * from this config.ts file.
 */

/**
 * Plugin Config Schema - minimal validation for embedded plugins
 *
 * Validates basic structure: { pluginType, enabled, ... }
 * Full validation uses PluginDataSchema at runtime.
 */
export const PluginConfigSchema = BasePluginDataSchema.loose();

/**
 * Plugins array schema for node data
 *
 * Allows any valid plugin config in the array.
 * Use this in node data schemas: `plugins: PluginsArraySchema.optional()`
 */
export const PluginsArraySchema = z.array(PluginConfigSchema);

/**
 * Plugin Config type
 *
 * Alias for embedded plugin configuration.
 * In the embedded model, plugins are stored directly in node.data.plugins
 * rather than in a separate pluginNodes array.
 */
export type PluginConfig = z.infer<typeof PluginConfigSchema>;
