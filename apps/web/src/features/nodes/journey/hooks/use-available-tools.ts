/**
 * useAvailableTools Hook
 *
 * Provides available external tools for journey agent node configuration.
 * Returns static tool metadata - no API call needed since tools are registered at build time.
 *
 * Note: For agent workflows feature, use `useToolDefinitionsWithUtils` from
 * `@/features/agent-workflows/hooks` instead.
 *
 * @module features/nodes/journey/hooks/use-available-tools
 */

import { useMemo } from "react";

/**
 * Tool category for UI grouping
 */
export type ToolCategory = "search" | "knowledge" | "utility" | "custom";

/**
 * Tool source - where the tool comes from
 */
export type ToolSource = "embedded" | "mcp";

/**
 * Tool availability status for UI display
 */
export interface AvailableTool {
  /** Unique tool identifier (snake_case) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Tool description */
  description: string;
  /** Tool category for grouping */
  category: ToolCategory;
  /** Tool source - embedded (in-process) or MCP (external server) */
  source: ToolSource;
  /** Whether tool requires an API key */
  requiresApiKey: boolean;
  /** Environment variable name for API key (if required) */
  apiKeyEnvVar?: string;
  /** Whether the tool is currently available (API key configured) */
  isConfigured: boolean;
}

/**
 * Static tool definitions
 *
 * These match the tools registered in @journey/llm toolRegistry.
 * In a production setting, this could be fetched from an API endpoint
 * that returns toolRegistry.getToolsMetadata().
 */
const AVAILABLE_TOOLS: AvailableTool[] = [
  // ==========================================================================
  // EMBEDDED TOOLS (in-process, using LangChain integrations)
  // ==========================================================================

  // Search tools
  {
    name: "web_search",
    displayName: "Web Search (Tavily)",
    description: "AI-optimized web search for current information, facts, and recent events",
    category: "search",
    source: "embedded",
    requiresApiKey: true,
    apiKeyEnvVar: "TAVILY_API_KEY",
    isConfigured: false, // Will be updated from server
  },

  // Utility tools
  {
    name: "current_time",
    displayName: "Current Time",
    description: "Get the current date and time with timezone support",
    category: "utility",
    source: "embedded",
    requiresApiKey: false,
    isConfigured: true,
  },

  // ==========================================================================
  // MCP TOOLS (external servers via Model Context Protocol)
  // ==========================================================================

  {
    name: "fetch",
    displayName: "Web Fetch (MCP)",
    description: "Fetch content from web URLs and convert to markdown - runs as external MCP server",
    category: "utility",
    source: "mcp",
    requiresApiKey: false,
    isConfigured: true, // Always available when MCP_FETCH_ENABLED is not "false"
  },
];

/**
 * Group tools by category
 */
function groupToolsByCategory(tools: AvailableTool[]): Record<ToolCategory, AvailableTool[]> {
  return tools.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    },
    {} as Record<ToolCategory, AvailableTool[]>
  );
}

/**
 * Hook return type
 */
export interface UseAvailableToolsResult {
  /** All available tools */
  tools: AvailableTool[];
  /** Tools grouped by category */
  toolsByCategory: Record<ToolCategory, AvailableTool[]>;
  /** Get a specific tool by name */
  getTool: (name: string) => AvailableTool | undefined;
  /** Check if a tool exists */
  hasTool: (name: string) => boolean;
  /** Loading state (always false for static data) */
  isLoading: boolean;
}

/**
 * useAvailableTools Hook
 *
 * Returns available external tools for agent configuration.
 *
 * @example
 * ```tsx
 * const { tools, toolsByCategory } = useAvailableTools();
 *
 * return (
 *   <div>
 *     {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
 *       <div key={category}>
 *         <h3>{category}</h3>
 *         {categoryTools.map(tool => (
 *           <Checkbox key={tool.name} label={tool.displayName} />
 *         ))}
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useAvailableTools(): UseAvailableToolsResult {
  const tools = useMemo(() => AVAILABLE_TOOLS, []);

  const toolsByCategory = useMemo(() => groupToolsByCategory(tools), [tools]);

  const getTool = useMemo(() => {
    const toolMap = new Map(tools.map((t) => [t.name, t]));
    return (name: string) => toolMap.get(name);
  }, [tools]);

  const hasTool = useMemo(() => {
    const toolSet = new Set(tools.map((t) => t.name));
    return (name: string) => toolSet.has(name);
  }, [tools]);

  return {
    tools,
    toolsByCategory,
    getTool,
    hasTool,
    isLoading: false,
  };
}
