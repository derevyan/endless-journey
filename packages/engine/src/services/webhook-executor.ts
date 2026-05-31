/**
 * Webhook Executor Service
 *
 * Handles HTTP requests for webhook nodes including:
 * - Real HTTP requests with timeout and retry
 * - Mock responses for testing
 * - Template variable substitution
 * - JSONPath extraction from responses
 * - Authentication header generation
 * - Per-domain circuit breakers for resilience
 */

import type { HttpRetryConfig, WebhookNodeData } from "@journey/schemas";
import type { TemplateService, WebhookExecutorService, HttpRequestConfig, HttpResponseData } from "../types";
import { extractJsonPath, maskUrl, sleep } from "../utils";
import { createCircuitBreaker, CircuitOpenError } from "@journey/infra";
import { validateWebhookUrl } from "./url-validator";

/**
 * Default maximum response size in bytes (1MB)
 * Prevents OOM from malicious or misconfigured endpoints returning large responses
 */
const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;

/**
 * Default maximum number of circuit breakers per domain
 */
const DEFAULT_MAX_CIRCUIT_BREAKERS = 100;

/**
 * Apply jitter to a delay to prevent thundering herd on retry
 * Adds ±20% random variation to the base delay
 *
 * @param delay - Base delay in milliseconds
 * @param factor - Jitter factor (0.2 = ±20%)
 * @returns Jittered delay in milliseconds
 */
function applyJitter(delay: number, factor: number = 0.2): number {
  // Random value between -factor and +factor
  const jitter = delay * factor * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(delay + jitter));
}

/**
 * Read response body with size limit to prevent OOM attacks
 *
 * @param response - Fetch Response object
 * @param maxBytes - Maximum allowed response size in bytes
 * @returns Response body as string
 * @throws Error if response exceeds size limit
 */
async function readResponseWithLimit(response: Response, maxBytes: number): Promise<string> {
  // If no body, return empty string
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > maxBytes) {
        // Cancel the stream to free resources
        await reader.cancel();
        throw new Error(`Response size exceeds limit of ${maxBytes} bytes (received at least ${totalSize} bytes)`);
      }
      chunks.push(value);
    }
  } finally {
    // Ensure reader is released even on error
    reader.releaseLock();
  }

  // Concatenate chunks and decode as UTF-8
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(combined);
}

/**
 * Parse response body with JSON fallback.
 *
 * Attempts JSON parse first; falls back to text wrapper for non-JSON responses.
 */
async function parseResponseBody(
  response: Response,
  maxBytes: number,
  onWarn?: (message: string, data: Record<string, unknown>) => void
): Promise<unknown> {
  const text = await readResponseWithLimit(response, maxBytes);
  const contentType = response.headers?.get?.("content-type") || "";
  const isExplicitJson = contentType.includes("application/json");

  try {
    return JSON.parse(text);
  } catch (parseError) {
    if (isExplicitJson) {
      throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    onWarn?.("webhook:nonJsonResponse", { contentType, textLength: text.length });
    return { text };
  }
}

/**
 * Circuit breaker entry with LRU tracking
 */
interface CircuitBreakerEntry {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  lastUsed: number;
}

/**
 * Maximum number of circuit breakers to keep in memory
 * Configurable via WebhookExecutorOptions.maxCircuitBreakers
 */
let maxCircuitBreakers = DEFAULT_MAX_CIRCUIT_BREAKERS;

/**
 * Per-domain circuit breaker registry with LRU eviction
 *
 * Isolates failures by domain - if api.example.com is failing,
 * it won't affect requests to api.other.com
 *
 * Uses LRU eviction to prevent unbounded memory growth
 */
const domainCircuitBreakers = new Map<string, CircuitBreakerEntry>();

/**
 * Evict least recently used circuit breaker if at capacity
 */
function evictLRUCircuitBreaker(): void {
  if (domainCircuitBreakers.size < maxCircuitBreakers) return;

  let oldestDomain: string | null = null;
  let oldestTime = Infinity;

  for (const [domain, entry] of domainCircuitBreakers) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestDomain = domain;
    }
  }

  if (oldestDomain) {
    domainCircuitBreakers.delete(oldestDomain);
  }
}

/**
 * Get or create a circuit-protected fetch function for a domain
 */
function getProtectedFetch(domain: string): (url: string, init?: RequestInit) => Promise<Response> {
  let entry = domainCircuitBreakers.get(domain);

  if (entry) {
    // Update last used time (LRU tracking)
    entry.lastUsed = Date.now();
    return entry.fetch;
  }

  // Evict LRU entry if at capacity before creating new one
  evictLRUCircuitBreaker();

  const protectedFetch = createCircuitBreaker(
    async (url: string, init?: RequestInit): Promise<Response> => fetch(url, init),
    {
      name: `webhook-${domain}`,
      serviceType: "webhook",
    }
  );

  domainCircuitBreakers.set(domain, {
    fetch: protectedFetch,
    lastUsed: Date.now(),
  });

  return protectedFetch;
}

