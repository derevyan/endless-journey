/**
 * API Response Helpers
 *
 * Shared response handling utilities for API clients.
 * Reduces duplication in error handling and response parsing.
 *
 * @module lib/api/response-helpers
 */

import { serializeError } from "@journey/logger";
import { log } from "./base";

/**
 * Error details that can be parsed from API error responses
 */
export interface ApiErrorDetails {
  message?: string;
  code?: string;
  details?: unknown;
}

/**
 * Try to parse error details from a failed response.
 * Returns a placeholder if parsing fails.
 */
export async function parseErrorDetails(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return "Could not parse error response";
  }
}

/**
 * Handle 404 response by throwing a standardized error.
 *
 * @param res - The fetch Response object
 * @param entityType - Type of entity (e.g., "Journey", "Workflow", "Version")
 * @param logAction - Log action name for consistency
 * @param logContext - Additional context for logging
 * @returns true if response was 404 (and threw), false otherwise
 */
export function handle404(
  res: Response,
  entityType: string,
  logAction: string,
  logContext: Record<string, unknown>
): boolean {
  if (res.status === 404) {
    log.warn(logContext, `apiClient:${logAction}:notFound`);
    throw new Error(`${entityType} not found or access denied`);
  }
  return false;
}

/**
 * Handle non-OK response by logging and throwing an error.
 *
 * @param res - The fetch Response object
 * @param action - Description of the action that failed
 * @param logAction - Log action name for consistency
 * @param logContext - Additional context for logging
 * @param parseDetails - Whether to try parsing error details from response body
 */
export async function handleErrorResponse(
  res: Response,
  action: string,
  logAction: string,
  logContext: Record<string, unknown>,
  parseDetails = true
): Promise<never> {
  let errorDetails: unknown;
  if (parseDetails) {
    errorDetails = await parseErrorDetails(res);
  }

  const error = new Error(`${action}: ${res.status}`);
  log.error(
    { ...logContext, status: res.status, ...(parseDetails ? { errorDetails } : {}), err: serializeError(error) },
    `apiClient:${logAction}:error`
  );
  throw error;
}

/**
 * Assert that required fields exist in API response.
 * Throws and logs if validation fails.
 *
 * @param data - Response data to validate
 * @param fields - Field names that must be present
 * @param logAction - Log action name
 * @param logContext - Additional context for logging
 */
export function assertResponseFields<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[],
  logAction: string,
  logContext: Record<string, unknown>
): void {
  const missingFields = fields.filter((field) => data[field] === undefined);

  if (missingFields.length > 0) {
    const error = new Error(`Invalid API response: missing ${missingFields.join(", ")}`);
    log.error(
      { ...logContext, missingFields, hasFields: Object.keys(data) },
      `apiClient:${logAction}:invalidResponse`
    );
    throw error;
  }
}
