/**
 * Embedded Tools Index
 *
 * Auto-discovers and registers all utility tools.
 *
 * ## Adding a New Tool
 *
 * 1. Create a file named `your-tool.tool.ts` in this directory
 * 2. Use `tool()` helper and call `unifiedToolRegistry.registerUtility()`
 * 3. Add an import below - that's it!
 *
 * @example
 * ```typescript
 * // your-tool.tool.ts
 * import { tool } from "../tool";
 * import { unifiedToolRegistry } from "../unified/registry";
 *
 * export const myTool = tool(
 *   async ({ input }) => { ... },
 *   {
 *     name: "my_tool",
 *     description: "Does something useful",
 *     schema: z.object({ input: z.string() }),
 *     category: "utility",
 *   }
 * );
 *
 * // Tool is auto-registered via the tool() helper
 * ```
 *
 * @module tools/embedded
 */

import { createLogger } from "@journey/logger";

const log = createLogger("llm:tools:embedded");

// ============================================================================
// AUTO-REGISTER TOOLS ON IMPORT
// ============================================================================
// Each .tool.ts file self-registers when imported.
// Just add new imports here - tools are auto-registered!

import "./tavily.tool";
import "./current-time.tool";

log.debug("tools:embedded:loaded");

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { tavilySearchTool, tavilySearchMetadata } from "./tavily.tool";
export { currentTimeTool, currentTimeMetadata } from "./current-time.tool";
