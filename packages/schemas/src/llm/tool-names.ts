/**
 * System Tool Names - Single Source of Truth
 *
 * Use these constants instead of hardcoding string literals for tool names.
 * TypeScript will catch typos at compile time.
 *
 * This module is in @journey/schemas (not @journey/llm) to allow all packages
 * (engine, llm, api) to import these constants without creating circular dependencies.
 *
 * @example
 * ```typescript
 * import { SYSTEM_TOOL_NAMES } from "@journey/schemas";
 *
 * // In handler checks
 * if (toolCall.name === SYSTEM_TOOL_NAMES.EXIT_TO_NEXT_NODE) {
 *   // handle exit
 * }
 * ```
 *
 * @module llm/tool-names
 */

/**
 * All system tool names as branded constants.
 *
 * These are the internal names used by the LLM and engine.
 * The UI stores tool IDs with prefix (e.g., "system:exit_to_next_node").
 */
export const SYSTEM_TOOL_NAMES = {
  // Memory
  SAVE_MEMORY: "save_memory",
  RECALL_MEMORIES: "recall_memories",

  // Variables - Read
  READ_JOURNEY_VARIABLE: "read_journey_variable",
  READ_USER_VARIABLE: "read_user_variable",
  READ_MINDSTATE_PARAMETER: "read_mindstate_parameter",

  // Variables - Write
  WRITE_JOURNEY_VARIABLE: "write_journey_variable",
  WRITE_USER_VARIABLE: "write_user_variable",

  // Tags
  ADD_USER_TAGS: "add_user_tags",
  REMOVE_USER_TAGS: "remove_user_tags",
  GET_USER_TAGS: "get_user_tags",

  // Pipeline
  MOVE_TO_PIPELINE_STAGE: "move_to_pipeline_stage",
  GET_PIPELINE_POSITION: "get_pipeline_position",

  // Context
  GET_USER_PROFILE: "get_user_profile",
  GET_JOURNEY_CONTEXT: "get_journey_context",
  LIST_JOURNEYS: "list_journeys",
  GET_ACTIVE_JOURNEYS: "get_active_journeys",

  // Messaging & Actions
  SEND_MESSAGE: "send_message",
  EXIT_TO_NEXT_NODE: "exit_to_next_node",
  START_JOURNEY: "start_journey",
} as const;

/**
 * Type for any valid system tool name.
 * Use this for type-safe function parameters.
 */
export type SystemToolName = (typeof SYSTEM_TOOL_NAMES)[keyof typeof SYSTEM_TOOL_NAMES];

/**
 * All utility tool names as branded constants.
 */
export const UTILITY_TOOL_NAMES = {
  CURRENT_TIME: "current_time",
  WEB_SEARCH: "web_search",
} as const;

/**
 * Type for any valid utility tool name.
 */
export type UtilityToolName = (typeof UTILITY_TOOL_NAMES)[keyof typeof UTILITY_TOOL_NAMES];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a prefixed tool ID from a system tool name.
 *
 * @example
 * createSystemToolId("exit_to_next_node") // => "system:exit_to_next_node"
 */
export function createSystemToolId(name: SystemToolName): string {
  return `system:${name}`;
}

/**
 * Create a prefixed tool ID from a utility tool name.
 *
 * @example
 * createUtilityToolId("current_time") // => "utility:current_time"
 */
export function createUtilityToolId(name: UtilityToolName): string {
  return `utility:${name}`;
}

/**
 * Extract the bare tool name from a tool ID (handles all formats).
 *
 * @example
 * extractToolName("system:exit_to_next_node") // => "exit_to_next_node"
 * extractToolName("utility:current_time") // => "current_time"
 * extractToolName("mcp:server:tool") // => "tool"
 * extractToolName("exit_to_next_node") // => "exit_to_next_node" (already bare)
 */
export function extractToolName(toolId: string): string {
  const parts = toolId.split(":");
  return parts[parts.length - 1];
}

/**
 * Check if a tool name matches a tool ID (handles both bare and prefixed formats).
 *
 * @example
 * toolNameMatches("system:exit_to_next_node", "exit_to_next_node") // => true
 * toolNameMatches("exit_to_next_node", "exit_to_next_node") // => true
 * toolNameMatches("utility:current_time", "exit_to_next_node") // => false
 */
export function toolNameMatches(toolId: string, toolName: string): boolean {
  return toolId === toolName || extractToolName(toolId) === toolName;
}

/**
 * Try to find an override for a tool, checking both bare name and prefixed formats.
 *
 * This handles the mismatch between:
 * - UI storing: "system:exit_to_next_node"
 * - Tool having: name = "exit_to_next_node"
 *
 * @param toolName - The bare tool name (e.g., "exit_to_next_node")
 * @param overrides - The overrides record (keys may be bare or prefixed)
 * @returns The override value if found, undefined otherwise
 */
export function findToolOverride<T>(
  toolName: string,
  overrides: Record<string, T> | undefined
): T | undefined {
  if (!overrides) return undefined;

  // Try bare name first
  if (toolName in overrides) {
    return overrides[toolName];
  }

  // Try prefixed formats
  const systemKey = `system:${toolName}`;
  if (systemKey in overrides) {
    return overrides[systemKey];
  }

  const utilityKey = `utility:${toolName}`;
  if (utilityKey in overrides) {
    return overrides[utilityKey];
  }

  return undefined;
}
