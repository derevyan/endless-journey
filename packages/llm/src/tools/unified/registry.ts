/**
 * Unified Tool Registry
 *
 * Central registry that unifies all tool sources:
 * - System tools: Context-aware factories (memory, variables, messenger)
 * - Utility tools: In-process standalone tools (current_time, web_search)
 * - MCP tools: External server tools via HTTP
 *
 * This registry provides:
 * - Tool registration with metadata
 * - Tool discovery for API endpoints
 * - Tool resolution for agent execution
 *
 * @module tools/unified/registry
 */

import { z } from "zod";
import { createLogger, serializeError } from "@journey/logger";
import { getMCPServiceClient } from "@journey/mcp";
import type { AgentToolAny } from "@journey/schemas";

type AgentTool = AgentToolAny;
import type {
  ToolSource,
  ToolCategory,
  RequiredService,
  UnifiedToolDefinition,
  SystemToolMetadata,
  UtilityToolMetadata,
  RegisteredSystemTool,
  RegisteredUtilityTool,
  BuiltinToolContext,
  ToolFactory,
  ToolParameterSchema,
  ToolParameterProperty,
} from "./types";
import { createToolId, parseToolId } from "./types";

const log = createLogger("llm:tools:unified");

// ============================================================================
// UNIFIED TOOL REGISTRY
// ============================================================================

/**
 * Unified Tool Registry
 *
 * Single source of truth for all tool types. Provides:
 * - Registration: Add system/utility tools with metadata
 * - Discovery: Get all tool definitions for API
 * - Resolution: Convert tool IDs to executable AgentTool[]
 *
 * @example
 * ```typescript
 * // Registration (at module load)
 * unifiedToolRegistry.registerSystem(createSaveMemoryTool, metadata);
 * unifiedToolRegistry.registerUtility(currentTimeTool, metadata);
 *
 * // Discovery (for API endpoint)
 * const definitions = await unifiedToolRegistry.getAllDefinitions();
 *
 * // Resolution (for agent execution)
 * const tools = await unifiedToolRegistry.resolveTools(
 *   ["system:save_memory", "utility:current_time"],
 *   context
 * );
 * ```
 */
class UnifiedToolRegistry {
  private systemTools = new Map<string, RegisteredSystemTool>();
  private utilityTools = new Map<string, RegisteredUtilityTool>();
  private mcpToolsCache: UnifiedToolDefinition[] = [];
  private mcpCacheExpiry = 0;
  private mcpCacheTTL = 5000; // 5 seconds cache
  private mcpFetchPromise: Promise<UnifiedToolDefinition[]> | null = null; // Mutex for concurrent fetches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mcpRawToolsCache: any[] = []; // Cache of original MCP tools with schema

  // ========== REGISTRATION ==========

  /**
   * Register a system tool factory
   *
   * System tools require execution context (services, session).
   * The factory is called at resolution time with the context.
   *
   * This method is idempotent - registering the same tool twice will
   * log a warning and skip the duplicate registration.
   *
   * @param factory - Tool factory function
   * @param metadata - Tool metadata for discovery
   */
  registerSystem(factory: ToolFactory, metadata: SystemToolMetadata): void {
    // Idempotent: Skip if already registered
    if (this.systemTools.has(metadata.name)) {
      log.debug(
        { toolName: metadata.name },
        "tools:unified:registerSystem:alreadyRegistered"
      );
      return;
    }

    const id = createToolId("system", metadata.name);

    this.systemTools.set(metadata.name, { factory, metadata });

    log.debug(
      {
        id,
        name: metadata.name,
        category: metadata.category,
        requiredServices: metadata.requiredServices,
      },
      "tools:unified:registerSystem"
    );
  }

  /**
   * Register a utility tool
   *
   * Utility tools are standalone and don't require context.
   * They're registered once and reused for all executions.
   *
   * This method is idempotent - registering the same tool twice will
   * log a warning and skip the duplicate registration.
   *
   * @param tool - The AgentTool instance
   * @param metadata - Tool metadata for discovery
   */
  registerUtility(tool: AgentTool, metadata: UtilityToolMetadata): void {
    // Idempotent: Skip if already registered
    if (this.utilityTools.has(metadata.name)) {
      log.debug(
        { toolName: metadata.name },
        "tools:unified:registerUtility:alreadyRegistered"
      );
      return;
    }

    const id = createToolId("utility", metadata.name);

    this.utilityTools.set(metadata.name, { tool, metadata });

    log.debug(
      {
        id,
        name: metadata.name,
        category: metadata.category,
        requiresApiKey: metadata.requiresApiKey,
      },
      "tools:unified:registerUtility"
    );
  }

