/**
 * API Client Base
 *
 * Shared fetch helpers and configuration for all API modules.
 *
 * @module lib/api/base
 */

import { createLogger, serializeError } from "@journey/logger";
import { API_URL } from "@/shared/lib/app-config";

export const log = createLogger("api-client");

// Re-export API URL from app-config (single source of truth)
export const apiUrl = API_URL;

// =============================================================================
// FETCH HELPERS
// =============================================================================

export interface FetchContext {
  action: string;
  logContext?: Record<string, unknown>;
}

/**
 * Authenticated fetch with standard error handling
 * Throws on non-ok responses with logged errors
 */
export async function authFetch<T>(url: string, options: RequestInit | undefined, ctx: FetchContext): Promise<T> {
  log.debug(ctx.logContext ?? {}, `apiClient:${ctx.action}:start`);

  const res = await fetch(url, {
    credentials: "include",
    ...options,
  });

  if (!res.ok) {
    const error = new Error(`${ctx.action} failed: ${res.status}`);
    log.error({ status: res.status, ...ctx.logContext, err: serializeError(error) }, `apiClient:${ctx.action}:error`);
    throw error;
  }

  const data = await res.json();
  log.debug(ctx.logContext ?? {}, `apiClient:${ctx.action}:success`);
  return data as T;
}

/**
 * Authenticated fetch that returns the raw response for custom status handling
 */
export async function authFetchRaw(url: string, options: RequestInit | undefined, ctx: FetchContext): Promise<Response> {
  log.debug(ctx.logContext ?? {}, `apiClient:${ctx.action}:start`);

  return fetch(url, {
    credentials: "include",
    ...options,
  });
}
