/**
 * MCP Service Client
 *
 * HTTP client for apps/api to communicate with apps/mcp service.
 * Includes circuit breaker for fault tolerance and graceful degradation.
 *
 * @module @journey/mcp/client/mcp-service-client
 */

import { createLogger, serializeError } from "@journey/logger";
import { createCircuitBreaker } from "@journey/infra/circuit-breaker";
import type {
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPRequestOptions,
  MCPResource,
  MCPResourceTemplate,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptResult,
  MCPHealthStatus,
  MCPServiceClientOptions,
  MCPErrorCode,
} from "../types";

const log = createLogger("mcp-client");

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate that a tools response has expected structure
 */
function isValidToolsResponse(data: unknown): data is { tools: MCPTool[]; count: number } {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.tools) && typeof obj.count === "number";
}

/**
 * Validate that a tool call response has expected structure
 */
function isValidToolCallResponse(data: unknown): data is MCPToolCallResponse {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.success === "boolean" && typeof obj.executionTimeMs === "number";
}

/**
 * Validate that a resources list response has expected structure
 */
function isValidResourcesResponse(data: unknown): data is { resources: MCPResource[]; count: number } {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.resources) && typeof obj.count === "number";
}

/**
 * Validate that a resource templates list response has expected structure
 */
function isValidResourceTemplatesResponse(data: unknown): data is { templates: MCPResourceTemplate[]; count: number } {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.templates) && typeof obj.count === "number";
}

/**
 * Validate that a prompts list response has expected structure
 */
function isValidPromptsResponse(data: unknown): data is { prompts: MCPPrompt[]; count: number } {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.prompts) && typeof obj.count === "number";
}

/**
 * Validate that a resource read response has expected structure
 */
function isValidResourceReadResponse(
  data: unknown
): data is { success: boolean; executionTimeMs: number; contents?: MCPResourceContent[] } {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.success === "boolean" && typeof obj.executionTimeMs === "number";
}

/**
 * Validate that a prompt get response has expected structure
 */
function isValidPromptGetResponse(
  data: unknown
): data is { success: boolean; executionTimeMs: number; prompt?: MCPPromptResult } {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.success === "boolean" && typeof obj.executionTimeMs === "number";
}

/**
 * Validate that a health response has expected structure
 */
function isValidHealthResponse(data: unknown): data is MCPHealthStatus {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.status === "string" &&
    Array.isArray(obj.servers) &&
    typeof obj.timestamp === "string"
  );
}

/**
 * Create an error response with timing
 */
function createErrorResponse(
  code: MCPErrorCode,
  message: string,
  executionTimeMs: number
): MCPToolCallResponse {
  return { success: false, error: { code, message }, executionTimeMs };
}

// =============================================================================
// MCP SERVICE CLIENT
// =============================================================================

/**
 * MCP Service Client
 *
 * Provides fault-tolerant HTTP communication with the standalone MCP service.
 *
 * @example
 * ```typescript
 * const client = new MCPServiceClient({
 *   baseUrl: "http://localhost:3002",
 *   timeout: 30000,
 * });
 *
 * const tools = await client.getTools();
 * const result = await client.callTool({ toolName: "fetch_fetch", args: { url: "..." } });
 * ```
 */
export class MCPServiceClient {
  private baseUrl: string;
  private timeout: number;
  private protectedFetch: (url: string, init?: RequestInit) => Promise<Response>;

  constructor(options: MCPServiceClientOptions) {
    // Validate URL format
    try {
      new URL(options.baseUrl);
    } catch {
      throw new Error(`Invalid MCP service URL: ${options.baseUrl}`);
    }

    this.baseUrl = options.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.timeout = options.timeout ?? 30000;

    // Setup fetch with optional circuit breaker
    const rawFetch = this.createFetchWithTimeout();

    if (options.circuitBreakerEnabled !== false) {
      this.protectedFetch = createCircuitBreaker(rawFetch, {
        name: "mcp-service",
        serviceType: "mcp",
        timeout: this.timeout,
        errorThresholdPercentage: options.circuitBreaker?.errorThresholdPercentage ?? 50,
        resetTimeout: options.circuitBreaker?.resetTimeout ?? 30000,
      });
    } else {
      this.protectedFetch = rawFetch;
    }

    log.debug({ baseUrl: this.baseUrl, timeout: this.timeout }, "mcpClient:created");
  }

