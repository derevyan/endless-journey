import { z } from "zod";

// =============================================================================
// HTTP METHOD CONSTANTS
// =============================================================================

/**
 * HTTP methods supported by HTTP-based nodes.
 */
export const HttpMethods = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  PATCH: "PATCH",
  DELETE: "DELETE",
} as const;

export const HttpMethodValues = Object.values(HttpMethods) as [string, ...string[]];
export const HttpMethodSchema = z.enum(HttpMethodValues);

export type HttpMethod = z.infer<typeof HttpMethodSchema>;

// =============================================================================
// HTTP CONFIG SCHEMAS
// =============================================================================

/**
 * Configuration for a single HTTP operation.
 */
export const HttpOperationConfigSchema = z.object({
  /** HTTP method */
  method: HttpMethodSchema,
  /** Whether request body is allowed */
  bodyAllowed: z.boolean(),
  /** Body format when allowed */
  bodyFormat: z.enum(["json", "form", "raw"]).optional(),
  /** Default headers for this operation */
  defaultHeaders: z.record(z.string(), z.string()).optional(),
  /** Operation-specific timeout (overrides default) */
  timeout: z.number().optional(),
});

/**
 * Retry configuration for HTTP operations.
 */
export const HttpRetryConfigSchema = z.object({
  maxRetries: z.number().default(3),
  backoffMs: z.number().default(1000),
  retryOn: z.array(z.number()).default([502, 503, 504]),
});

/**
 * Declarative HTTP configuration for a node.
 */
export const HttpNodeConfigSchema = z.object({
  /** Available operations */
  operations: z.record(HttpMethodSchema, HttpOperationConfigSchema),
  /** Default timeout for all operations (ms) */
  defaultTimeout: z.number().default(30000),
  /** Retry configuration */
  retryConfig: HttpRetryConfigSchema.optional(),
  /** Base URL for all operations (optional) */
  baseUrl: z.string().url().optional(),
  /** Default headers for all operations */
  defaultHeaders: z.record(z.string(), z.string()).optional(),
});

export type HttpOperationConfig = z.infer<typeof HttpOperationConfigSchema>;
export type HttpRetryConfig = z.infer<typeof HttpRetryConfigSchema>;
export type HttpNodeConfig = z.infer<typeof HttpNodeConfigSchema>;
