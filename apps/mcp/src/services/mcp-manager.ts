/**
 * MCP Manager Service
 *
 * Manages MCP servers lifecycle using @langchain/mcp-adapters.
 * Provides cached tool access with timeout protection.
 *
 * Uses class-based singleton pattern for:
 * - Better encapsulation of state
 * - Easier testing (resetInstance for clean state)
 * - Clear lifecycle management
 *
 * @module services/mcp-manager
 */

import { createLogger, serializeError } from "@journey/logger";
import type {
  MCPServersConfig,
  MCPTool,
  MCPErrorCode,
  MCPRequestOptions,
  MCPResource,
  MCPResourceTemplate,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptResult,
} from "@journey/mcp";
import type {
  MultiServerMCPClient,
  MCPRawTool,
  MCPTransportOptions,
} from "../types/langchain-mcp";

import { withTimeout } from "../utils";

const log = createLogger("mcp:manager");

// =============================================================================
// CONSTANTS
// =============================================================================

/** Timeout for MCP initialization (30 seconds) */
const INIT_TIMEOUT_MS = 30_000;

/** Timeout for tool execution (30 seconds) */
const TOOL_EXECUTION_TIMEOUT_MS = 30_000;

/** Tool cache TTL (5 seconds) - short to allow hot-reload during dev */
const TOOL_CACHE_TTL_MS = 5_000;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Cached tool entry with both public MCPTool and internal raw tool reference
 */
interface CachedTool {
  tool: MCPTool;
  rawTool: MCPRawTool;
}

// =============================================================================
// MCP MANAGER CLASS
// =============================================================================

/**
 * MCP Manager - Manages MCP server lifecycle and tool operations
 *
 * Singleton pattern with explicit lifecycle management.
 * Use `MCPManager.getInstance()` to get the shared instance.
 * Use `MCPManager.resetInstance()` in tests to reset state.
 */
export class MCPManager {
  private static instance: MCPManager | null = null;

  // Client state
  private client: MultiServerMCPClient | null = null;
  private serverConfig: MCPServersConfig | null = null;
  private isInitializing = false;

  // Tool cache state
  private toolCache: CachedTool[] | null = null;
  private toolCacheTime = 0;
  private toolMap = new Map<string, CachedTool>();
  private fetchPromise: Promise<CachedTool[]> | null = null;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

