/**
 * API Error Handling
 *
 * Centralized error handling for the API layer.
 * Provides a global error handler for Hono and helper functions
 * for throwing standardized errors from route handlers.
 *
 * @module lib/errors
 */

import type { Context } from "hono";
import { createLogger, serializeError } from "@journey/logger";
import {
  JourneyError,
  ValidationError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from "@journey/schemas";
import { getTracingContext } from "./event-tracing";

const log = createLogger("api:errors");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Standard API error response format.
 * All API errors should follow this structure.
 */
export interface ApiErrorResponse {
  /** Human-readable error message */
  error: string;
  /** Machine-readable error code (e.g., "NOT_FOUND", "VALIDATION_ERROR") */
  code: string;
  /** Optional additional details (e.g., validation errors) */
  details?: unknown;
  /** Request ID for tracing */
  requestId?: string;
}

// =============================================================================
// ERROR HANDLER MIDDLEWARE
// =============================================================================

/**
 * Global error handler for Hono.
 *
 * Catches all unhandled errors thrown in route handlers and middleware,
 * formats them into a standardized API error response.
 *
 * @example
 * ```ts
 * const app = new Hono();
 * app.onError(errorHandler);
 * ```
 */
export function errorHandler(err: Error, c: Context): Response {
  const tracingContext = getTracingContext();
  const requestId = tracingContext?.requestId;

  // Log all errors with context
  log.error(
    {
      err: serializeError(err),
      requestId,
      path: c.req.path,
      method: c.req.method,
    },
    "api:unhandledError"
  );

  // Handle JourneyError subclasses (includes all our custom errors)
  if (err instanceof JourneyError) {
    const response: ApiErrorResponse = {
      error: err.message,
      code: err.code,
      requestId,
    };

    // Include details for ValidationError and BadRequestError
    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }
    if (err instanceof BadRequestError && err.details) {
      response.details = err.details;
    }

    // Type assertion needed for Hono's status code type
    return c.json(response, err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503 | 504);
  }

  // Generic error fallback - hide internal details in production
  return c.json<ApiErrorResponse>(
    {
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      requestId,
    },
    500
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Throw a NotFoundError for a resource.
 *
 * @example
 * ```ts
 * const journey = await getJourneyById(id);
 * if (!journey) {
 *   throwNotFound("Journey", id);
 * }
 * ```
 */
export function throwNotFound(resource: string, id?: string): never {
  throw new NotFoundError(resource, id || "unknown");
}

/**
 * Throw a BadRequestError with optional details.
 *
 * @example
 * ```ts
 * if (!validInput) {
 *   throwBadRequest("Invalid input format", { expected: "string" });
 * }
 * ```
 */
export function throwBadRequest(message: string, details?: unknown): never {
  throw new BadRequestError(message, details);
}

/**
 * Throw an UnauthorizedError.
 *
 * @example
 * ```ts
 * if (!session) {
 *   throwUnauthorized("Session expired");
 * }
 * ```
 */
export function throwUnauthorized(message = "Unauthorized"): never {
  throw new UnauthorizedError(message);
}

/**
 * Throw a ForbiddenError.
 *
 * @example
 * ```ts
 * if (!hasPermission) {
 *   throwForbidden("You do not have permission to access this resource");
 * }
 * ```
 */
export function throwForbidden(message = "Access denied"): never {
  throw new ForbiddenError(message);
}

/**
 * Throw a ConflictError for duplicate resources.
 *
 * @example
 * ```ts
 * const existing = await findBySlug(slug);
 * if (existing) {
 *   throwConflict(`A resource with slug "${slug}" already exists`);
 * }
 * ```
 */
export function throwConflict(message: string): never {
  throw new ConflictError(message);
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Create a standardized error response without throwing.
 * Use this when you need to return an error response directly.
 *
 * @example
 * ```ts
 * if (!journey) {
 *   return createErrorResponse(c, "Journey not found", "NOT_FOUND", 404);
 * }
 * ```
 */
export function createErrorResponse(
  c: Context,
  message: string,
  code: string,
  statusCode: number,
  details?: unknown
): Response {
  const tracingContext = getTracingContext();

  const response: ApiErrorResponse = {
    error: message,
    code,
    requestId: tracingContext?.requestId,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return c.json(response, statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503);
}
