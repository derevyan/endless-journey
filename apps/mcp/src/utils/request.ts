/**
 * Request Parsing Utilities
 *
 * Shared request validation and parsing for route handlers.
 *
 * @module utils/request
 */

import type { Context } from "hono";
import type { MCPRequestOptions } from "@journey/mcp";
import { isStringRecord, isStringArray, isPlainObject } from "./validation";

interface ParsedListRequest {
  ok: true;
  servers?: string[];
  options?: MCPRequestOptions;
}

interface ParsedListRequestError {
  ok: false;
  error: string;
}

type ListRequestResult = ParsedListRequest | ParsedListRequestError;

/**
 * Parse and validate list request body (servers + options)
 */
export function parseListRequest(body: {
  servers?: unknown;
  options?: unknown;
}): ListRequestResult {
  const { servers, options } = body;

  if (servers !== undefined && !isStringArray(servers)) {
    return {
      ok: false,
      error: "servers must be an array of strings if provided",
    };
  }

  if (options !== undefined && !isPlainObject(options)) {
    return {
      ok: false,
      error: "options must be an object if provided",
    };
  }

  const requestOptions = options as MCPRequestOptions | undefined;
  if (requestOptions?.headers !== undefined && !isStringRecord(requestOptions.headers)) {
    return {
      ok: false,
      error: "options.headers must be a string map if provided",
    };
  }

  return {
    ok: true,
    servers: servers as string[] | undefined,
    options: requestOptions,
  };
}

/**
 * Parse JSON body with error handling
 * Returns null if parsing fails
 */
export async function parseJsonBody<T>(c: Context): Promise<T | null> {
  try {
    return (await c.req.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Validate required string field
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (!value || typeof value !== "string") {
    return {
      ok: false,
      error: `${fieldName} is required and must be a string`,
    };
  }
  return { ok: true, value };
}

/**
 * Validate optional object field
 */
export function validateOptionalObject(
  value: unknown,
  fieldName: string
): { ok: true; value?: Record<string, unknown> } | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (!isPlainObject(value)) {
    return {
      ok: false,
      error: `${fieldName} must be an object if provided`,
    };
  }
  return { ok: true, value };
}

/**
 * Validate optional request options (headers)
 */
export function validateRequestOptions(
  options: unknown
): { ok: true; options?: MCPRequestOptions } | { ok: false; error: string } {
  if (options === undefined) {
    return { ok: true };
  }

  if (!isPlainObject(options)) {
    return {
      ok: false,
      error: "options must be an object if provided",
    };
  }

  const requestOptions = options as MCPRequestOptions;
  if (requestOptions.headers !== undefined && !isStringRecord(requestOptions.headers)) {
    return {
      ok: false,
      error: "options.headers must be a string map if provided",
    };
  }

  return { ok: true, options: requestOptions };
}
