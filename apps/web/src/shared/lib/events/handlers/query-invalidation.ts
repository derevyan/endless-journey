/**
 * Query Invalidation Handler
 *
 * Automatically invalidates TanStack Query cache based on incoming events.
 * Uses the frontend event registry to determine which queries to invalidate.
 *
 * @module lib/events/handlers/query-invalidation
 */

import type { QueryClient } from "@tanstack/react-query";

import { createLogger } from "@journey/logger";

import type { FrontendEvent, EventHandler } from "../types";
import { getEventConfig } from "../registry";
import { HANDLER_PRIORITY } from "../types";

const log = createLogger("query-invalidation-handler");

// =============================================================================
// QUERY INVALIDATION HANDLER
// =============================================================================

/**
 * Create a query invalidation handler
 *
 * @param queryClient - TanStack Query client instance
 * @returns Event handler that invalidates queries based on event type
 */
export function createQueryInvalidationHandler(
  queryClient: QueryClient
): EventHandler {
  return (event: FrontendEvent) => {
    const config = getEventConfig(event.type);

    if (!config?.invalidates || config.invalidates.length === 0) {
      return;
    }

    log.debug(
      { eventType: event.type, queryKeysCount: config.invalidates.length },
      "queryInvalidation:invalidating"
    );

    // Invalidate each configured query key
    for (const queryKey of config.invalidates) {
      queryClient.invalidateQueries({
        queryKey: queryKey as readonly unknown[],
      });
    }
  };
}

/**
 * Handler config for query invalidation
 */
export const QUERY_INVALIDATION_CONFIG = {
  priority: HANDLER_PRIORITY.CRITICAL,
} as const;
