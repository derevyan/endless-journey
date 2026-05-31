import type { WebhookNodeData } from "@journey/schemas";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createWebhookExecutor } from "../services/webhook-executor";
import type { TemplateService } from "../types";

/**
 * Helper to create a mock fetch Response with streaming body support
 */
function createMockResponse(data: unknown, options: { ok?: boolean; status?: number; statusText?: string } = {}) {
  const body = JSON.stringify(data);
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? "OK",
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
    },
    body: {
      getReader: () => {
        let sent = false;
        return {
          read: () => {
            if (!sent) {
              sent = true;
              return Promise.resolve({
                done: false,
                value: new TextEncoder().encode(body),
              });
            }
            return Promise.resolve({ done: true, value: undefined });
          },
          cancel: vi.fn(),
          releaseLock: vi.fn(),
        };
      },
    },
  };
}

describe("WebhookExecutor", () => {
  let mockTemplate: TemplateService;
  let onDebug: ReturnType<typeof vi.fn>;
  let onInfo: ReturnType<typeof vi.fn>;
  let onWarn: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    mockTemplate = {
      substitute: vi.fn((template) => template),
    };
    onDebug = vi.fn();
    onInfo = vi.fn();
    onWarn = vi.fn();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("Mock Response Execution", () => {
    it("should execute mock response with delay", async () => {
      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        mockResponse: {
          enabled: true,
          statusCode: 200,
          body: { success: true, data: "test" },
          delay: 10,
        },
      };

      const startTime = Date.now();
      const result = await executor.execute(webhookData, {});
      const elapsed = Date.now() - startTime;

      expect(result).toEqual({ success: true, data: "test" });
      // Allow 2ms tolerance for timer precision (setTimeout isn't perfectly accurate)
      expect(elapsed).toBeGreaterThanOrEqual(8);
      expect(onInfo).toHaveBeenCalledWith("webhook:usingMock", { mockEnabled: true });
    });

    it("should execute mock response without delay", async () => {
      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        mockResponse: {
          enabled: true,
          statusCode: 200,
          delay: 0,
          body: { message: "Hello" },
        },
      };

      const result = await executor.execute(webhookData, {});

      expect(result).toEqual({ message: "Hello" });
    });

    it("should throw error for mock response with error status codes (400+)", async () => {
      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        mockResponse: {
          enabled: true,
          statusCode: 500,
          delay: 0,
          body: { error: "Internal Server Error" },
        },
      };

      await expect(executor.execute(webhookData, {})).rejects.toThrow("Mock HTTP error: 500");
    });

    it("should throw error for 400 status code", async () => {
      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "POST",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        mockResponse: {
          enabled: true,
          statusCode: 400,
          delay: 0,
          body: { error: "Bad Request" },
        },
      };

      await expect(executor.execute(webhookData, {})).rejects.toThrow("Mock HTTP error: 400");
    });

    it("should apply JSONPath extraction to mock response", async () => {
      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        successPath: "$.data.name",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        mockResponse: {
          enabled: true,
          statusCode: 200,
          delay: 0,
          body: { data: { name: "John Doe", age: 30 } },
        },
      };

      const result = await executor.execute(webhookData, {});

      expect(result).toBe("John Doe");
    });
  });

  describe("Authentication Headers", () => {
    it("should add bearer token authentication header", async () => {
      let capturedHeaders: Record<string, string> | undefined;
      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        capturedHeaders = options?.headers as Record<string, string>;
        return Promise.resolve(createMockResponse({ success: true }));
      });

      mockTemplate.substitute = vi.fn((template) => {
        if (template === "my-secret-token") return "my-secret-token";
        return template;
      });

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        auth: {
          type: "bearer",
          token: "my-secret-token",
        },
      };

      await executor.execute(webhookData, {});

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders!["Authorization"]).toBe("Bearer my-secret-token");
    });

    it("should add basic authentication header", async () => {
      let capturedHeaders: Record<string, string> | undefined;
      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        capturedHeaders = options?.headers as Record<string, string>;
        return Promise.resolve(createMockResponse({ success: true }));
      });

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        auth: {
          type: "basic",
          username: "user",
          password: "pass",
        },
      };

      await executor.execute(webhookData, {});

      expect(capturedHeaders).toBeDefined();
      // btoa("user:pass") = "dXNlcjpwYXNz"
      expect(capturedHeaders!["Authorization"]).toBe("Basic dXNlcjpwYXNz");
    });

    it("should add API key authentication header", async () => {
      let capturedHeaders: Record<string, string> | undefined;
      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        capturedHeaders = options?.headers as Record<string, string>;
        return Promise.resolve(createMockResponse({ success: true }));
      });

      mockTemplate.substitute = vi.fn((template) => template);

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        auth: {
          type: "apiKey",
          headerName: "X-API-Key",
          apiKey: "secret-api-key",
        },
      };

      await executor.execute(webhookData, {});

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders!["X-API-Key"]).toBe("secret-api-key");
    });
  });

  describe("Custom Headers with Template Substitution", () => {
    it("should substitute variables in custom headers", async () => {
      let capturedHeaders: Record<string, string> | undefined;
      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        capturedHeaders = options?.headers as Record<string, string>;
        return Promise.resolve(createMockResponse({ success: true }));
      });

      mockTemplate.substitute = vi.fn((template, context) => {
        if (template === "{{userId}}") return (context as Record<string, unknown>).userId as string;
        if (template === "{{sessionId}}") return (context as Record<string, unknown>).sessionId as string;
        return template;
      });

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
        headers: {
          "X-User-Id": "{{userId}}",
          "X-Session-Id": "{{sessionId}}",
        },
      };

      await executor.execute(webhookData, { userId: "user-123", sessionId: "session-456" });

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders!["X-User-Id"]).toBe("user-123");
      expect(capturedHeaders!["X-Session-Id"]).toBe("session-456");
    });
  });

  describe("Retry Logic", () => {
    it("should retry on failure with exponential backoff", async () => {
      let attemptCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve(createMockResponse({ success: true }));
      });

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "retry",
        retryCount: 3,
        timeoutMs: 5000,
      };

      const result = await executor.execute(webhookData, {});

      expect(result).toEqual({ success: true });
      expect(attemptCount).toBe(3);
      expect(onWarn).toHaveBeenCalledTimes(2); // Two failures before success
    });

    it("should throw after exhausting retries", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "retry",
        retryCount: 2,
        timeoutMs: 5000,
      };

      await expect(executor.execute(webhookData, {})).rejects.toThrow("Network error");
      expect(globalThis.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe("JSONPath Extraction from Response", () => {
    it("should extract nested value using JSONPath", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          data: {
            users: [
              { id: 1, name: "John" },
              { id: 2, name: "Jane" },
            ],
          },
        })
      );

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        successPath: "$.data.users[0].name",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      const result = await executor.execute(webhookData, {});

      expect(result).toBe("John");
    });

    it("should return full response when no successPath", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse({ data: { name: "John" } }));

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      const result = await executor.execute(webhookData, {});

      expect(result).toEqual({ data: { name: "John" } });
    });
  });

  describe("HTTP Error Handling", () => {
    it("should throw error for non-OK response status", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({}, { ok: false, status: 404, statusText: "Not Found" })
      );

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      await expect(executor.execute(webhookData, {})).rejects.toThrow("HTTP 404: Not Found");
    });
  });

  describe("Request Body Handling", () => {
    it("should include body for POST requests", async () => {
      let capturedBody: string | undefined;
      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        capturedBody = options?.body as string;
        return Promise.resolve(createMockResponse({ success: true }));
      });

      mockTemplate.substitute = vi.fn((template) => template);

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "POST",
        body: '{"action": "create"}',
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      await executor.execute(webhookData, {});

      expect(capturedBody).toBe('{"action": "create"}');
    });

    it("should not include body for GET requests", async () => {
      let capturedBody: string | undefined;
      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        capturedBody = options?.body as string;
        return Promise.resolve(createMockResponse({ success: true }));
      });

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        body: '{"action": "create"}', // Should be ignored for GET
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      await executor.execute(webhookData, {});

      expect(capturedBody).toBeUndefined();
    });
  });

  describe("URL Template Substitution", () => {
    it("should substitute variables in URL", async () => {
      let capturedUrl: string | undefined;
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        capturedUrl = url as string;
        return Promise.resolve(createMockResponse({ success: true }));
      });

      mockTemplate.substitute = vi.fn((template, context) => {
        return template.replace("{{userId}}", (context as Record<string, unknown>).userId as string);
      });

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/users/{{userId}}",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      await executor.execute(webhookData, { userId: "user-123" });

      expect(capturedUrl).toBe("https://api.example.com/users/user-123");
    });
  });

  describe("Timeout Handling", () => {
    it("should abort request after timeout", async () => {
      // Mock fetch that takes longer than timeout
      globalThis.fetch = vi.fn().mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            // Listen for abort signal
            const signal = options?.signal as AbortSignal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted", "AbortError"));
              });
            }
            // Never resolve - will be aborted by timeout
          })
      );

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/slow",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 50, // Very short timeout for fast test
      };

      await expect(executor.execute(webhookData, {})).rejects.toThrow(/abort/i);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("should use default timeout when not specified", async () => {
      let capturedSignal: AbortSignal | undefined;
      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        capturedSignal = options?.signal as AbortSignal;
        return Promise.resolve(createMockResponse({ success: true }));
      });

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/data",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 30000, // Default timeout
      };

      await executor.execute(webhookData, {});

      expect(capturedSignal).toBeDefined();
      expect(capturedSignal!.aborted).toBe(false);
    });

    it("should timeout each retry attempt independently", async () => {
      let attemptCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            attemptCount++;
            const signal = options?.signal as AbortSignal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted", "AbortError"));
              });
            }
            // Never resolve - each attempt will timeout
          })
      );

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/slow",
        method: "GET",
        errorHandling: "retry",
        retryCount: 2,
        timeoutMs: 50, // Very short timeout for fast test
      };

      await expect(executor.execute(webhookData, {})).rejects.toThrow(/abort/i);
      // Should have attempted 3 times (initial + 2 retries)
      expect(attemptCount).toBe(3);
    });
  });

  describe("Response Size Limits", () => {
    it("should reject responses exceeding size limit", async () => {
      // Create a mock response with a large body
      const largeBody = "x".repeat(2_000_000); // 2MB, exceeds 1MB limit
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        body: {
          getReader: () => {
            let sent = false;
            return {
              read: () => {
                if (!sent) {
                  sent = true;
                  return Promise.resolve({
                    done: false,
                    value: new TextEncoder().encode(largeBody),
                  });
                }
                return Promise.resolve({ done: true, value: undefined });
              },
              cancel: vi.fn(),
              releaseLock: vi.fn(),
            };
          },
        },
      });

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.example.com/large",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      await expect(executor.execute(webhookData, {})).rejects.toThrow(/exceeds limit/i);
    });
  });

  describe("SSRF Protection", () => {
    it("should block localhost URLs", async () => {
      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "http://localhost:8080/api",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      await expect(executor.execute(webhookData, {})).rejects.toThrow(/blocked/i);
    });

    it("should block private IP ranges", async () => {
      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "http://192.168.1.1/api",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      await expect(executor.execute(webhookData, {})).rejects.toThrow(/blocked/i);
    });

    it("should block AWS metadata endpoint", async () => {
      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "http://169.254.169.254/latest/meta-data/",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      await expect(executor.execute(webhookData, {})).rejects.toThrow(/blocked/i);
    });

    it("should allow public URLs", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse({ success: true }));

      const executor = createWebhookExecutor({
        template: mockTemplate,
        onDebug,
        onInfo,
        onWarn,
      });

      const webhookData: WebhookNodeData = {
        type: "webhook",
        schemaVersion: 1,
        label: "Test",
        url: "https://api.github.com/users",
        method: "GET",
        errorHandling: "continue",
        retryCount: 0,
        timeoutMs: 5000,
      };

      // Should not throw - public URL is allowed
      await executor.execute(webhookData, {});
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });
});

