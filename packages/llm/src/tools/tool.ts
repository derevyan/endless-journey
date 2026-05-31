/**
 * Tool Definition Helper (LangChain-style)
 *
 * Simplified tool creation with function-first design.
 * Auto-registers tools with the unified registry.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { tool } from "../tool";
 *
 * export default tool(
 *   async ({ query }) => {
 *     const result = await searchWeb(query);
 *     return result;
 *   },
 *   {
 *     name: "web_search",
 *     description: "Search the web for information",
 *     schema: z.object({ query: z.string() }),
 *   }
 * );
 * ```
 *
 * @module tools/tool
 */

import type { z, ZodSchema } from "zod";
import type { AgentToolAny, ToolRetryConfig, ToolTimingConfig } from "@journey/schemas";
import type { ToolCategory, UtilityToolMetadata } from "./unified/types";
import { unifiedToolRegistry } from "./unified/registry";

type AgentTool = AgentToolAny;

/**
 * Tool configuration (minimal, flat structure)
 */
export interface ToolConfig<T extends ZodSchema> {
  /** Unique tool identifier (snake_case) */
  name: string;
  /** Tool description for LLM and UI */
  description: string;
  /** Zod schema for input validation */
  schema: T;
  /** Human-readable display name (defaults to name) */
  displayName?: string;
  /** Tool category for UI grouping (defaults to "utility") */
  category?: ToolCategory;
  /** Environment variable name for API key */
  apiKeyEnvVar?: string;
  /** Retry configuration for resilience */
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
 * Create and auto-register a utility tool (LangChain-style)
 *
 * This is the recommended way to create tools. It follows LangChain's
 * function-first design pattern where the execute function is the first
 * argument, making it clear what the tool does.
 *
 * Features:
 * - Execute function first (main focus)
 * - Minimal required config (name, description, schema)
 * - Auto-registration with unified registry
 * - Smart defaults for optional fields
 *
 * @param execute - The tool execution function
 * @param config - Tool configuration
 * @returns The created AgentTool
 *
 * @example
 * ```typescript
 * // Simple tool
 * export default tool(
 *   async ({ expression }) => eval(expression),
 *   {
 *     name: "calculator",
 *     description: "Evaluate a math expression",
 *     schema: z.object({ expression: z.string() }),
 *   }
 * );
 *
 * // Tool with API key
 * export default tool(
 *   async ({ query }) => searchAPI(query),
 *   {
 *     name: "web_search",
 *     description: "Search the web",
 *     schema: z.object({ query: z.string() }),
 *     apiKeyEnvVar: "SEARCH_API_KEY",
 *     category: "search",
 *   }
 * );
 * ```
 */
export function tool<T extends ZodSchema>(
  execute: (args: z.infer<T>) => Promise<unknown>,
  config: ToolConfig<T>
): AgentTool {
  // Create the AgentTool
  const agentTool: AgentTool = {
    name: config.name,
    description: config.description,
    schema: config.schema,
    execute,
    retry: config.retry,
  };

  // Build metadata with smart defaults
  const metadata: UtilityToolMetadata = {
    name: config.name,
    displayName: config.displayName ?? formatDisplayName(config.name),
    description: config.description,
    category: config.category ?? "utility",
    requiresApiKey: !!config.apiKeyEnvVar,
    apiKeyEnvVar: config.apiKeyEnvVar,
    usageExample: config.usageExample,
    timingConfig: config.timingConfig,
  };

  // Auto-register
  unifiedToolRegistry.registerUtility(agentTool, metadata);

  return agentTool;
}

/**
 * Convert snake_case name to Title Case display name
 * @example "web_search" -> "Web Search"
 */
function formatDisplayName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
