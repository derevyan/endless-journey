/**
 * Unified Tool System Type Definitions
 *
 * This module defines the unified type system for all tool sources:
 * - System tools: Context-aware tools requiring services (memory, variables, messenger)
 * - Utility tools: In-process tools with no context needed (current_time, web_search)
 * - MCP tools: External server tools via Model Context Protocol
 *
 * @module tools/unified/types
 */

import type { AgentToolAny, ToolRetryConfig, ToolTimingConfig } from "@journey/schemas";
import type { BuiltinToolContext, ToolFactory } from "../builtin/types";

// Re-export shared types from @journey/schemas (single source of truth)
export {
  type ToolSource,
  type ToolCategory,
  type RequiredService,
  type ToolParameterProperty,
  type ToolParameterSchema,
  type UnifiedToolDefinition,
  type ToolDefinition,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
} from "@journey/schemas";

// Import for local use in this file
import type { ToolSource, ToolCategory, RequiredService } from "@journey/schemas";

type AgentTool = AgentToolAny;

// ============================================================================
// REGISTRATION METADATA
// ============================================================================

/**
 * Metadata for registering a system tool (factory-based)
 */
export interface SystemToolMetadata {
  /** Tool name (snake_case, used in LLM calls) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Tool description */
  description: string;
  /** Tool category */
  category: ToolCategory;
  /** Required services for this tool */
  requiredServices: RequiredService[];
  /** Optional retry configuration */
  retry?: ToolRetryConfig;
  /** Example natural language prompt that would trigger this tool */
  usageExample?: string;
  /**
   * Execution timing configuration.
   *
   * Determines when tool executes relative to message sending.
   * If configurable=true, UI shows toggle for timing override.
   */
  timingConfig?: ToolTimingConfig;
}

/**
 * Metadata for registering a utility tool (in-process)
 */
export interface UtilityToolMetadata {
  /** Tool name (snake_case, used in LLM calls) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Tool description */
  description: string;
  /** Tool category */
  category: ToolCategory;
  /** Whether tool requires an API key */
  requiresApiKey?: boolean;
  /** Environment variable name for API key */
  apiKeyEnvVar?: string;
  /** Example natural language prompt that would trigger this tool */
  usageExample?: string;
  /**
   * Execution timing configuration.
   *
   * Determines when tool executes relative to message sending.
   * If configurable=true, UI shows toggle for timing override.
   */
  timingConfig?: ToolTimingConfig;
}

/**
 * Metadata for MCP tools (received from MCP service)
 */
export interface MCPToolMetadata {
  /** Tool name as provided by MCP server */
  name: string;
  /** Tool description */
  description: string;
  /** MCP server name */
  serverName: string;
  /** JSON schema for tool arguments */
  schema: Record<string, unknown>;
}

// ============================================================================
// REGISTERED TOOL ENTRIES
// ============================================================================

/**
 * Registered system tool (factory + metadata)
 */
export interface RegisteredSystemTool {
  factory: ToolFactory;
  metadata: SystemToolMetadata;
}

/**
 * Registered utility tool (tool + metadata)
 */
export interface RegisteredUtilityTool {
  tool: AgentTool;
  metadata: UtilityToolMetadata;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Unified tools configuration for agent nodes
 *
 * Replaces the old WorkflowToolsConfig with its boolean toggles
 * and ExternalToolsConfig with its separate embedded/mcp arrays.
 */
export interface UnifiedToolsConfig {
  /** Tool IDs to enable (e.g., ["system:save_memory", "utility:current_time"]) */
  enabled: string[];
  /** MCP server names to connect to (for MCP tool discovery) */
  mcpServers?: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Valid tool sources for validation
 */
const VALID_SOURCES: readonly ToolSource[] = ["system", "utility", "mcp"];

/**
 * Check if a string is a valid ToolSource
 */
function isValidSource(source: string): source is ToolSource {
  return VALID_SOURCES.includes(source as ToolSource);
}

/**
 * Parse a tool ID into its components
 *
 * Validates that:
 * - Source is a valid ToolSource (system, utility, mcp)
 * - Name is non-empty
 * - MCP tools have a non-empty server name
 *
 * @example
 * parseToolId("system:save_memory") => { source: "system", name: "save_memory" }
 * parseToolId("mcp:fetch:fetch") => { source: "mcp", server: "fetch", name: "fetch" }
 *
 * @throws Error if the tool ID format is invalid
 */
export function parseToolId(id: string): {
  source: ToolSource;
  name: string;
  server?: string;
} {
  if (!id || typeof id !== "string") {
    throw new Error(`Invalid tool ID: expected non-empty string`);
  }

  const parts = id.split(":");

  // Must have at least source:name
  if (parts.length < 2) {
    throw new Error(`Invalid tool ID format: ${id} (expected source:name)`);
  }

  const source = parts[0];
  if (!source || !isValidSource(source)) {
    throw new Error(`Invalid tool source "${source}" in: ${id} (expected: system, utility, or mcp)`);
  }

  // Standard format: source:name
  if (parts.length === 2) {
    const name = parts[1];
    if (!name) {
      throw new Error(`Invalid tool ID: empty name in ${id}`);
    }
    return { source, name };
  }

  // MCP format: mcp:server:name
  if (parts.length === 3 && source === "mcp") {
    const server = parts[1];
    const name = parts[2];
    if (!server) {
      throw new Error(`Invalid MCP tool ID: empty server in ${id}`);
    }
    if (!name) {
      throw new Error(`Invalid MCP tool ID: empty name in ${id}`);
    }
    return { source: "mcp", server, name };
  }

  throw new Error(`Invalid tool ID format: ${id}`);
}

/**
 * Create a tool ID from components
 *
 * @example
 * createToolId("system", "save_memory") => "system:save_memory"
 * createToolId("mcp", "fetch", "fetch") => "mcp:fetch:fetch"
 */
export function createToolId(source: ToolSource, name: string, server?: string): string {
  if (source === "mcp" && server) {
    return `mcp:${server}:${name}`;
  }
  return `${source}:${name}`;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { BuiltinToolContext, ToolFactory };
// Re-export canonical types from @journey/schemas for convenience
export type { AgentToolAny, ToolRetryConfig, ToolTimingConfig, ToolExecutionTiming } from "@journey/schemas";
// Export local AgentTool alias
export type { AgentTool };
