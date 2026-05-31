import { z } from "zod";
import { BaseNodeDataSchema } from "../../../base";
import { HttpMethodSchema, HttpMethods, type HttpMethod } from "../../../http-config";

/**
 * Error handling strategies
 */
export const ErrorHandlingStrategies = {
  /** Ignore error and continue to next node */
  CONTINUE: "continue",
  /** Retry the request (with backoff) */
  RETRY: "retry",
  /** Stop the journey */
  FAIL: "fail",
} as const;

export const ErrorHandlingValues = Object.values(ErrorHandlingStrategies) as [string, ...string[]];
export const ErrorHandlingSchema = z.enum(ErrorHandlingValues);

/**
 * Authentication types supported by webhook
 */
export const AuthTypes = {
  BEARER: "bearer",
  BASIC: "basic",
  API_KEY: "apiKey",
} as const;

export const AuthTypeValues = Object.values(AuthTypes) as [string, ...string[]];
export const AuthTypeSchema = z.enum(AuthTypeValues);

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

/**
 * Mock response configuration for testing
 */
export const MockResponseSchema = z.object({
  enabled: z.boolean().default(false), // Use mock instead of real HTTP
  statusCode: z.number().min(100).max(599).optional().default(200), // Simulated HTTP status
  body: z.unknown().optional(), // JSON response to return in simulator mode
  delay: z.number().min(0).max(30000).optional().default(0), // Simulated latency in ms
});

/**
 * Authentication configuration schema
 */
export const WebhookAuthSchema = z.object({
  type: AuthTypeSchema,
  token: z.string().optional(), // For bearer
  username: z.string().optional(), // For basic
  password: z.string().optional(), // For basic
  headerName: z.string().optional(), // For apiKey
  apiKey: z.string().optional(), // For apiKey
});

/**
 * Webhook node - API calls (internal and external)
 * Replaces the old ACTION node type
 *
 * @example
 * const webhook: WebhookNodeData = {
 *   type: "webhook",
 *   label: "Get User",
 *   url: "https://api.example.com/users/{{user.id}}",
 *   method: "GET",
 *   auth: { type: "bearer", token: "{{env.API_TOKEN}}" },
 *   storeAs: "userData",
 * };
 */
export const WebhookNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("webhook"),
  // Request configuration
  // URL can include template variables like {{user.id}}, so we use min(1) instead of url()
  // URL validation happens at runtime after template interpolation
  url: z.string().min(1, "URL is required"),
  method: HttpMethodSchema,
  headers: z.record(z.string(), z.string()).optional(), // Key-value pairs
  body: z.string().optional(), // JSON template string
  // Authentication (optional)
  auth: WebhookAuthSchema.optional(),
  // Response handling
  successPath: z.string().optional(), // JSONPath to extract data from response
  storeAs: z.string().optional(), // Variable name to store the result
  // Error handling
  errorHandling: ErrorHandlingSchema.optional().default("continue"),
  retryCount: z.number().min(0).max(5).optional().default(0),
  timeoutMs: z.number().min(1000).max(60000).optional().default(30000),
  // Mock response for testing (when enabled, skips real HTTP calls)
  mockResponse: MockResponseSchema.optional(),
});

export type ErrorHandling = z.infer<typeof ErrorHandlingSchema>;
export type AuthType = z.infer<typeof AuthTypeSchema>;
export type WebhookAuth = z.infer<typeof WebhookAuthSchema>;
export type MockResponse = z.infer<typeof MockResponseSchema>;
export type WebhookNodeData = z.infer<typeof WebhookNodeDataSchema>;
export type { HttpMethod };
export { HttpMethodSchema, HttpMethods };

// =============================================================================
// WEBHOOK NODE OUTPUT SCHEMA
// Mirrors what webhook-handler.ts stores via storeNodeOutput()
// See: webhook-handler.ts
// =============================================================================

/**
 * Webhook node output schema - stored via storeNodeOutput()
 * Stores the raw HTTP response (any JSON structure)
 * If mockResponse is enabled, stores the mock body instead
 */
export const WebhookNodeOutputSchema = z.unknown();

export type WebhookNodeOutput = z.infer<typeof WebhookNodeOutputSchema>;
