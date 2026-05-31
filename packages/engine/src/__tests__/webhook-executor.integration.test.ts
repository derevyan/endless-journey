/**
 * Webhook Executor Integration Tests
 *
 * These tests make REAL HTTP requests to public test APIs.
 * They verify the webhook executor works correctly in production scenarios.
 *
 * Test APIs used:
 * - httpbin.org: HTTP request & response testing service
 * - jsonplaceholder.typicode.com: Fake REST API for testing
 *
 * @note These tests require network access and may be slower than unit tests
 * @note Run with: pnpm --filter @journey/engine test webhook-executor.integration
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createWebhookExecutor, type WebhookExecutorOptions } from "../services/webhook-executor";
import { createTemplateService } from "../services/template-service";
import { SSRFBlockedError } from "../services/url-validator";
import type { WebhookNodeData } from "@journey/schemas";

// Increase timeout for real network requests
const NETWORK_TIMEOUT = 30000;

describe("WebhookExecutor Integration Tests (Real HTTP)", () => {
  let executor: ReturnType<typeof createWebhookExecutor>;
  let debugLogs: Array<{ message: string; data: Record<string, unknown> }>;
  let infoLogs: Array<{ message: string; data: Record<string, unknown> }>;
  let warnLogs: Array<{ message: string; data: Record<string, unknown> }>;

  beforeAll(() => {
    debugLogs = [];
    infoLogs = [];
    warnLogs = [];

    const options: WebhookExecutorOptions = {
      template: createTemplateService(),
      onDebug: (message, data) => debugLogs.push({ message, data }),
      onInfo: (message, data) => infoLogs.push({ message, data }),
      onWarn: (message, data) => warnLogs.push({ message, data }),
    };

    executor = createWebhookExecutor(options);
  });

  afterAll(() => {
    // Clean up any resources if needed
  });

  // Helper to create webhook data with defaults
  function createWebhookData(overrides: Partial<WebhookNodeData>): WebhookNodeData {
    return {
      label: "Test Webhook",
      url: "https://httpbin.org/get",
      method: "GET",
      timeoutMs: 15000,
      errorHandling: "continue",
      ...overrides,
    } as WebhookNodeData;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET Requests
  // ─────────────────────────────────────────────────────────────────────────────

  describe("GET Requests", () => {
    it(
      "should fetch data from httpbin.org/get",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/get",
          method: "GET",
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
        expect(result.url).toBe("https://httpbin.org/get");
        expect(result.headers).toBeDefined();
      },
      NETWORK_TIMEOUT
    );

    it(
      "should fetch posts from JSONPlaceholder API",
      async () => {
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/posts/1",
          method: "GET",
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
        expect(result.id).toBe(1);
        expect(result.userId).toBe(1);
        expect(result.title).toBeDefined();
        expect(result.body).toBeDefined();
      },
      NETWORK_TIMEOUT
    );

    it(
      "should fetch user data with query parameters",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/get?foo=bar&count=42",
          method: "GET",
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;
        const args = result.args as Record<string, string>;

        expect(args.foo).toBe("bar");
        expect(args.count).toBe("42");
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST Requests
  // ─────────────────────────────────────────────────────────────────────────────

  describe("POST Requests", () => {
    it(
      "should send JSON body to httpbin.org/post",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/post",
          method: "POST",
          body: JSON.stringify({ message: "Hello from integration test", count: 123 }),
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
        const json = result.json as Record<string, unknown>;
        expect(json.message).toBe("Hello from integration test");
        expect(json.count).toBe(123);
      },
      NETWORK_TIMEOUT
    );

    it(
      "should create a post on JSONPlaceholder",
      async () => {
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/posts",
          method: "POST",
          body: JSON.stringify({
            title: "Integration Test Post",
            body: "This is a test post from webhook integration tests",
            userId: 1,
          }),
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
        expect(result.id).toBe(101); // JSONPlaceholder returns 101 for new posts
        expect(result.title).toBe("Integration Test Post");
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PUT and PATCH Requests
  // ─────────────────────────────────────────────────────────────────────────────

  describe("PUT and PATCH Requests", () => {
    it(
      "should update a resource with PUT",
      async () => {
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/posts/1",
          method: "PUT",
          body: JSON.stringify({
            id: 1,
            title: "Updated Title",
            body: "Updated body content",
            userId: 1,
          }),
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result.id).toBe(1);
        expect(result.title).toBe("Updated Title");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should partially update with PATCH",
      async () => {
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/posts/1",
          method: "PATCH",
          body: JSON.stringify({ title: "Patched Title" }),
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result.id).toBe(1);
        expect(result.title).toBe("Patched Title");
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE Requests
  // ─────────────────────────────────────────────────────────────────────────────

  describe("DELETE Requests", () => {
    it(
      "should delete a resource",
      async () => {
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/posts/1",
          method: "DELETE",
        });

        const result = await executor.execute(webhookData, {});

        // JSONPlaceholder returns empty object on delete
        expect(result).toBeDefined();
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Custom Headers
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Custom Headers", () => {
    it(
      "should send custom headers",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/headers",
          method: "GET",
          headers: {
            "X-Custom-Header": "custom-value",
            "X-Test-Value": "test-123",
          },
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;
        const headers = result.headers as Record<string, string>;

        // Verify custom headers are sent (httpbin returns them in Title-Case)
        expect(headers["X-Custom-Header"]).toBe("custom-value");
        expect(headers["X-Test-Value"]).toBe("test-123");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should send Content-Type header by default",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/headers",
          method: "GET",
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;
        const headers = result.headers as Record<string, string>;

        expect(headers["Content-Type"]).toBe("application/json");
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Authentication", () => {
    it(
      "should send Bearer token authentication",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/bearer",
          method: "GET",
          auth: {
            type: "bearer",
            token: "test-bearer-token-12345",
          },
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result.authenticated).toBe(true);
        expect(result.token).toBe("test-bearer-token-12345");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should send Basic authentication",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/basic-auth/testuser/testpass",
          method: "GET",
          auth: {
            type: "basic",
            username: "testuser",
            password: "testpass",
          },
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result.authenticated).toBe(true);
        expect(result.user).toBe("testuser");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should send Basic auth with UTF-8 characters",
      async () => {
        // This tests the Buffer.from() fix for unicode characters
        const webhookData = createWebhookData({
          url: "https://httpbin.org/headers",
          method: "GET",
          auth: {
            type: "basic",
            username: "用户", // Chinese characters
            password: "密码123",
          },
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;
        const headers = result.headers as Record<string, string>;

        // Should have Authorization header (we can't verify exact encoding without decoding)
        expect(headers["Authorization"]).toMatch(/^Basic /);
      },
      NETWORK_TIMEOUT
    );

    it(
      "should send API key in custom header",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/headers",
          method: "GET",
          auth: {
            type: "apiKey",
            headerName: "X-API-Key",
            apiKey: "my-secret-api-key",
          },
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;
        const headers = result.headers as Record<string, string>;

        expect(headers["X-Api-Key"]).toBe("my-secret-api-key");
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Template Variable Substitution
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Template Variable Substitution", () => {
    it(
      "should substitute variables in URL",
      async () => {
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/posts/{{postId}}",
          method: "GET",
        });

        const context = { postId: 5 };
        const result = (await executor.execute(webhookData, context)) as Record<string, unknown>;

        expect(result.id).toBe(5);
      },
      NETWORK_TIMEOUT
    );

    it(
      "should substitute variables in request body",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/post",
          method: "POST",
          body: JSON.stringify({
            userName: "{{user.name}}",
            userAge: "{{user.age}}",
            message: "Hello {{user.name}}!",
          }),
        });

        const context = {
          user: { name: "Alice", age: 30 },
        };

        const result = (await executor.execute(webhookData, context)) as Record<string, unknown>;
        const json = result.json as Record<string, unknown>;

        expect(json.userName).toBe("Alice");
        expect(json.userAge).toBe("30"); // Template substitution returns strings
        expect(json.message).toBe("Hello Alice!");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should substitute variables in headers",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/headers",
          method: "GET",
          headers: {
            "X-User-Id": "{{userId}}",
            "X-Session-Id": "{{session.id}}",
          },
        });

        const context = {
          userId: "user-123",
          session: { id: "sess-456" },
        };

        const result = (await executor.execute(webhookData, context)) as Record<string, unknown>;
        const headers = result.headers as Record<string, string>;

        expect(headers["X-User-Id"]).toBe("user-123");
        expect(headers["X-Session-Id"]).toBe("sess-456");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should substitute variables in auth token",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/bearer",
          method: "GET",
          auth: {
            type: "bearer",
            token: "{{authToken}}",
          },
        });

        const context = { authToken: "dynamic-token-xyz" };
        const result = (await executor.execute(webhookData, context)) as Record<string, unknown>;

        expect(result.authenticated).toBe(true);
        expect(result.token).toBe("dynamic-token-xyz");
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // JSONPath Extraction
  // ─────────────────────────────────────────────────────────────────────────────

  describe("JSONPath Extraction", () => {
    it(
      "should extract nested field with successPath",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/get?nested=true",
          method: "GET",
          successPath: "$.args.nested",
        });

        const result = await executor.execute(webhookData, {});

        expect(result).toBe("true");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should extract title from JSONPlaceholder post",
      async () => {
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/posts/1",
          method: "GET",
          successPath: "$.title",
        });

        const result = await executor.execute(webhookData, {});

        expect(typeof result).toBe("string");
        expect((result as string).length).toBeGreaterThan(0);
      },
      NETWORK_TIMEOUT
    );

    it(
      "should extract array element",
      async () => {
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/posts",
          method: "GET",
          successPath: "$[0].id",
        });

        const result = await executor.execute(webhookData, {});

        expect(result).toBe(1);
      },
      NETWORK_TIMEOUT
    );

    it(
      "should extract multiple values as array",
      async () => {
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/posts?userId=1",
          method: "GET",
          successPath: "$[*].id",
        });

        const result = await executor.execute(webhookData, {});

        expect(Array.isArray(result)).toBe(true);
        expect((result as number[]).length).toBeGreaterThan(0);
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // HTTP Status Codes and Error Handling
  // ─────────────────────────────────────────────────────────────────────────────

  describe("HTTP Status Codes and Error Handling", () => {
    it(
      "should handle 404 Not Found",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/status/404",
          method: "GET",
          errorHandling: "continue",
        });

        await expect(executor.execute(webhookData, {})).rejects.toThrow(/404/);
      },
      NETWORK_TIMEOUT
    );

    it(
      "should handle 500 Internal Server Error",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/status/500",
          method: "GET",
          errorHandling: "continue",
        });

        await expect(executor.execute(webhookData, {})).rejects.toThrow(/500/);
      },
      NETWORK_TIMEOUT
    );

    it(
      "should handle 401 Unauthorized",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/status/401",
          method: "GET",
          errorHandling: "continue",
        });

        await expect(executor.execute(webhookData, {})).rejects.toThrow(/401/);
      },
      NETWORK_TIMEOUT
    );

    it(
      "should handle 503 Service Unavailable",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/status/503",
          method: "GET",
          errorHandling: "continue",
        });

        await expect(executor.execute(webhookData, {})).rejects.toThrow(/503/);
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Timeout Handling
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Timeout Handling", () => {
    it(
      "should timeout on slow response",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/delay/10", // 10 second delay
          method: "GET",
          timeoutMs: 2000, // 2 second timeout
        });

        await expect(executor.execute(webhookData, {})).rejects.toThrow(/abort|timeout/i);
      },
      NETWORK_TIMEOUT
    );

    it(
      "should complete before timeout",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/delay/1", // 1 second delay
          method: "GET",
          timeoutMs: 10000, // 10 second timeout
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
        expect(result.url).toContain("delay/1");
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Retry Logic
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Retry Logic", () => {
    // Note: httpbin.org doesn't have a good endpoint for testing retries
    // since it returns consistent responses. We test that the retry mechanism
    // works by checking that requests that eventually succeed do so.

    it(
      "should succeed on first attempt without retry",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/get",
          method: "GET",
          retryCount: 3,
          errorHandling: "retry",
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
        expect(result.url).toBe("https://httpbin.org/get");
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SSRF Protection
  // ─────────────────────────────────────────────────────────────────────────────

  describe("SSRF Protection", () => {
    it("should block requests to localhost", async () => {
      const webhookData = createWebhookData({
        url: "http://localhost:8080/api",
        method: "GET",
      });

      await expect(executor.execute(webhookData, {})).rejects.toThrow(SSRFBlockedError);
    });

    it("should block requests to 127.0.0.1", async () => {
      const webhookData = createWebhookData({
        url: "http://127.0.0.1:3000/api",
        method: "GET",
      });

      await expect(executor.execute(webhookData, {})).rejects.toThrow(SSRFBlockedError);
    });

    it("should block requests to private IP 10.x.x.x", async () => {
      const webhookData = createWebhookData({
        url: "http://10.0.0.1/internal-api",
        method: "GET",
      });

      await expect(executor.execute(webhookData, {})).rejects.toThrow(SSRFBlockedError);
    });

    it("should block requests to private IP 192.168.x.x", async () => {
      const webhookData = createWebhookData({
        url: "http://192.168.1.1/router-admin",
        method: "GET",
      });

      await expect(executor.execute(webhookData, {})).rejects.toThrow(SSRFBlockedError);
    });

    it("should block AWS metadata endpoint", async () => {
      const webhookData = createWebhookData({
        url: "http://169.254.169.254/latest/meta-data/",
        method: "GET",
      });

      await expect(executor.execute(webhookData, {})).rejects.toThrow(SSRFBlockedError);
    });

    it("should block internal hostnames", async () => {
      const webhookData = createWebhookData({
        url: "http://api.internal/secret",
        method: "GET",
      });

      await expect(executor.execute(webhookData, {})).rejects.toThrow(SSRFBlockedError);
    });

    it(
      "should allow requests to public APIs",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/get",
          method: "GET",
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Response Size Limits
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Response Size Limits", () => {
    it(
      "should handle normal-sized responses",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/json", // Returns a small JSON response
          method: "GET",
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
        expect(result.slideshow).toBeDefined(); // httpbin.org/json returns slideshow data
      },
      NETWORK_TIMEOUT
    );

    it(
      "should handle responses with gzip encoding",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/gzip",
          method: "GET",
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
        expect(result.gzipped).toBe(true);
      },
      NETWORK_TIMEOUT
    );

    it(
      "should reject responses exceeding 1MB limit",
      async () => {
        // JSONPlaceholder /photos returns ~5000 items, exceeding 1MB
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/photos",
          method: "GET",
        });

        await expect(executor.execute(webhookData, {})).rejects.toThrow(/Response size exceeds limit/);
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Mock Response (should still work in integration)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Mock Response", () => {
    it("should return mock response when enabled", async () => {
      const webhookData = createWebhookData({
        url: "https://httpbin.org/get", // Real URL, but mock is enabled
        method: "GET",
        mockResponse: {
          enabled: true,
          statusCode: 200,
          delay: 0,
          body: { mocked: true, data: "test-data" },
        },
      });

      const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

      expect(result.mocked).toBe(true);
      expect(result.data).toBe("test-data");
    });

    it("should simulate mock error status codes", async () => {
      const webhookData = createWebhookData({
        url: "https://httpbin.org/get",
        method: "GET",
        mockResponse: {
          enabled: true,
          statusCode: 500,
          delay: 0,
          body: { error: "Simulated error" },
        },
      });

      await expect(executor.execute(webhookData, {})).rejects.toThrow(/Mock HTTP error: 500/);
    });

    it("should apply JSONPath to mock response", async () => {
      const webhookData = createWebhookData({
        url: "https://httpbin.org/get",
        method: "GET",
        mockResponse: {
          enabled: true,
          statusCode: 200,
          delay: 0,
          body: {
            user: { name: "MockUser", id: 123 },
            status: "active",
          },
        },
        successPath: "$.user.name",
      });

      const result = await executor.execute(webhookData, {});

      expect(result).toBe("MockUser");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Edge Cases", () => {
    it(
      "should handle empty response body (204 No Content)",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/status/204", // No Content
          method: "DELETE",
        });

        // 204 is a success status with no body
        // The executor returns { text: '' } for non-JSON responses
        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
        expect(result.text).toBe("");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should handle redirect responses",
      async () => {
        // httpbin.org/redirect/1 redirects once, then returns 200
        const webhookData = createWebhookData({
          url: "https://httpbin.org/redirect/1",
          method: "GET",
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;

        expect(result).toBeDefined();
        expect(result.url).toContain("httpbin.org/get");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should handle special characters in query params",
      async () => {
        const webhookData = createWebhookData({
          url: "https://httpbin.org/get?message=Hello%20World&emoji=%F0%9F%9A%80",
          method: "GET",
        });

        const result = (await executor.execute(webhookData, {})) as Record<string, unknown>;
        const args = result.args as Record<string, string>;

        expect(args.message).toBe("Hello World");
        expect(args.emoji).toBe("🚀");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should handle medium-sized JSON array response (under 1MB)",
      async () => {
        // Posts endpoint returns 100 items, well under 1MB limit
        const webhookData = createWebhookData({
          url: "https://jsonplaceholder.typicode.com/posts",
          method: "GET",
        });

        const result = (await executor.execute(webhookData, {})) as unknown[];

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(100);
      },
      NETWORK_TIMEOUT
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Logging Verification
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Logging", () => {
    it(
      "should log request info",
      async () => {
        // Clear previous logs
        infoLogs.length = 0;

        const webhookData = createWebhookData({
          url: "https://httpbin.org/get",
          method: "GET",
        });

        await executor.execute(webhookData, {});

        // Check that info log was called
        const requestLog = infoLogs.find((log) => log.message === "webhook:request");
        expect(requestLog).toBeDefined();
        expect(requestLog?.data.method).toBe("GET");
      },
      NETWORK_TIMEOUT
    );

    it(
      "should mask sensitive URL parameters in logs",
      async () => {
        infoLogs.length = 0;

        const webhookData = createWebhookData({
          url: "https://httpbin.org/get?token=secret123&apiKey=key456",
          method: "GET",
        });

        await executor.execute(webhookData, {});

        const requestLog = infoLogs.find((log) => log.message === "webhook:request");
        expect(requestLog).toBeDefined();

        // URL in logs should have masked sensitive params
        const loggedUrl = requestLog?.data.url as string;
        expect(loggedUrl).not.toContain("secret123");
        expect(loggedUrl).not.toContain("key456");
        expect(loggedUrl).toContain("***");
      },
      NETWORK_TIMEOUT
    );
  });
});
