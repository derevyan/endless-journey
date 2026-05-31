/**
 * Centralized Status Values
 *
 * Single source of truth for status enums used across journey and node schemas.
 * This prevents drift between JourneyStatusSchema and NodeMetadataSchema.
 *
 * @module schemas/common/status
 */

/**
 * Journey and node status values.
 * Used by both JourneyStatusSchema and NodeMetadataSchema.status
 */
export const JourneyStatusValues = ["draft", "active", "archived"] as const;

/**
 * Type derived from status values for type safety.
 */
export type JourneyStatus = (typeof JourneyStatusValues)[number];
