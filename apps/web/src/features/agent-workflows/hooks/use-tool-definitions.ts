/**
 * Tool Definitions Query Hooks
 *
 * TanStack Query hooks for fetching available agent tools from the backend.
 * Returns unified tool definitions for all tool types (system, utility, MCP).
 *
 * @module features/agent-workflows/hooks/use-tool-definitions
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// Import shared types from @journey/schemas (single source of truth)
import type { ToolSource, ToolCategory, ToolDefinition, RequiredService, ToolParameterProperty, ToolParameterSchema } from "@journey/schemas";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@journey/schemas";

// Re-export types for components that import from this hook file
export type { ToolSource, ToolCategory, ToolDefinition, RequiredService, ToolParameterProperty, ToolParameterSchema };
export { CATEGORY_ORDER, CATEGORY_LABELS };

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Response structure for /api/llm/tools endpoint
 */
interface ToolDefinitionsResponse {
  tools: ToolDefinition[];
  metadata: {
    count: {
      total: number;
      system: number;
      utility: number;
      mcp: number;
    };
    timestamp: string;
  };
}

/**
 * Response structure for /api/llm/tools/categories endpoint
 */
interface ToolDefinitionsByCategoryResponse {
  categories: Record<ToolCategory, ToolDefinition[]>;
}

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * Fetch all available agent tools
 *
 * Returns all tools with metadata for the workflow builder UI.
 * Includes system, utility, and MCP tools with availability status.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useToolDefinitions();
 * if (data) {
 *   // Access tool count: data.metadata.count.total
 *   // Iterate tools: data.tools.map(tool => tool.displayName)
 * }
 * ```
 */
export function useToolDefinitions() {
  return useQuery({
    queryKey: ["llm", "tools"],
    queryFn: async (): Promise<ToolDefinitionsResponse> => {
      const response = await fetch("/api/llm/tools");

      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 1000 * 60, // 1 minute (tools may change with MCP server status)
    retry: 2,
  });
}

/**
 * Fetch tools grouped by category
 *
 * Returns tools organized by category for the workflow builder UI.
 *
 * @example
 * ```tsx
 * const { data } = useToolDefinitionsByCategory();
 * if (data) {
 *   // Access categories: Object.keys(data.categories)
 *   // Get tools per category: data.categories.memory, data.categories.utility, etc.
 * }
 * ```
 */
export function useToolDefinitionsByCategory() {
  return useQuery({
    queryKey: ["llm", "tools", "categories"],
    queryFn: async (): Promise<ToolDefinitionsByCategoryResponse> => {
      const response = await fetch("/api/llm/tools/categories");

      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 1000 * 60, // 1 minute
    retry: 2,
  });
}

// =============================================================================
// HOOK WITH UTILITIES
// =============================================================================

/**
 * Hook return type with utility functions
 */
export interface UseToolDefinitionsResult {
  /** All tool definitions */
  tools: ToolDefinition[];
  /** Tools grouped by category */
  toolsByCategory: Record<ToolCategory, ToolDefinition[]>;
  /** Get a specific tool by ID */
  getTool: (id: string) => ToolDefinition | undefined;
  /** Check if a tool exists */
  hasTool: (id: string) => boolean;
  /** Get ordered categories that have tools */
  orderedCategories: ToolCategory[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * useToolDefinitionsWithUtils Hook
 *
 * Returns tool definitions with utility functions for filtering and lookup.
 * This is the main hook to use in the tool selector component.
 *
 * @example
 * ```tsx
 * const { toolsByCategory, orderedCategories, isLoading } = useToolDefinitionsWithUtils();
 *
 * if (isLoading) return <Spinner />;
 *
 * return (
 *   <div>
 *     {orderedCategories.map(category => (
 *       <div key={category}>
 *         <h3>{CATEGORY_LABELS[category]}</h3>
 *         {toolsByCategory[category]?.map(tool => (
 *           <ToolCheckbox key={tool.id} tool={tool} />
 *         ))}
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useToolDefinitionsWithUtils(): UseToolDefinitionsResult {
  const { data, isLoading, error } = useToolDefinitions();

  const tools = useMemo(() => data?.tools ?? [], [data?.tools]);

  const toolsByCategory = useMemo(() => {
    const result: Record<ToolCategory, ToolDefinition[]> = {
      memory: [],
      variables: [],
      tags: [],
      crm: [],
      context: [],
      journey: [],
      messaging: [],
      search: [],
      utility: [],
      external: [],
    };

    for (const tool of tools) {
      if (result[tool.category]) {
        result[tool.category].push(tool);
      }
    }

    return result;
  }, [tools]);

  const orderedCategories = useMemo(() => {
    return CATEGORY_ORDER.filter((cat) => toolsByCategory[cat]?.length > 0);
  }, [toolsByCategory]);

  const getTool = useMemo(() => {
    const toolMap = new Map(tools.map((t) => [t.id, t]));
    return (id: string) => toolMap.get(id);
  }, [tools]);

  const hasTool = useMemo(() => {
    const toolSet = new Set(tools.map((t) => t.id));
    return (id: string) => toolSet.has(id);
  }, [tools]);

  return {
    tools,
    toolsByCategory,
    getTool,
    hasTool,
    orderedCategories,
    isLoading,
    error: error as Error | null,
  };
}