  // ========== DISCOVERY ==========

  /**
   * Get all tool definitions for API response
   *
   * Returns unified definitions for all registered tools plus MCP tools.
   * MCP tools are fetched from the service with caching.
   *
   * @param refreshMCP - Force refresh of MCP tools (default: false)
   */
  async getAllDefinitions(refreshMCP = false): Promise<UnifiedToolDefinition[]> {
    const definitions: UnifiedToolDefinition[] = [];

    // 1. Add system tools
    for (const [name, { metadata, factory }] of this.systemTools) {
      definitions.push(this.systemMetadataToDefinition(name, metadata, factory));
    }

    // 2. Add utility tools
    for (const [name, { metadata, tool }] of this.utilityTools) {
      definitions.push(this.utilityMetadataToDefinition(name, metadata, tool));
    }

    // 3. Add MCP tools (with caching)
    const mcpDefinitions = await this.getMCPDefinitions(refreshMCP);
    definitions.push(...mcpDefinitions);

    log.debug(
      {
        system: this.systemTools.size,
        utility: this.utilityTools.size,
        mcp: mcpDefinitions.length,
        total: definitions.length,
      },
      "tools:unified:getAllDefinitions"
    );

    return definitions;
  }

  /**
   * Get definitions by category
   */
  async getDefinitionsByCategory(category: ToolCategory): Promise<UnifiedToolDefinition[]> {
    const all = await this.getAllDefinitions();
    return all.filter((d) => d.category === category);
  }

  /**
   * Get only available definitions (configured, API keys present)
   */
  async getAvailableDefinitions(): Promise<UnifiedToolDefinition[]> {
    const all = await this.getAllDefinitions();
    return all.filter((d) => d.available);
  }

  // ========== RESOLUTION ==========

