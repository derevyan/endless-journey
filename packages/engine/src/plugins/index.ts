/**
 * Plugin System
 *
 * Provides composable features for journey nodes via plugin handlers.
 * Phase 1: Follow-Up Plugin only
 *
 * @module engine/plugins
 */

// Plugin types
export type {
  // Node plugin types
  PluginActivationContext,
  PluginDebugStateProvider,
  PluginExecuteResult,
  PluginExecutionContext,
  PluginFollowUpTimerContext,
  PluginHandler,
  PluginService,
  PluginTimeoutResult,
  // Note: Lifecycle plugin types (LifecyclePlugin, LifecycleEvent, etc.) are defined
  // in types.ts but not exported. Import directly from ./types if needed.
} from "./types";

// Plugin ID helpers (for embedded plugins)
export { generatePluginId, parsePluginId } from "./types";

// Backend plugin registry
export {
  backendPluginRegistry,
  type BackendPluginDescriptor,
  type BackendPluginRegistry,
} from "./backend-plugin-descriptor";

// Plugin orchestrator
export {
  createPluginOrchestrator,
  PluginOrchestrator,
  type PluginOrchestratorDeps,
} from "./plugin-orchestrator";

// Plugin debug state registry
export { createPluginDebugStateRegistry, PluginDebugStateRegistry } from "./debug-state-registry";

// Follow-up plugin handler
export {
  createFollowUpPluginHandler,
  FollowUpPluginHandler,
  followUpDebugStateProvider,
  type FollowUpDebugState,
} from "./follow-up-plugin-handler";