  /**
   * Create a fetch function with timeout handling
   *
   * @param timeoutMs - Timeout in milliseconds (uses client default if not specified)
   */
  private createFetchWithTimeout(timeoutMs?: number): (url: string, init?: RequestInit) => Promise<Response> {
    const timeout = timeoutMs ?? this.timeout;
    return async (url: string, init?: RequestInit): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    };
  }

  /**
   * Get available tools from MCP service
   *
   * @returns Array of tools (empty array on failure for graceful degradation)
   */
  async getTools(options?: MCPRequestOptions, servers?: string[]): Promise<MCPTool[]> {
    try {
      const usePost = !!options || (servers !== undefined && servers.length > 0);
      const response = usePost
        ? await this.protectedFetch(`${this.baseUrl}/tools/list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              servers: servers && servers.length > 0 ? servers : undefined,
              options,
            }),
          })
        : await this.protectedFetch(`${this.baseUrl}/tools`);

      if (!response.ok) {
        log.warn({ status: response.status }, "mcpClient:getTools:httpError");
        return [];
      }

      const data: unknown = await response.json();

      if (!isValidToolsResponse(data)) {
        log.warn({ data }, "mcpClient:getTools:invalidResponse");
        return [];
      }

      log.debug({ toolCount: data.count }, "mcpClient:getTools:success");
      return data.tools;
    } catch (error) {
      log.warn({ err: serializeError(error) }, "mcpClient:getTools:failed");
      return [];
    }
  }

  /**
   * Execute a tool on MCP service
   *
   * @param request - Tool name and arguments (supports per-request timeout in options)
   * @returns Response with result or error (never throws)
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    const startTime = Date.now();
    const requestTimeout = request.options?.timeout ?? this.timeout;

    // If per-request timeout is specified, use a custom fetch with that timeout
    const fetchFn = request.options?.timeout
      ? this.createFetchWithTimeout(requestTimeout)
      : this.protectedFetch;

    try {
      const response = await fetchFn(`${this.baseUrl}/tools/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const executionTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        log.warn(
          { toolName: request.toolName, status: response.status },
          "mcpClient:callTool:httpError"
        );
        // Safely extract message - validate it's actually a string
        const message =
          typeof errorData.message === "string" ? errorData.message : `HTTP ${response.status}`;
        return createErrorResponse("MCP_HTTP_ERROR", message, executionTimeMs);
      }

      const data: unknown = await response.json();

      if (!isValidToolCallResponse(data)) {
        log.warn({ toolName: request.toolName }, "mcpClient:callTool:invalidResponse");
        return createErrorResponse("MCP_HTTP_ERROR", "Invalid response from MCP service", executionTimeMs);
      }

      log.debug(
        { toolName: request.toolName, success: data.success, ms: data.executionTimeMs },
        "mcpClient:callTool:complete"
      );
      return data;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.name === "AbortError";

      log.error({ err: serializeError(error), toolName: request.toolName }, "mcpClient:callTool:failed");

      return createErrorResponse(
        isTimeout ? "MCP_TIMEOUT" : "MCP_UNAVAILABLE",
        error instanceof Error ? error.message : "MCP service unavailable",
        executionTimeMs
      );
    }
  }

  /**
   * List available resources from MCP service
   */
  async listResources(options?: MCPRequestOptions, servers?: string[]): Promise<MCPResource[]> {
    try {
      const usePost = !!options || (servers !== undefined && servers.length > 0);
      const response = usePost
        ? await this.protectedFetch(`${this.baseUrl}/resources/list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              servers: servers && servers.length > 0 ? servers : undefined,
              options,
            }),
          })
        : await this.protectedFetch(`${this.baseUrl}/resources`);

      if (!response.ok) {
        log.warn({ status: response.status }, "mcpClient:listResources:httpError");
        return [];
      }

      const data: unknown = await response.json();
      if (!isValidResourcesResponse(data)) {
        log.warn({ data }, "mcpClient:listResources:invalidResponse");
        return [];
      }

      log.debug({ resourceCount: data.count }, "mcpClient:listResources:success");
      return data.resources;
    } catch (error) {
      log.warn({ err: serializeError(error) }, "mcpClient:listResources:failed");
      return [];
    }
  }

  /**
   * List available resource templates from MCP service
   */
  async listResourceTemplates(options?: MCPRequestOptions, servers?: string[]): Promise<MCPResourceTemplate[]> {
    try {
      const usePost = !!options || (servers !== undefined && servers.length > 0);
      const response = usePost
        ? await this.protectedFetch(`${this.baseUrl}/resource-templates/list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              servers: servers && servers.length > 0 ? servers : undefined,
              options,
            }),
          })
        : await this.protectedFetch(`${this.baseUrl}/resource-templates`);

      if (!response.ok) {
        log.warn({ status: response.status }, "mcpClient:listResourceTemplates:httpError");
        return [];
      }

      const data: unknown = await response.json();
      if (!isValidResourceTemplatesResponse(data)) {
        log.warn({ data }, "mcpClient:listResourceTemplates:invalidResponse");
        return [];
      }

      log.debug({ templateCount: data.count }, "mcpClient:listResourceTemplates:success");
      return data.templates;
    } catch (error) {
      log.warn({ err: serializeError(error) }, "mcpClient:listResourceTemplates:failed");
      return [];
    }
  }

  /**
   * Read a resource from MCP service
   */
  async readResource(
    serverName: string,
    uri: string,
    options?: MCPRequestOptions
  ): Promise<MCPResourceContent[]> {
    const startTime = Date.now();

    try {
      const response = await this.protectedFetch(`${this.baseUrl}/resources/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverName, uri, options }),
      });

      if (!response.ok) {
        log.warn({ status: response.status, serverName }, "mcpClient:readResource:httpError");
        return [];
      }

      const data: unknown = await response.json();
      if (!isValidResourceReadResponse(data)) {
        log.warn({ serverName }, "mcpClient:readResource:invalidResponse");
        return [];
      }

      if (!data.success) {
        log.warn({ serverName }, "mcpClient:readResource:failed");
        return [];
      }

      log.debug(
        { serverName, ms: data.executionTimeMs },
        "mcpClient:readResource:success"
      );
      return data.contents ?? [];
    } catch (error) {
      log.warn(
        { err: serializeError(error), serverName, ms: Date.now() - startTime },
        "mcpClient:readResource:failed"
      );
      return [];
    }
  }

  /**
   * List available prompts from MCP service
   */
  async listPrompts(options?: MCPRequestOptions, servers?: string[]): Promise<MCPPrompt[]> {
    try {
      const usePost = !!options || (servers !== undefined && servers.length > 0);
      const response = usePost
        ? await this.protectedFetch(`${this.baseUrl}/prompts/list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              servers: servers && servers.length > 0 ? servers : undefined,
              options,
            }),
          })
        : await this.protectedFetch(`${this.baseUrl}/prompts`);

      if (!response.ok) {
        log.warn({ status: response.status }, "mcpClient:listPrompts:httpError");
        return [];
      }

      const data: unknown = await response.json();
      if (!isValidPromptsResponse(data)) {
        log.warn({ data }, "mcpClient:listPrompts:invalidResponse");
        return [];
      }

      log.debug({ promptCount: data.count }, "mcpClient:listPrompts:success");
      return data.prompts;
    } catch (error) {
      log.warn({ err: serializeError(error) }, "mcpClient:listPrompts:failed");
      return [];
    }
  }

  /**
   * Execute a prompt on MCP service
   */
  async getPrompt(
    serverName: string,
    name: string,
    args?: Record<string, unknown>,
    options?: MCPRequestOptions
  ): Promise<MCPPromptResult | null> {
    const startTime = Date.now();

    try {
      const response = await this.protectedFetch(`${this.baseUrl}/prompts/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverName, name, args, options }),
      });

      if (!response.ok) {
        log.warn({ status: response.status, serverName }, "mcpClient:getPrompt:httpError");
        return null;
      }

      const data: unknown = await response.json();
      if (!isValidPromptGetResponse(data)) {
        log.warn({ serverName }, "mcpClient:getPrompt:invalidResponse");
        return null;
      }

      if (!data.success) {
        log.warn({ serverName }, "mcpClient:getPrompt:failed");
        return null;
      }

      log.debug(
        { serverName, ms: data.executionTimeMs },
        "mcpClient:getPrompt:success"
      );
      return data.prompt ?? null;
    } catch (error) {
      log.warn(
        { err: serializeError(error), serverName, ms: Date.now() - startTime },
        "mcpClient:getPrompt:failed"
      );
      return null;
    }
  }

  /**
   * Check MCP service health
   *
   * @returns Health status or null if unavailable
   */
  async getHealth(): Promise<MCPHealthStatus | null> {
    try {
      const response = await this.protectedFetch(`${this.baseUrl}/health`);

      if (!response.ok) return null;

      const data: unknown = await response.json();

      if (!isValidHealthResponse(data)) {
        log.warn({}, "mcpClient:getHealth:invalidResponse");
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Check if MCP service is available
   *
   * @returns true if service is healthy or degraded
   */
  async isAvailable(): Promise<boolean> {
    const health = await this.getHealth();
    return health !== null && health.status !== "unhealthy";
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: MCPServiceClient | null = null;

/**
 * Get the MCP service client singleton
 *
 * @returns Client instance or null if not initialized
 *
 * @example
 * ```typescript
 * const client = getMCPServiceClient();
 * if (client) {
 *   const tools = await client.getTools();
 * }
 * ```
 */
export function getMCPServiceClient(): MCPServiceClient | null {
  return instance;
}

/**
 * Initialize the MCP service client singleton
 *
 * Call once during app startup. Subsequent calls return existing instance.
 *
 * @param options - Client configuration
 * @returns Initialized client instance
 *
 * @example
 * ```typescript
 * // In app initialization
 * initMCPServiceClient({
 *   baseUrl: process.env.MCP_SERVICE_URL || "http://localhost:3002",
 *   timeout: 30000,
 * });
 * ```
 */
export function initMCPServiceClient(options: MCPServiceClientOptions): MCPServiceClient {
  if (instance) {
    log.warn({}, "mcpClient:alreadyInitialized");
    return instance;
  }

  instance = new MCPServiceClient(options);
  log.info({ baseUrl: options.baseUrl }, "mcpClient:initialized");
  return instance;
}

/**
 * Reset the singleton (for testing only)
 */
export function resetMCPServiceClient(): void {
  instance = null;
}
