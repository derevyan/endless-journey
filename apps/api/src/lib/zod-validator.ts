/**
 * Zod Validation Helpers
 *
 * Provides validation utilities for API routes using Zod schemas.
 * Uses manual validation pattern for Zod v4 compatibility.
 *
 * @module lib/zod-validator
 */

import type { Context } from "hono";
import type { z } from "zod";
import { createLogger } from "@journey/logger";
import { getTracingContext } from "./event-tracing";

const log = createLogger("zod-validator");

/**
 * Validate JSON body against a Zod schema
 *
 * @example
 * ```ts
 * const parseResult = await validateJson(c, MySchema);
 * if (!parseResult.success) {
 *   return parseResult.response;
 * }
 * const data = parseResult.data;
 * ```
 */
export async function validateJson<T extends z.ZodType>(
  c: Context,
  schema: T
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: Response }
> {
  try {
    const body = await c.req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
        received: "received" in issue ? issue.received : undefined,
        expected: "expected" in issue ? issue.expected : undefined,
      }));
      log.warn({ errors, url: c.req.url, method: c.req.method }, "zod-validator:validateJson:failed");
      return {
        success: false,
        response: c.json(
          {
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: errors,
            requestId: getTracingContext()?.requestId,
          },
          400
        ) as unknown as Response,
      };
    }

    return { success: true, data: result.data };
  } catch (err) {
    log.warn({ url: c.req.url, method: c.req.method, error: String(err) }, "zod-validator:validateJson:invalidJson");
    return {
      success: false,
      response: c.json(
        {
          error: "Invalid JSON body",
          code: "BAD_REQUEST",
          requestId: getTracingContext()?.requestId,
        },
        400
      ) as unknown as Response,
    };
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T extends z.ZodType>(
  c: Context,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; response: Response } {
  const query = c.req.query();
  const result = schema.safeParse(query);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));
    log.warn({ errors, url: c.req.url, query }, "zod-validator:validateQuery:failed");
    return {
      success: false,
      response: c.json(
        {
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: errors,
          requestId: getTracingContext()?.requestId,
        },
        400
      ) as unknown as Response,
    };
  }

  return { success: true, data: result.data };
}
