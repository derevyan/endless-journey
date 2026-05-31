/**
 * Unified Tool System
 *
 * Single source of truth for all tool types:
 * - System tools: Context-aware tools requiring services (memory, variables, messenger)
 * - Utility tools: In-process standalone tools (current_time, web_search)
 * - MCP tools: External server tools via HTTP
 *
 * Usage:
 * ```typescript
 * import { unifiedToolRegistry } from "@journey/llm/tools/unified";
 *
 * // Get all tool definitions (for API)
 * const definitions = await unifiedToolRegistry.getAllDefinitions();
 *
 * // Resolve tools for execution
 * const tools = await unifiedToolRegistry.resolveTools(
 *   ["system:save_memory", "utility:current_time"],
 *   context
 * );
 * ```
 *
 * @module tools/unified
 */

// Types
export type {
  ToolSource,
  ToolCategory,
  RequiredService,
  UnifiedToolDefinition,
  SystemToolMetadata,
  UtilityToolMetadata,
  MCPToolMetadata,
  RegisteredSystemTool,
  RegisteredUtilityTool,
  UnifiedToolsConfig,
  AgentTool,
  BuiltinToolContext,
  ToolFactory,
  ToolRetryConfig,
} from "./types";

// Constants
export { CATEGORY_ORDER, CATEGORY_LABELS } from "./types";

// Tool Name Constants (Single Source of Truth)
export {
  SYSTEM_TOOL_NAMES,
  UTILITY_TOOL_NAMES,
  type SystemToolName,
  type UtilityToolName,
  createSystemToolId,
  createUtilityToolId,
  extractToolName,
  toolNameMatches,
  findToolOverride,
} from "./tool-names";

// Helpers
export { parseToolId, createToolId } from "./types";

// Registry
export { unifiedToolRegistry } from "./registry";

// Import registration functions (not auto-registering on import)
import { registerSystemTools } from "./register-system";
import { registerJourneyTools } from "./register-journey";

/**
 * Explicit registration of built-in tools
 *
 * Call this function during application startup to register system and utility tools.
 * This eliminates side effects from module imports and makes tool registration explicit
 * and testable.
 *
 * Usage:
 * ```typescript
 * import { registerBuiltinTools } from "@journey/llm/tools";
 *
 * // In your app startup (apps/api/src/index.ts or similar)
 * registerBuiltinTools();
 * ```
 *
 * Calling multiple times is safe - subsequent calls are no-ops (each registration
 * function has its own idempotency guard).
 */
export async function registerBuiltinTools(): Promise<void> {
  // Register system tools (idempotent)
  registerSystemTools();

  // Register journey tools (idempotent)
  registerJourneyTools();

  // Import embedded tools module to trigger utility tool auto-registration
  // The embedded tools register themselves via the tool() helper when this module is loaded
  await import("../embedded");
}
