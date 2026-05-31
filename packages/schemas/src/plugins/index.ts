// Plugin system schemas - composable features for journey nodes
//
// The plugin system uses embedded plugins in node.data.plugins array.
// Each plugin is a config object with pluginType discriminator.
//
// Phase 1: Follow-Up Plugin only
// Future: Analytics, A/B Test, Gate, Input Validator

// Base plugin schema
export { BasePluginDataSchema, type BasePluginData } from "./base";

// Plugin config schema (for embedded plugins in node.data.plugins)
export { PluginConfigSchema, PluginsArraySchema, type PluginConfig } from "./config";

// Follow-up plugin (Phase 1)
export {
  FollowUpAiConfigSchema,
  FollowUpPluginDataSchema,
  PluginDataSchema,
  type FollowUpAiConfig,
  type FollowUpPluginData,
  type PluginData,
} from "./follow-up";

// Plugin node schema
export {
  PluginNodeSchema,
  PluginTypes,
  PluginTypeSchema,
  PluginTypeValues,
  type PluginNode,
  type PluginType,
} from "./node";

// Plugin edge types and utilities
export {
  PluginEdgeId,
  PluginEdgeIdPrefixes,
  PluginEdgeTypes,
  PluginEdgeTypeSchema,
  PluginEdgeTypeValues,
  type PluginEdgeType,
} from "./edge";

// Plugin type guards (use instead of inline pluginType checks)
export {
  isFollowUpPluginData,
  isFollowUpPlugin,
  assertFollowUpPluginData,
} from "./type-guards";

// Plugin descriptor interfaces + compatibility registry
export { type PluginDescriptorBase } from "./descriptor";
export { type PluginCompatibility } from "./compatibility";
export { PluginCompatibilityRegistry, pluginCompatibilityRegistry } from "./compatibility-registry";

// Base plugin descriptors
export { followUpPluginDescriptor } from "./descriptors/follow-up";

// Plugin ID and data utilities (for synthetic plugin IDs in embedded architecture)
export { generatePluginId, parsePluginId, getNodePlugins } from "./utils";
