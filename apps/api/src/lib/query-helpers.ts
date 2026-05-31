/**
 * Query Helpers
 *
 * Shared utilities for pagination, filtering, and query building.
 * Provides consistent patterns across all API routes.
 *
 * @module lib/query-helpers
 */

import { and, gte, lte, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default number of items per page */
export const DEFAULT_LIMIT = 50;

/** Maximum allowed items per page to prevent resource exhaustion */
export const MAX_LIMIT = 100;

/** Maximum allowed offset to prevent deep pagination attacks */
export const MAX_OFFSET = 10000;

// =============================================================================
// TYPES
// =============================================================================

export interface PaginationParams {
  limit?: string | number;
  offset?: string | number;
}

export interface ParsedPagination {
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

// =============================================================================
// PAGINATION HELPERS
// =============================================================================

/**
 * Parse and validate pagination parameters from query params.
 *
 * Applies bounds to prevent resource exhaustion:
 * - limit: min 1, max MAX_LIMIT (100), default DEFAULT_LIMIT (50)
 * - offset: min 0, max MAX_OFFSET (10000), default 0
 *
 * @example
 * ```ts
 * const { limit, offset } = parsePagination({
 *   limit: c.req.query("limit"),
 *   offset: c.req.query("offset"),
 * });
 * ```
 */
export function parsePagination(params: PaginationParams): ParsedPagination {
  // Parse limit
  const rawLimit = typeof params.limit === "number" ? params.limit : parseInt(String(params.limit) || "", 10);
  const limit = Number.isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(Math.max(rawLimit, 1), MAX_LIMIT);

  // Parse offset
  const rawOffset = typeof params.offset === "number" ? params.offset : parseInt(String(params.offset) || "", 10);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.min(Math.max(rawOffset, 0), MAX_OFFSET);

  return { limit, offset };
}

/**
 * Build pagination metadata for API responses.
 *
 * @param total - Total number of items matching the query
 * @param limit - Items per page
 * @param offset - Current offset
 * @param count - Number of items returned in current page
 *
 * @example
 * ```ts
 * return c.json({
 *   items: results,
 *   pagination: buildPaginationMeta(total, limit, offset, results.length),
 * });
 * ```
 */
export function buildPaginationMeta(total: number, limit: number, offset: number, count: number): PaginationMeta {
  return {
    total,
    limit,
    offset,
    hasMore: offset + count < total,
  };
}

// =============================================================================
// DATE RANGE HELPERS
// =============================================================================

/**
 * Build Drizzle SQL conditions for date range filtering.
 *
 * Returns an array of conditions that can be spread into `and()`.
 *
 * @param column - The timestamp/date column to filter on
 * @param startDate - ISO date string for start of range (inclusive)
 * @param endDate - ISO date string for end of range (inclusive, time set to 23:59:59.999)
 *
 * @example
 * ```ts
 * const dateConditions = buildDateRangeConditions(
 *   interactions.timestamp,
 *   c.req.query("startDate"),
 *   c.req.query("endDate")
 * );
 *
 * const query = db.select().from(table).where(
 *   and(...baseConditions, ...dateConditions)
 * );
 * ```
 */
export function buildDateRangeConditions(
  column: PgColumn,
  startDate?: string,
  endDate?: string
): SQL[] {
  const conditions: SQL[] = [];

  if (startDate) {
    conditions.push(gte(column, new Date(startDate)));
  }

  if (endDate) {
    // Include the full end day by setting time to end of day
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);
    conditions.push(lte(column, endDateTime));
  }

  return conditions;
}

/**
 * Build date range conditions with an exact end date (no adjustment).
 * Use this when the endDate already includes time information.
 */
export function buildDateRangeConditionsExact(
  column: PgColumn,
  startDate?: string,
  endDate?: string
): SQL[] {
  const conditions: SQL[] = [];

  if (startDate) {
    conditions.push(gte(column, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(column, new Date(endDate)));
  }

  return conditions;
}
