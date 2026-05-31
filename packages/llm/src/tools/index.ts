/**
 * External Tools Repository
 *
 * Central module for external tools that can be used by AI agents.
 * Uses the unified tool registry system.
 *
 * @example
 * ```typescript
 * import { unifiedToolRegistry } from "@journey/llm";
 *
 * // Resolve tools by ID
 * const tools = await unifiedToolRegistry.resolveTools(
 *   ["system:save_memory", "utility:current_time"],
 *   context
 * );
 * ```
 *
 * @module tools
 */

// MCP types (re-exported from @journey/mcp)
export type {
  MCPTransport,
  MCPStdioServerConfig,
  MCPHttpServerConfig,
  MCPServerConfig,
  MCPServersConfig,
  MCPClientOptions,
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPHealthStatus,
  MCPServiceClientOptions,
} from "./types";

// Tool definition helpers
export { tool, type ToolConfig } from "./tool";

// Individual embedded tool exports (for custom registration)
export {
  tavilySearchTool,
  tavilySearchMetadata,
  currentTimeTool,
  currentTimeMetadata,
} from "./embedded";

// Built-in tools (context-aware tools for agent nodes)
export {
  // Types
  type BuiltinToolContext,
  type IVariableService,
  type IMindstateService,
  type IMessengerService,
  type IMemoryService,
  type SharedServiceContext,
  type SessionData,
  type ClientData,
  type SecurityConfig,
  type ToolFactory,
  // Individual tool factories
  createJourneyVariableTool,
  createUserVariableTool,
  createMindstateParameterTool,
  createUserProfileTool,
  createJourneyContextTool,
  createSendMessageTool,
  createExitToNextNodeTool,
  // Category builders
  buildVariableTools,
  buildContextTools,
  buildMessagingTools,
  buildMemoryTools,
} from "./builtin";

// =============================================================================
// UNIFIED TOOL SYSTEM
// =============================================================================

// Re-export unified system (primary API)
export {
  unifiedToolRegistry,
  registerBuiltinTools,
  parseToolId,
  createToolId,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  // Tool name constants (single source of truth)
  SYSTEM_TOOL_NAMES,
  UTILITY_TOOL_NAMES,
  type SystemToolName,
  type UtilityToolName,
  createSystemToolId,
  createUtilityToolId,
  extractToolName,
  toolNameMatches,
  findToolOverride,
  // Types
  type ToolSource,
  type ToolCategory,
  type UnifiedToolDefinition,
  type UnifiedToolsConfig,
  type SystemToolMetadata,
  type UtilityToolMetadata,
  type RequiredService,
} from "./unified";
