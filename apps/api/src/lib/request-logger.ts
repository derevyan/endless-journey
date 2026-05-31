/**
 * Request Logger Middleware
 *
 * Logs HTTP requests with timing and request IDs.
 * Provides request tracing support via X-Request-Id header.
 *
 * @module lib/request-logger
 */

import type { Context, Next } from "hono";
import { randomUUID } from "node:crypto";
import { createLogger } from "@journey/logger";

const log = createLogger("api:request");

// =============================================================================
// CONSTANTS
// =============================================================================

/** Header name for request ID (standard convention) */
const REQUEST_ID_HEADER = "X-Request-Id";

/** Paths to skip logging (health checks, static assets) */
const SKIP_PATHS = new Set(["/health", "/healthz", "/ready", "/metrics"]);

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Request logger middleware
 *
 * - Generates or forwards X-Request-Id for request tracing
 * - Logs request start and completion with timing
 * - Adds request ID to response headers
 *
 * @example
 * ```ts
 * app.use("*", requestLogger);
 * ```
 */
export async function requestLogger(c: Context, next: Next): Promise<void> {
  const startTime = performance.now();

  // Generate or forward request ID
  const requestId = c.req.header(REQUEST_ID_HEADER) || randomUUID();

  // Set request ID in context for downstream use
  c.set("requestId" as never, requestId);

  // Add request ID to response headers
  c.header(REQUEST_ID_HEADER, requestId);

  const method = c.req.method;
  const path = c.req.path;

  // Skip logging for health checks (too noisy)
  if (SKIP_PATHS.has(path)) {
    await next();
    return;
  }

  // Log request start (debug level to avoid noise)
  log.debug({ requestId, method, path }, "request:start");

  try {
    await next();

    // Calculate duration
    const durationMs = Math.round(performance.now() - startTime);
    const status = c.res.status;

    // Log based on status code
    if (status >= 500) {
      log.error({ requestId, method, path, status, durationMs }, "request:error");
    } else if (status >= 400) {
      log.warn({ requestId, method, path, status, durationMs }, "request:clientError");
    } else {
      log.info({ requestId, method, path, status, durationMs }, "request:complete");
    }
  } catch (error) {
    // Calculate duration even on error
    const durationMs = Math.round(performance.now() - startTime);

    // Re-throw after logging (errorHandler will catch it)
    log.error({ requestId, method, path, durationMs, error }, "request:exception");
    throw error;
  }
}

/**
 * Get request ID from context
 *
 * Retrieves the request ID set by the middleware.
 * Returns undefined if middleware hasn't run.
 *
 * @param c - Hono context
 * @returns Request ID or undefined
 */
export function getRequestId(c: Context): string | undefined {
  return c.get("requestId" as never) as string | undefined;
}
