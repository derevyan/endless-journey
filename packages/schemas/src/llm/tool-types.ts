/**
 * Unified Tool Type Definitions
 *
 * Shared between:
 * - packages/llm (backend tool registry)
 * - apps/web (frontend tool selector UI)
 *
 * @module llm/tool-types
 */

import type { ToolTimingConfig } from "./agent-types";

// =============================================================================
// TOOL SOURCE & CATEGORY
// =============================================================================

/**
 * Tool source - where the tool comes from
 *
 * - system: Context-aware tools requiring services (was "builtin")
 * - utility: In-process standalone tools (was "embedded")
 * - mcp: External servers via MCP protocol
 */
export type ToolSource = "system" | "utility" | "mcp";

/**
 * Tool category for UI grouping
 *
 * Categories are organized by function, not by source.
 * This enables a more intuitive UI where users can find tools by what they do.
 */
export type ToolCategory =
  | "memory" // save_memory, recall_memories
  | "variables" // read/write user/journey variables
  | "tags" // add/remove/get user tags
  | "crm" // pipeline stage management
  | "context" // get_user_profile, get_journey_context
  | "messaging" // send_message
  | "journey" // exit_to_next_node, start_journey, list_journeys, get_active_journeys
  | "search" // web_search, duckduckgo_search
  | "utility" // current_time
  | "external"; // MCP tools (fetch, filesystem)

/**
 * Category display order for UI
 */
export const CATEGORY_ORDER: ToolCategory[] = [
  "memory",
  "variables",
  "tags",
  "crm",
  "context",
  "journey",
  "search",
  "utility",
  "messaging",
  "external",
];

/**
 * Category display names for UI
 */
export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  memory: "Memory",
  variables: "Variables",
  tags: "Tags",
  crm: "CRM/Pipeline",
  context: "Context",
  journey: "Journey Routing",
  messaging: "Messaging",
  search: "Search",
  utility: "Utility",
  external: "External (MCP)",
};

// =============================================================================
// TOOL PARAMETERS (JSON Schema for UI display)
// =============================================================================

/**
 * Required services for system tools
 */
export type RequiredService = "memory" | "variable" | "messenger" | "mindstate" | "journey" | "tag" | "crm";

/**
 * JSON Schema property for tool parameter display
 */
export interface ToolParameterProperty {
  /** Parameter type (string, number, boolean, array, object) */
  type: string;
  /** Human-readable description of the parameter */
  description?: string;
  /** Enum values if parameter is an enum */
  enum?: string[];
  /** Default value if any */
  default?: unknown;
  /** Minimum value for numbers */
  minimum?: number;
  /** Maximum value for numbers */
  maximum?: number;
}

/**
 * Simplified JSON Schema for tool parameters
 * Used for displaying parameter information in tooltips
 */
export interface ToolParameterSchema {
  /** Schema type (usually "object") */
  type: string;
  /** Parameter definitions */
  properties?: Record<string, ToolParameterProperty>;
  /** List of required parameter names */
  required?: string[];
}

// =============================================================================
// UNIFIED TOOL DEFINITION
// =============================================================================

/**
 * Unified tool definition - metadata for discovery and UI
 *
 * This is the single source of truth for tool metadata across all sources.
 * All tools (system, utility, MCP) use this same interface.
 */
export interface UnifiedToolDefinition {
  /** Unique tool ID: {source}:{name} or {source}:{server}:{name} for MCP */
  id: string;

  /** Tool name (used in LLM tool calls) */
  name: string;

  /** Human-readable display name for UI */
  displayName: string;

  /** Tool description for UI and LLM */
  description: string;

  /** Tool category for UI grouping */
  category: ToolCategory;

  /** Tool source */
  source: ToolSource;

  /** Whether this tool is currently available */
  available: boolean;

  /** Reason if not available (e.g., "Requires TAVILY_API_KEY") */
  unavailableReason?: string;

  // --- System tool specific ---

  /** Whether tool requires execution context (system tools) */
  requiresContext?: boolean;

  /** Which services this tool requires (system tools) */
  requiredServices?: RequiredService[];

  // --- Utility tool specific ---

  /** API key environment variable name (utility tools) */
  apiKeyEnvVar?: string;

  // --- MCP tool specific ---

  /** MCP server name (for MCP tools) */
  mcpServer?: string;

  // --- AI Usage Info (for tooltips) ---

  /** JSON Schema representation of tool parameters for UI display */
  parameterSchema?: ToolParameterSchema;

  /** Example natural language prompt that would trigger this tool */
  usageExample?: string;

  // --- Execution Timing ---

  /**
   * Execution timing configuration for UI display.
   *
   * Shows toggle for configurable tools, info tooltip for fixed tools.
   * UI reads this to determine whether to show timing toggle.
   */
  timingConfig?: ToolTimingConfig;
}

/**
 * Alias for frontend compatibility
 *
 * Frontend previously used `ToolDefinition` while backend used `UnifiedToolDefinition`.
 * This alias allows both to import from the same source without breaking changes.
 */
export type ToolDefinition = UnifiedToolDefinition;
