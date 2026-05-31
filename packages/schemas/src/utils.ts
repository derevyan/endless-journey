/**
 * Shared Utility Functions and Schemas
 *
 * Common utilities and reusable schemas used across the application.
 *
 * @module schemas/utils
 */

import { z } from "zod";

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * Non-empty string schema for required text fields
 */
export const NonEmptyStringSchema = z.string().min(1, "Cannot be empty");
export type NonEmptyString = z.infer<typeof NonEmptyStringSchema>;

// ============================================================================
// TIMESTAMP SCHEMAS
// ============================================================================

/**
 * ISO 8601 timestamp string schema.
 * Use for API payloads and events where dates must be ISO 8601 strings.
 * Validates string format without coercion.
 *
 * @example IsoTimestampSchema.parse("2024-01-15T10:30:00.000Z") // valid
 */
export const IsoTimestampSchema = z.iso.datetime();
export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;

/**
 * Flexible date schema that coerces strings to Date objects.
 * Use for database records where dates may come as Date objects or strings.
 * Automatically coerces strings to Date objects.
 *
 * @example FlexibleDateSchema.parse("2024-01-15") // Date object
 * @example FlexibleDateSchema.parse(new Date()) // Date object
 */
export const FlexibleDateSchema = z.coerce.date();
export type FlexibleDate = z.infer<typeof FlexibleDateSchema>;

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

/**
 * Pagination input schema for list endpoints
 * @example
 * const input = PaginationInputSchema.parse({ page: 1, pageSize: 20 });
 */
export const PaginationInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof PaginationInputSchema>;

/**
 * Pagination metadata schema for list responses
 */
export const PaginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

/**
 * Factory to create a paginated response schema for any item type
 *
 * @example
 * const PaginatedUsersSchema = createPaginatedResponseSchema(UserSchema);
 * type PaginatedUsers = z.infer<typeof PaginatedUsersSchema>;
 */
export const createPaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: PaginationMetaSchema,
  });

// ============================================================================
// API ERROR SCHEMAS
// ============================================================================

/**
 * Standardized API error response schema
 *
 * @example
 * const error: ApiError = {
 *   code: "NOT_FOUND",
 *   message: "Journey not found",
 *   timestamp: "2024-01-15T10:30:00.000Z",
 * };
 */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  timestamp: IsoTimestampSchema,
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a URL-friendly slug from a name
 *
 * Used by journeys, pipelines, and other entities for URL-friendly identifiers.
 * Returns a fallback slug if the input produces an empty string after sanitization.
 *
 * @example
 * generateSlug("My Cool Journey") // => "my-cool-journey"
 * generateSlug("Sales Pipeline!") // => "sales-pipeline"
 * generateSlug("  Multiple   Spaces  ") // => "multiple-spaces"
 * generateSlug("!!!") // => "new-item" (fallback)
 */
export function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") // Remove special chars, keep hyphens
      .replace(/^-+|-+$/g, "") // Trim leading/trailing hyphens
      .replace(/-{2,}/g, "-") || "new-item" // Fallback if empty
  );
}