  /**
   * Resolve tool IDs to executable AgentTool[]
   *
   * This is the main function used by the agent executor.
   * Takes an array of tool IDs and returns ready-to-use tools.
   *
   * @param ids - Tool IDs to resolve (e.g., ["system:save_memory", "utility:current_time"])
   * @param context - Execution context (required for system tools)
   * @param mcpServers - Optional MCP server filter
   */
  async resolveTools(
    ids: string[],
    context?: BuiltinToolContext,
    mcpServers?: string[]
  ): Promise<AgentTool[]> {
    const tools: AgentTool[] = [];
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const parsed = parseToolId(id);
        const tool = await this.resolveOne(parsed, context, mcpServers);
        if (tool) {
          tools.push(tool);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`${id}: ${msg}`);
        log.warn({ toolId: id, error: msg }, "tools:unified:resolveFailed");
      }
    }

    if (errors.length > 0) {
      log.warn({ errors }, "tools:unified:someToolsNotResolved");
    }

    log.debug(
      {
        requested: ids.length,
        resolved: tools.length,
        failed: errors.length,
      },
      "tools:unified:resolveComplete"
    );

    return tools;
  }

  /**
   * Resolve a single tool by parsed ID
   */
  private async resolveOne(
    parsed: { source: ToolSource; name: string; server?: string },
    context?: BuiltinToolContext,
    mcpServers?: string[]
  ): Promise<AgentTool | null> {
    switch (parsed.source) {
      case "system":
        return this.resolveSystemTool(parsed.name, context);

      case "utility":
        return this.resolveUtilityTool(parsed.name);

      case "mcp":
        return this.resolveMCPTool(parsed.name, parsed.server, mcpServers);

      default:
        throw new Error(`Unknown tool source: ${parsed.source}`);
    }
  }

  /**
   * Resolve a system tool by name
   */
  private resolveSystemTool(name: string, context?: BuiltinToolContext): AgentTool | null {
    const entry = this.systemTools.get(name);
    if (!entry) {
      log.warn({ toolName: name }, "tools:unified:systemToolNotFound");
      return null;
    }

    if (!context) {
      log.warn({ toolName: name }, "tools:unified:systemToolNoContext");
      return null;
    }

    // Check required services
    const missingServices = this.checkRequiredServices(entry.metadata.requiredServices, context);
    if (missingServices.length > 0) {
      log.warn(
        { toolName: name, missingServices },
        "tools:unified:systemToolMissingServices"
      );
      return null;
    }

    // Create tool with context
    return entry.factory(context);
  }

  /**
   * Resolve a utility tool by name
   */
  private resolveUtilityTool(name: string): AgentTool | null {
    const entry = this.utilityTools.get(name);
    if (!entry) {
      log.warn({ toolName: name }, "tools:unified:utilityToolNotFound");
      return null;
    }

    // Check if API key is required and available
    if (entry.metadata.requiresApiKey) {
      // If requires API key, must have apiKeyEnvVar configured
      if (!entry.metadata.apiKeyEnvVar) {
        log.warn(
          { toolName: name },
          "tools:unified:utilityToolMissingEnvVarConfig"
        );
        return null;
      }
      // Check if the env var is set
      if (!process.env[entry.metadata.apiKeyEnvVar]) {
        log.warn(
          { toolName: name, envVar: entry.metadata.apiKeyEnvVar },
          "tools:unified:utilityToolNotConfigured"
        );
        return null;
      }
    }

    return entry.tool;
  }

  /**
   * Resolve an MCP tool by name
   */
  private async resolveMCPTool(
    name: string,
    server?: string,
    mcpServers?: string[]
  ): Promise<AgentTool | null> {
    const client = getMCPServiceClient();
    if (!client) {
      log.warn({}, "tools:unified:mcpClientNotAvailable");
      return null;
    }

    try {
      // Use cached MCP tool definitions (5s TTL) instead of per-tool getTools() calls
      // This dramatically improves performance when resolving multiple tools
      await this.getMCPDefinitions(false);

      // Get the original cached MCP tools (with schema) for this tool resolution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawMcpTools: any[] = this.mcpRawToolsCache;

      // Find matching tool from raw cache by name
      // MCP tool names are formatted as "{serverName}_{toolName}"
      // E.g., "fetch_fetch" for server "fetch" and tool "fetch"
      let tool = rawMcpTools.find((rawTool) => {
        if (server) {
          // With server specified: match exact prefixed name OR exact name from that server
          return (
            (rawTool.serverName === server && rawTool.name === `${server}_${name}`) ||
            (rawTool.serverName === server && rawTool.name === name)
          );
        }
        // Without server: match exact name or exact prefixed name from any server
        return rawTool.name === name || rawTool.name === `${rawTool.serverName}_${name}`;
      });

      // Filter by allowed servers if specified
      if (tool && mcpServers && mcpServers.length > 0) {
        if (!mcpServers.includes(tool.serverName)) {
          log.warn(
            { toolName: name, serverName: tool.serverName, allowedServers: mcpServers },
            "tools:unified:mcpToolServerNotAllowed"
          );
          return null;
        }
      }

      if (!tool) {
        log.warn({ toolName: name, server }, "tools:unified:mcpToolNotFound");
        return null;
      }

      // Convert to AgentTool
      // Capture tool in closure to avoid non-null assertion issues
      const resolvedTool = tool;
      return {
        name: resolvedTool.name,
        description: resolvedTool.description,
        schema: resolvedTool.schema,
        execute: async (args: Record<string, unknown>) => {
          const result = await client.callTool({ toolName: resolvedTool.name, args });
          if (!result.success) {
            const errorMsg = result.error?.message || "Unknown error";
            throw new Error(`MCP tool "${resolvedTool.name}" failed: ${errorMsg}`);
          }
          // Preserve actual result value, only default to empty string if undefined
          return result.result !== undefined ? result.result : "";
        },
      };
    } catch (error) {
      log.error({ err: serializeError(error), toolName: name }, "tools:unified:mcpToolResolveFailed");
      return null;
    }
  }

  // ========== HELPERS ==========

  /**
   * Extract simplified JSON schema from a Zod schema for UI display
   */
  private extractParameterSchema(schema: z.ZodType): ToolParameterSchema | undefined {
    try {
      // Use Zod v4's native JSON Schema conversion
      const jsonSchema = z.toJSONSchema(schema, {
        unrepresentable: "any", // Don't throw on unrepresentable types
      }) as Record<string, unknown>;

      // Simplify the schema for UI display
      return this.simplifySchema(jsonSchema);
    } catch (error) {
      log.debug({ error: serializeError(error) }, "tools:unified:schemaExtractionFailed");
      return undefined;
    }
  }

  /**
   * Simplify a JSON schema for UI display
   * Removes metadata fields and normalizes the structure
   */
  private simplifySchema(schema: Record<string, unknown>): ToolParameterSchema {
    const result: ToolParameterSchema = {
      type: (schema.type as string) || "object",
    };

    // Extract properties if present
    if (schema.properties && typeof schema.properties === "object") {
      result.properties = {};
      for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
        if (value && typeof value === "object") {
          const prop = value as Record<string, unknown>;
          const simplified: ToolParameterProperty = {
            type: this.extractPropertyType(prop),
          };
          if (prop.description) simplified.description = String(prop.description);
          if (Array.isArray(prop.enum)) simplified.enum = prop.enum.map(String);
          if (prop.default !== undefined) simplified.default = prop.default;
          if (typeof prop.minimum === "number") simplified.minimum = prop.minimum;
          if (typeof prop.maximum === "number") simplified.maximum = prop.maximum;
          result.properties[key] = simplified;
        }
      }
    }

    // Extract required fields
    if (Array.isArray(schema.required)) {
      result.required = schema.required.map(String);
    }

    return result;
  }

  /**
   * Extract the type string from a JSON schema property
   */
  private extractPropertyType(prop: Record<string, unknown>): string {
    if (typeof prop.type === "string") return prop.type;
    if (Array.isArray(prop.type)) {
      // Handle nullable types like ["string", "null"]
      const nonNull = prop.type.filter((t) => t !== "null");
      return nonNull[0] || "unknown";
    }
    if (Array.isArray(prop.anyOf) || Array.isArray(prop.oneOf)) {
      // Handle union types - try to find the main type
      const options = (prop.anyOf || prop.oneOf) as Array<Record<string, unknown>>;
      for (const opt of options) {
        if (opt.type && opt.type !== "null") return String(opt.type);
      }
    }
    return "unknown";
  }

  /**
   * Check if required services are available in context
   */
  private checkRequiredServices(
    required: RequiredService[],
    context: BuiltinToolContext
  ): string[] {
    const missing: string[] = [];

    for (const service of required) {
      switch (service) {
        case "memory":
          if (!context.services.memory) missing.push("memory");
          break;
        case "variable":
          if (!context.services.variable) missing.push("variable");
          break;
        case "messenger":
          if (!context.services.messenger) missing.push("messenger");
          break;
        case "mindstate":
          if (!context.services.mindstate) missing.push("mindstate");
          break;
        case "journey":
          if (!context.services.journey) missing.push("journey");
          break;
      }
    }

    return missing;
  }

  /**
   * Convert system tool metadata to unified definition
   */
  private systemMetadataToDefinition(
    name: string,
    metadata: SystemToolMetadata,
    factory: ToolFactory
  ): UnifiedToolDefinition {
    // Extract schema by calling factory with minimal mock context
    let parameterSchema: ToolParameterSchema | undefined;
    try {
      const mockContext = this.createMockContextForSchemaExtraction();
      const tool = factory(mockContext);
      if (tool.schema) {
        parameterSchema = this.extractParameterSchema(tool.schema);
      }
    } catch {
      // Schema extraction failed - continue without it
    }

    return {
      id: createToolId("system", name),
      name: metadata.name,
      displayName: metadata.displayName,
      description: metadata.description,
      category: metadata.category,
      source: "system",
      available: true, // System tools are always "available" - context is checked at resolution
      requiresContext: true,
      requiredServices: metadata.requiredServices,
      parameterSchema,
      usageExample: metadata.usageExample,
      timingConfig: metadata.timingConfig,
    };
  }

  /**
   * Create a minimal mock context for schema extraction
   * This context is only used to call factories to get their schema,
   * not for actual tool execution.
   */
  private createMockContextForSchemaExtraction(): BuiltinToolContext {
    // Use type assertion since we only need the context to create the tool
    // for schema extraction, not for actual execution
    return {
      nodeId: "__schema_extraction__",
      services: {} as BuiltinToolContext["services"], // Services not needed for schema extraction
      session: {
        sessionId: "__mock__",
        userId: "__mock__",
        journeyId: "__mock__",
        currentNodeId: "__mock__",
      },
      log: log, // Use the registry's logger
    };
  }

  /**
   * Convert utility tool metadata to unified definition
   */
  private utilityMetadataToDefinition(
    name: string,
    metadata: UtilityToolMetadata,
    tool: AgentTool
  ): UnifiedToolDefinition {
    const isConfigured = this.checkUtilityConfigured(metadata);

    // Extract schema from the tool
    let parameterSchema: ToolParameterSchema | undefined;
    if (tool.schema) {
      parameterSchema = this.extractParameterSchema(tool.schema);
    }

    return {
      id: createToolId("utility", name),
      name: metadata.name,
      displayName: metadata.displayName,
      description: metadata.description,
      category: metadata.category,
      source: "utility",
      available: isConfigured,
      unavailableReason: !isConfigured
        ? `Requires ${metadata.apiKeyEnvVar} environment variable`
        : undefined,
      apiKeyEnvVar: metadata.apiKeyEnvVar,
      parameterSchema,
      usageExample: metadata.usageExample,
      timingConfig: metadata.timingConfig,
    };
  }

  /**
   * Check if a utility tool is configured (API key available)
   */
  private checkUtilityConfigured(metadata: UtilityToolMetadata): boolean {
    if (!metadata.requiresApiKey) return true;
    if (!metadata.apiKeyEnvVar) return true;
    return !!process.env[metadata.apiKeyEnvVar];
  }

  /**
   * Get MCP tool definitions with caching and deduplication
   *
   * Uses a promise-based mutex to prevent concurrent fetches.
   * If a fetch is in-flight, subsequent calls will wait for it.
   */
  private async getMCPDefinitions(forceRefresh: boolean): Promise<UnifiedToolDefinition[]> {
    const now = Date.now();

    // Return cached if still valid
    if (!forceRefresh && this.mcpCacheExpiry > now && this.mcpToolsCache.length > 0) {
      return this.mcpToolsCache;
    }

    // If a fetch is already in-flight, wait for it
    if (this.mcpFetchPromise) {
      return this.mcpFetchPromise;
    }

    // Start new fetch with mutex
    this.mcpFetchPromise = this.doMCPFetch();
    try {
      return await this.mcpFetchPromise;
    } finally {
      this.mcpFetchPromise = null;
    }
  }

  /**
   * Perform actual MCP tool fetch
   */
  private async doMCPFetch(): Promise<UnifiedToolDefinition[]> {
    const client = getMCPServiceClient();
    if (!client) {
      log.debug({}, "tools:unified:mcpClientNotAvailable");
      return [];
    }

    try {
      const mcpTools = await client.getTools();

      // Cache both the raw tools (for schema access) and unified definitions (for discovery)
      this.mcpRawToolsCache = mcpTools;
      this.mcpToolsCache = mcpTools.map((tool) => ({
        id: createToolId("mcp", tool.name.replace(`${tool.serverName}_`, ""), tool.serverName),
        name: tool.name,
        displayName: this.formatMCPDisplayName(tool.name, tool.serverName),
        description: tool.description,
        category: "external" as ToolCategory,
        source: "mcp" as ToolSource,
        available: true,
        mcpServer: tool.serverName,
      }));

      this.mcpCacheExpiry = Date.now() + this.mcpCacheTTL;

      log.debug({ count: this.mcpToolsCache.length }, "tools:unified:mcpToolsCached");
      return this.mcpToolsCache;
    } catch (error) {
      log.error({ err: serializeError(error) }, "tools:unified:mcpFetchFailed");
      return [];
    }
  }

  /**
   * Format MCP tool display name
   */
  private formatMCPDisplayName(name: string, serverName: string): string {
    // Remove server prefix and format nicely
    // "fetch_fetch" -> "Fetch"
    // "filesystem_read_file" -> "Read File (Filesystem)"
    const toolName = name.replace(`${serverName}_`, "");
    const formatted = toolName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return `${formatted} (${serverName.charAt(0).toUpperCase() + serverName.slice(1)})`;
  }

  // ========== UTILITY METHODS ==========

  /**
   * Get count of registered tools by source
   */
  getCounts(): { system: number; utility: number } {
    return {
      system: this.systemTools.size,
      utility: this.utilityTools.size,
    };
  }

  /**
   * Clear all registered tools (for testing)
   */
  clear(): void {
    this.systemTools.clear();
    this.utilityTools.clear();
    this.mcpToolsCache = [];
    this.mcpCacheExpiry = 0;
  }

  /**
   * Check if a tool is registered
   */
  has(id: string): boolean {
    try {
      const parsed = parseToolId(id);
      switch (parsed.source) {
        case "system":
          return this.systemTools.has(parsed.name);
        case "utility":
          return this.utilityTools.has(parsed.name);
        case "mcp":
          // For MCP, we'd need to check the cache
          return this.mcpToolsCache.some((t) => t.id === id);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Global unified tool registry singleton
 */
export const unifiedToolRegistry = new UnifiedToolRegistry();