  /**
   * Get or create the singleton instance
   */
  static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  /**
   * Reset singleton instance (for testing only)
   *
   * Closes the current client and clears all state.
   * Call this in beforeEach/afterEach to ensure clean test state.
   */
  static async resetInstance(): Promise<void> {
    if (MCPManager.instance) {
      await MCPManager.instance.close();
    }
    MCPManager.instance = null;
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Extract server name from tool name
   * Format: "serverName_toolName" -> "serverName"
   */
  private extractServerName(toolName: string): string {
    const underscoreIndex = toolName.indexOf("_");
    return underscoreIndex > 0 ? toolName.substring(0, underscoreIndex) : "unknown";
  }

  /**
   * Clear the tool cache
   */
  private clearToolCache(): void {
    this.toolCache = null;
    this.toolCacheTime = 0;
    this.toolMap.clear();
    this.fetchPromise = null;
  }

  /**
   * Build transport options from request options
   */
  private buildTransportOptions(options?: MCPRequestOptions): MCPTransportOptions | undefined {
    if (!options?.headers || Object.keys(options.headers).length === 0) {
      return undefined;
    }
    return { headers: options.headers };
  }

  /**
   * Normalize server config (convert streamable_http to http)
   */
  private normalizeServerConfig(config: MCPServersConfig): MCPServersConfig {
    const normalized: MCPServersConfig = {};
    for (const [name, server] of Object.entries(config)) {
      if (server.transport === "streamable_http") {
        normalized[name] = { ...server, transport: "http" };
      } else {
        normalized[name] = server;
      }
    }
    return normalized;
  }

  /**
   * Convert raw tools to cached tool entries
   */
  private toCachedTools(rawTools: MCPRawTool[]): CachedTool[] {
    return rawTools.map((rawTool) => ({
      tool: {
        name: rawTool.name,
        description: rawTool.description || "",
        schema: rawTool.schema || {},
        serverName: this.extractServerName(rawTool.name),
      },
      rawTool,
    }));
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Initialize MCP manager with server configuration
   *
   * @param config - Server configuration
   * @throws Error if initialization fails or times out
   */
  async init(config: MCPServersConfig): Promise<void> {
    if (this.isInitializing) {
      log.warn({}, "mcpManager:alreadyInitializing");
      return;
    }

    const normalizedConfig = this.normalizeServerConfig(config);
    const serverCount = Object.keys(normalizedConfig).length;
    if (serverCount === 0) {
      log.info({}, "mcpManager:noServers");
      return;
    }

    this.isInitializing = true;

    try {
      const initPromise = (async () => {
        const { MultiServerMCPClient } = await import("@langchain/mcp-adapters");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new MultiServerMCPClient({
          throwOnLoadError: false,
          prefixToolNameWithServerName: true,
          mcpServers: normalizedConfig as any,
        }) as unknown as MultiServerMCPClient;
      })();

      this.client = await withTimeout(initPromise, INIT_TIMEOUT_MS, "MCP initialization");
      this.serverConfig = normalizedConfig;

      log.info({ serverCount, servers: Object.keys(normalizedConfig) }, "mcpManager:initialized");

      // Check which servers actually loaded tools (detect silent failures)
      const tools = await this.getToolsInternal();
      const serversWithTools = new Set(tools.map((t) => t.tool.serverName));
      const configuredServers = Object.keys(normalizedConfig);

      for (const serverName of configuredServers) {
        if (!serversWithTools.has(serverName)) {
          log.warn({ serverName }, "mcpManager:serverNoTools - Server configured but returned no tools");
        }
      }
    } catch (error) {
      log.error({ err: serializeError(error) }, "mcpManager:initFailed");
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  // ===========================================================================
  // TOOLS
  // ===========================================================================

  /**
   * Internal function to fetch and cache tools
   * Uses promise locking to prevent concurrent fetches
   */
  private async getToolsInternal(): Promise<CachedTool[]> {
    if (!this.client) {
      log.debug({}, "mcpManager:notInitialized");
      return [];
    }

    // Return cached tools if still valid
    const now = Date.now();
    if (this.toolCache && now - this.toolCacheTime < TOOL_CACHE_TTL_MS) {
      return this.toolCache;
    }

    // If a fetch is already in progress, wait for it (prevents race condition)
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // Start new fetch with promise lock
    this.fetchPromise = (async () => {
      try {
        const rawTools = await this.client!.getTools();

        // Transform and cache - store both MCPTool and raw tool reference
        const cached = this.toCachedTools(rawTools);

        this.toolCache = cached;
        this.toolCacheTime = Date.now();

        // Build lookup map
        this.toolMap.clear();
        for (const entry of cached) {
          this.toolMap.set(entry.tool.name, entry);
        }

        return cached;
      } catch (error) {
        log.error({ err: serializeError(error) }, "mcpManager:getToolsFailed");
        return [];
      } finally {
        // Clear the promise lock after fetch completes
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }

  /**
   * Get tools with custom options (bypasses cache)
   */
  private async getToolsWithOptions(
    servers?: string[],
    options?: MCPRequestOptions
  ): Promise<CachedTool[]> {
    if (!this.client) {
      log.debug({}, "mcpManager:notInitialized");
      return [];
    }

    try {
      const transportOptions = this.buildTransportOptions(options);
      let rawTools: MCPRawTool[];

      if (servers && servers.length > 0) {
        rawTools = transportOptions
          ? await this.client.getTools(servers, transportOptions)
          : await this.client.getTools(servers);
      } else if (transportOptions) {
        rawTools = await this.client.getTools([], transportOptions);
      } else {
        rawTools = await this.client.getTools();
      }

      return this.toCachedTools(rawTools);
    } catch (error) {
      log.error({ err: serializeError(error) }, "mcpManager:getToolsWithOptionsFailed");
      return [];
    }
  }

  /**
   * Get all available tools (cached)
   *
   * @returns Array of MCPTool (empty on failure)
   */
  async getTools(servers?: string[], options?: MCPRequestOptions): Promise<MCPTool[]> {
    const hasOptions = !!this.buildTransportOptions(options);
    const cached = hasOptions
      ? await this.getToolsWithOptions(servers, options)
      : await this.getToolsInternal();
    const tools = cached.map((c) => c.tool);

    if (servers && servers.length > 0) {
      const serverSet = new Set(servers);
      return tools.filter((tool) => serverSet.has(tool.serverName));
    }

    return tools;
  }

  /**
   * Get a tool by name (O(1) lookup from cache)
   *
   * @param toolName - Name of tool to find
   * @returns Tool or null if not found
   */
  async getTool(toolName: string, options?: MCPRequestOptions): Promise<MCPTool | null> {
    const hasOptions = !!this.buildTransportOptions(options);

    if (hasOptions) {
      const serverName = this.extractServerName(toolName);
      const servers = serverName !== "unknown" ? [serverName] : undefined;
      const tools = await this.getToolsWithOptions(servers, options);
      return tools.find((entry) => entry.tool.name === toolName)?.tool ?? null;
    }

    // Ensure cache is populated
    await this.getToolsInternal();
    const cached = this.toolMap.get(toolName);
    return cached?.tool || null;
  }

  /**
   * Execute a tool
   *
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @returns Execution result
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    options?: MCPRequestOptions
  ): Promise<{
    success: boolean;
    result?: unknown;
    error?: { code: MCPErrorCode; message: string };
    executionTimeMs: number;
  }> {
    const startTime = Date.now();

    if (!this.client) {
      return {
        success: false,
        error: { code: "MCP_NOT_INITIALIZED", message: "MCP manager not initialized" },
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      const hasOptions = !!this.buildTransportOptions(options);
      let cached: CachedTool | undefined;

      if (hasOptions) {
        const serverName = this.extractServerName(toolName);
        const servers = serverName !== "unknown" ? [serverName] : undefined;
        const tools = await this.getToolsWithOptions(servers, options);
        cached = tools.find((entry) => entry.tool.name === toolName);
      } else {
        // Get cached tool entry (includes rawTool reference)
        await this.getToolsInternal();
        cached = this.toolMap.get(toolName);
      }

      if (!cached) {
        log.warn({ toolName }, "mcpManager:toolNotFound");
        return {
          success: false,
          error: { code: "TOOL_NOT_FOUND", message: `Tool '${toolName}' not found` },
          executionTimeMs: Date.now() - startTime,
        };
      }

      log.debug({ toolName }, "mcpManager:callTool:start");

      // Execute with timeout protection
      const result = await withTimeout(
        cached.rawTool.invoke(args),
        TOOL_EXECUTION_TIMEOUT_MS,
        `Tool execution: ${toolName}`
      );

      const executionTimeMs = Date.now() - startTime;
      log.debug({ toolName, executionTimeMs }, "mcpManager:callTool:success");

      return { success: true, result, executionTimeMs };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes("timed out");

      log.error({ err: serializeError(error), toolName, isTimeout }, "mcpManager:callToolFailed");

      return {
        success: false,
        error: {
          code: isTimeout ? "MCP_TIMEOUT" : "TOOL_EXECUTION_ERROR",
          message: error instanceof Error ? error.message : "Tool execution failed",
        },
        executionTimeMs,
      };
    }
  }

  // ===========================================================================
  // RESOURCES
  // ===========================================================================

  /**
   * List all available resources
   */
  async listResources(servers?: string[], options?: MCPRequestOptions): Promise<MCPResource[]> {
    if (!this.client) {
      log.debug({}, "mcpManager:notInitialized");
      return [];
    }

    try {
      const transportOptions = this.buildTransportOptions(options);
      const result = (
        servers && servers.length > 0
          ? transportOptions
            ? await this.client.listResources(servers, transportOptions)
            : await this.client.listResources(servers)
          : transportOptions
            ? await this.client.listResources([], transportOptions)
            : await this.client.listResources()
      ) as Record<string, MCPResource[]>;

      return Object.entries(result).flatMap(([serverName, resources]) =>
        resources.map((resource: MCPResource) => ({
          ...resource,
          serverName,
        }))
      );
    } catch (error) {
      log.error({ err: serializeError(error) }, "mcpManager:listResourcesFailed");
      return [];
    }
  }

  /**
   * List all available resource templates
   */
  async listResourceTemplates(
    servers?: string[],
    options?: MCPRequestOptions
  ): Promise<MCPResourceTemplate[]> {
    if (!this.client) {
      log.debug({}, "mcpManager:notInitialized");
      return [];
    }

    try {
      const transportOptions = this.buildTransportOptions(options);
      const result = (
        servers && servers.length > 0
          ? transportOptions
            ? await this.client.listResourceTemplates(servers, transportOptions)
            : await this.client.listResourceTemplates(servers)
          : transportOptions
            ? await this.client.listResourceTemplates([], transportOptions)
            : await this.client.listResourceTemplates()
      ) as Record<string, MCPResourceTemplate[]>;

      return Object.entries(result).flatMap(([serverName, templates]) =>
        templates.map((template: MCPResourceTemplate) => ({
          ...template,
          serverName,
        }))
      );
    } catch (error) {
      log.error({ err: serializeError(error) }, "mcpManager:listResourceTemplatesFailed");
      return [];
    }
  }

  /**
   * Read a resource from a specific server
   */
  async readResource(
    serverName: string,
    uri: string,
    options?: MCPRequestOptions
  ): Promise<{
    success: boolean;
    contents?: MCPResourceContent[];
    error?: { code: MCPErrorCode; message: string };
    executionTimeMs: number;
  }> {
    const startTime = Date.now();

    if (!this.client) {
      return {
        success: false,
        error: { code: "MCP_NOT_INITIALIZED", message: "MCP manager not initialized" },
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      const transportOptions = this.buildTransportOptions(options);
      const contents = (await withTimeout(
        this.client.readResource(serverName, uri, transportOptions),
        TOOL_EXECUTION_TIMEOUT_MS,
        `Resource read: ${serverName}`
      )) as MCPResourceContent[];

      const executionTimeMs = Date.now() - startTime;
      log.debug({ serverName, executionTimeMs }, "mcpManager:readResource:success");

      return {
        success: true,
        contents: contents.map((content: MCPResourceContent) => ({
          ...content,
          serverName,
        })),
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes("timed out");

      log.error({ err: serializeError(error), serverName, isTimeout }, "mcpManager:readResourceFailed");

      return {
        success: false,
        error: {
          code: isTimeout ? "MCP_TIMEOUT" : "RESOURCE_READ_ERROR",
          message: error instanceof Error ? error.message : "Resource read failed",
        },
        executionTimeMs,
      };
    }
  }

  // ===========================================================================
  // PROMPTS
  // ===========================================================================

  /**
   * List all available prompts
   */
  async listPrompts(servers?: string[], options?: MCPRequestOptions): Promise<MCPPrompt[]> {
    if (!this.client || !this.serverConfig) {
      log.debug({}, "mcpManager:notInitialized");
      return [];
    }

    const transportOptions = this.buildTransportOptions(options);
    const targetServers = servers && servers.length > 0 ? servers : Object.keys(this.serverConfig);

    const results = await Promise.all(
      targetServers.map(async (serverName) => {
        try {
          const client = await this.client!.getClient(serverName, transportOptions);
          if (!client) {
            log.warn({ serverName }, "mcpManager:promptServerNotConnected");
            return [];
          }

          const listResult = await withTimeout(
            client.listPrompts(),
            TOOL_EXECUTION_TIMEOUT_MS,
            `Prompt list: ${serverName}`
          );

          return (listResult.prompts ?? []).map((prompt) => ({
            ...(prompt as MCPPrompt),
            serverName,
          }));
        } catch (error) {
          log.error({ err: serializeError(error), serverName }, "mcpManager:listPromptsFailed");
          return [];
        }
      })
    );

    return results.flat();
  }

  /**
   * Get a prompt from a specific server
   */
  async getPrompt(
    serverName: string,
    name: string,
    args?: Record<string, unknown>,
    options?: MCPRequestOptions
  ): Promise<{
    success: boolean;
    prompt?: MCPPromptResult;
    error?: { code: MCPErrorCode; message: string };
    executionTimeMs: number;
  }> {
    const startTime = Date.now();

    if (!this.client) {
      return {
        success: false,
        error: { code: "MCP_NOT_INITIALIZED", message: "MCP manager not initialized" },
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      const transportOptions = this.buildTransportOptions(options);
      const client = await this.client.getClient(serverName, transportOptions);

      if (!client) {
        return {
          success: false,
          error: { code: "INVALID_REQUEST", message: `Server '${serverName}' not connected` },
          executionTimeMs: Date.now() - startTime,
        };
      }

      const promptResult = await withTimeout(
        client.getPrompt({
          name,
          arguments: args,
        }),
        TOOL_EXECUTION_TIMEOUT_MS,
        `Prompt get: ${serverName}`
      );

      const executionTimeMs = Date.now() - startTime;
      log.debug({ serverName, executionTimeMs }, "mcpManager:getPrompt:success");

      const promptMessages = (promptResult.messages ?? []) as Array<{
        role: "user" | "assistant";
        content: unknown;
      }>;

      return {
        success: true,
        prompt: {
          description: promptResult.description,
          messages: promptMessages.map((message) => ({
            role: message.role,
            content: (Array.isArray(message.content)
              ? message.content
              : [message.content]) as MCPPromptResult["messages"][number]["content"],
          })),
          serverName,
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes("timed out");

      log.error({ err: serializeError(error), serverName, isTimeout }, "mcpManager:getPromptFailed");

      return {
        success: false,
        error: {
          code: isTimeout ? "MCP_TIMEOUT" : "PROMPT_GET_ERROR",
          message: error instanceof Error ? error.message : "Prompt fetch failed",
        },
        executionTimeMs,
      };
    }
  }

  // ===========================================================================
  // STATUS
  // ===========================================================================

  /**
   * Get server status for health checks
   */
  async getServerStatus(): Promise<
    { name: string; status: "connected" | "disconnected" | "error"; toolCount: number }[]
  > {
    if (!this.serverConfig) {
      return [];
    }

    const cached = await this.getToolsInternal();
    const tools = cached.map((c) => c.tool);

    return Object.keys(this.serverConfig).map((name) => {
      const serverTools = tools.filter((t) => t.serverName === name);
      const hasTools = serverTools.length > 0;

      return {
        name,
        // If server is configured but has no tools, it's disconnected
        status: this.client ? (hasTools ? "connected" : "disconnected") : "disconnected",
        toolCount: serverTools.length,
      };
    });
  }

  /**
   * Check if MCP manager is initialized
   */
  isInitialized(): boolean {
    return this.client !== null;
  }

  // ===========================================================================
  // SHUTDOWN
  // ===========================================================================

  /**
   * Close MCP client connections
   */
  async close(): Promise<void> {
    if (this.client && typeof this.client.close === "function") {
      try {
        await this.client.close();
        log.info({}, "mcpManager:closed");
      } catch (error) {
        log.warn({ err: serializeError(error) }, "mcpManager:closeFailed");
      }
    }

    this.client = null;
    this.serverConfig = null;
    this.clearToolCache();
  }
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Singleton instance for backward compatibility
 */
const instance = MCPManager.getInstance();

/**
 * MCP Manager API - convenience export maintaining original interface
 */
export const mcpManager = {
  init: instance.init.bind(instance),
  getTools: instance.getTools.bind(instance),
  getTool: instance.getTool.bind(instance),
  callTool: instance.callTool.bind(instance),
  listResources: instance.listResources.bind(instance),
  listResourceTemplates: instance.listResourceTemplates.bind(instance),
  readResource: instance.readResource.bind(instance),
  listPrompts: instance.listPrompts.bind(instance),
  getPrompt: instance.getPrompt.bind(instance),
  getServerStatus: instance.getServerStatus.bind(instance),
  isInitialized: instance.isInitialized.bind(instance),
  close: instance.close.bind(instance),
};

// Also export convenience functions matching original API
export const initMCPManager = instance.init.bind(instance);
export const getTools = instance.getTools.bind(instance);
export const getTool = instance.getTool.bind(instance);
export const callTool = instance.callTool.bind(instance);
export const listResources = instance.listResources.bind(instance);
export const listResourceTemplates = instance.listResourceTemplates.bind(instance);
export const readResource = instance.readResource.bind(instance);
export const listPrompts = instance.listPrompts.bind(instance);
export const getPrompt = instance.getPrompt.bind(instance);
export const getServerStatus = instance.getServerStatus.bind(instance);
export const isInitialized = instance.isInitialized.bind(instance);
export const closeMCPManager = instance.close.bind(instance);