/** Options for creating a webhook executor */
export interface WebhookExecutorOptions {
  /** Template service for variable substitution */
  template: TemplateService;

  /** Optional logger for debugging */
  onDebug?: (message: string, data: Record<string, unknown>) => void;

  /** Optional info logger */
  onInfo?: (message: string, data: Record<string, unknown>) => void;

  /** Optional warning logger */
  onWarn?: (message: string, data: Record<string, unknown>) => void;

  /**
   * Maximum number of circuit breakers to keep in memory (per domain).
   * Uses LRU eviction when limit is reached.
   * Default: 100
   */
  maxCircuitBreakers?: number;

  /**
   * Default maximum response size in bytes.
   * Can be overridden per-webhook via webhookData.maxResponseBytes.
   * Default: 1MB (1,048,576 bytes)
   */
  defaultMaxResponseBytes?: number;
}

/**
 * Create a webhook executor service
 *
 * @param options - Service configuration
 * @returns WebhookExecutorService implementation
 */
export function createWebhookExecutor(options: WebhookExecutorOptions): WebhookExecutorService {
  const { template, onDebug, onInfo, onWarn } = options;

  // Configure circuit breaker limit (affects global state - intentional for memory management)
  if (options.maxCircuitBreakers !== undefined) {
    maxCircuitBreakers = options.maxCircuitBreakers;
  }

  // Store default max response bytes for this executor instance
  const defaultMaxResponseBytes = options.defaultMaxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;

  /**
   * Prepare HTTP headers for webhook request
   */
  function prepareHeaders(webhookData: WebhookNodeData, context: Record<string, unknown>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add custom headers with template substitution
    if (webhookData.headers) {
      for (const [key, value] of Object.entries(webhookData.headers)) {
        headers[key] = template.substitute(value, context);
      }
    }

    // Add authentication headers
    if (webhookData.auth) {
      switch (webhookData.auth.type) {
        case "bearer":
          if (webhookData.auth.token) {
            headers["Authorization"] = `Bearer ${template.substitute(webhookData.auth.token, context)}`;
          }
          break;
        case "basic":
          if (webhookData.auth.username && webhookData.auth.password) {
            // Apply template substitution to username and password (consistent with bearer/apiKey)
            const username = template.substitute(webhookData.auth.username, context);
            const password = template.substitute(webhookData.auth.password, context);
            // Use Buffer instead of btoa() to properly handle UTF-8 characters in credentials
            const credentials = Buffer.from(`${username}:${password}`).toString("base64");
            headers["Authorization"] = `Basic ${credentials}`;
          }
          break;
        case "apiKey":
          if (webhookData.auth.headerName && webhookData.auth.apiKey) {
            headers[webhookData.auth.headerName] = template.substitute(webhookData.auth.apiKey, context);
          }
          break;
      }
    }

    return headers;
  }

  /**
   * Prepare generic HTTP headers with template substitution.
   */
  function prepareRequestHeaders(
    headers: Record<string, string> | undefined,
    context: Record<string, unknown>
  ): Record<string, string> {
    const resolved: Record<string, string> = {};
    if (!headers) return resolved;

    for (const [key, value] of Object.entries(headers)) {
      resolved[key] = template.substitute(value, context);
    }

    return resolved;
  }

  /**
   * Execute mock response
   */
  async function executeMock(webhookData: WebhookNodeData): Promise<unknown> {
    const mockResponse = webhookData.mockResponse;

    // Validate mockResponse exists (should be checked before calling but be defensive)
    if (!mockResponse) {
      throw new Error("Mock response not configured");
    }

    onInfo?.("webhook:usingMock", { mockEnabled: true });

    // Simulate delay if configured (uses scaled sleep for testing)
    if (mockResponse.delay && mockResponse.delay > 0) {
      await sleep(mockResponse.delay);
    }

    // Simulate error status codes
    const statusCode = mockResponse.statusCode || 200;
    if (statusCode >= 400) {
      throw new Error(`Mock HTTP error: ${statusCode}`);
    }

    // Return mock body, applying JSONPath extraction if configured
    const mockBody = mockResponse.body;
    if (webhookData.successPath && mockBody) {
      return extractJsonPath(mockBody, webhookData.successPath);
    }
    return mockBody;
  }

  /**
   * Execute real HTTP request with retries and circuit breaker protection
   */
  async function executeReal(webhookData: WebhookNodeData, context: Record<string, unknown>): Promise<unknown> {
    const url = template.substitute(webhookData.url, context);
    const headers = prepareHeaders(webhookData, context);
    const body = webhookData.body ? template.substitute(webhookData.body, context) : undefined;

    // Extract domain for per-domain circuit breaker
    let domain: string;
    try {
      domain = new URL(url).hostname;
    } catch {
      throw new Error(`Invalid webhook URL: ${url}`);
    }

    // SSRF protection: validate URL before making request
    // Blocks private IPs, localhost, cloud metadata endpoints, etc.
    validateWebhookUrl(url);

    // Get circuit-protected fetch for this domain
    const protectedFetch = getProtectedFetch(domain);

    onInfo?.("webhook:request", {
      url: maskUrl(url),
      method: webhookData.method,
      hasBody: !!body,
      timeout: webhookData.timeoutMs,
    });

    const maxRetries = webhookData.retryCount || 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhookData.timeoutMs || 30000);

      try {
        const response = await protectedFetch(url, {
          method: webhookData.method,
          headers,
          body: webhookData.method !== "GET" ? body : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Read response with size limit to prevent OOM from large responses
        // Use per-webhook limit if configured, otherwise use default
        const maxBytes = (webhookData as { maxResponseBytes?: number }).maxResponseBytes ?? defaultMaxResponseBytes;
        const contentType = response.headers?.get?.("content-type") || "";
        const responseData = await parseResponseBody(response, maxBytes, onWarn);

        onDebug?.("webhook:response", { status: response.status, attempt, contentType });

        // Extract using JSONPath if configured
        if (webhookData.successPath) {
          return extractJsonPath(responseData, webhookData.successPath);
        }

        return responseData;
      } catch (error) {
        // Circuit breaker is open - fail immediately without retry
        if (error instanceof CircuitOpenError) {
          onWarn?.("webhook:circuitOpen", {
            domain,
            error: error.message,
          });
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        onWarn?.("webhook:attempt:failed", {
          attempt,
          maxRetries,
          error: lastError.message,
        });

        // If retry is configured and we haven't exhausted retries, wait and try again
        if (attempt < maxRetries && webhookData.errorHandling === "retry") {
          // Exponential backoff with jitter to prevent thundering herd
          const baseDelay = 1000 * (attempt + 1);
          await sleep(applyJitter(baseDelay));
        }
      } finally {
        // Always clear timeout to prevent memory leaks
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error("Webhook request failed");
  }

  /**
   * Execute a generic HTTP request with retries and circuit breaker protection.
   */
  async function executeRequest(
    request: HttpRequestConfig,
    context: Record<string, unknown>,
    retryConfig?: HttpRetryConfig
  ): Promise<HttpResponseData> {
    const url = template.substitute(request.url, context);
    const method = request.method.toUpperCase();
    const headers = prepareRequestHeaders(request.headers, context);
    const body = request.body ? template.substitute(request.body, context) : undefined;

    // Extract domain for per-domain circuit breaker
    let domain: string;
    try {
      domain = new URL(url).hostname;
    } catch {
      throw new Error(`Invalid webhook URL: ${url}`);
    }

    // SSRF protection: validate URL before making request
    validateWebhookUrl(url);

    const protectedFetch = getProtectedFetch(domain);

    onInfo?.("http:request", {
      url: maskUrl(url),
      method,
      hasBody: !!body,
      timeout: request.timeoutMs,
    });

    const maxRetries = retryConfig?.maxRetries ?? 0;
    const backoffMs = retryConfig?.backoffMs ?? 1000;
    const retryOn = retryConfig?.retryOn ?? [];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs || 30000);

      try {
        const response = await protectedFetch(url, {
          method,
          headers,
          body: method !== "GET" ? body : undefined,
          signal: controller.signal,
        });

        const statusCode = response.status;
        const contentType = response.headers?.get?.("content-type") || "";
        const shouldRetryStatus = !response.ok && retryOn.includes(statusCode);

        if (!response.ok) {
          if (shouldRetryStatus && attempt < maxRetries) {
            onWarn?.("http:retryableStatus", { statusCode, attempt, maxRetries });
            await sleep(applyJitter(backoffMs * (attempt + 1)));
            continue;
          }
          throw new Error(`HTTP ${statusCode}: ${response.statusText}`);
        }

        const maxBytes = request.maxResponseBytes ?? defaultMaxResponseBytes;
        const responseData = await parseResponseBody(response, maxBytes, onWarn);

        onDebug?.("http:response", { status: statusCode, attempt, contentType });

        const responseHeaders: Record<string, string> = {};
        response.headers?.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        return {
          statusCode,
          body: responseData,
          headers: responseHeaders,
        };
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          onWarn?.("http:circuitOpen", {
            domain,
            error: error.message,
          });
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        onWarn?.("http:attempt:failed", {
          attempt,
          maxRetries,
          error: lastError.message,
        });

        if (attempt < maxRetries) {
          await sleep(applyJitter(backoffMs * (attempt + 1)));
          continue;
        }

        throw lastError;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error("HTTP request failed");
  }

  return {
    async execute(webhookData: WebhookNodeData, context: Record<string, unknown>): Promise<unknown> {
      // Check if mock response is enabled
      if (webhookData.mockResponse?.enabled) {
        return executeMock(webhookData);
      }

      // Execute real HTTP request
      return executeReal(webhookData, context);
    },
    executeRequest,
  };
}
