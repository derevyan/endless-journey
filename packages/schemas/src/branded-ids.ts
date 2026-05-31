/**
 * Branded ID Types
 *
 * TypeScript branded types for compile-time safety when working with
 * different identifier formats (UUIDs vs slugs).
 *
 * ## Why Branded Types?
 *
 * The codebase uses both UUIDs (database primary keys) and slugs (URL-friendly
 * identifiers). Without branded types, it's easy to accidentally pass a slug
 * where a UUID is expected (or vice versa). Branded types catch these mistakes
 * at compile time.
 *
 * ## Naming Convention
 *
 * | Suffix      | Type           | Example         | Use Case                    |
 * |-------------|----------------|-----------------|------------------------------|
 * | `*Uuid`     | Database UUID  | `JourneyUuid`   | Database ops, API responses |
 * | `*Slug`     | URL-friendly   | `JourneySlug`   | URLs, routing, display      |
 * | `*IdOrSlug` | Union          | `JourneyIdOrSlug` | API params accepting both |
 * | `*Id`       | Generic UUID   | `OrganizationId`| Non-journey UUIDs           |
 *
 * @module schemas/branded-ids
 */

import { z } from "zod";

// ============================================================================
// BRANDED TYPE FOUNDATION
// ============================================================================

/**
 * Brand symbol for nominal typing.
 * Creates compile-time distinction between structurally identical types.
 */
declare const __brand: unique symbol;

/**
 * Branded type utility.
 * Adds a phantom brand to base type for nominal typing.
 *
 * @example
 * type UserId = Brand<string, "UserId">;
 * type OrderId = Brand<string, "OrderId">;
 * // UserId and OrderId are incompatible despite both being strings
 */
type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ============================================================================
// REGEX PATTERNS
// ============================================================================

/**
 * UUID v4 format regex (case-insensitive)
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Slug format regex (lowercase alphanumeric with hyphens)
 */
export const SLUG_REGEX = /^[a-z0-9-]+$/;

// ============================================================================
// JOURNEY IDENTIFIERS
// ============================================================================

/**
 * JourneyUuid - Database primary key for journeys
 *
 * Use when:
 * - Making database queries
 * - API responses (id field)
 * - Media upload operations
 * - Version management
 *
 * @example
 * const uuid = createJourneyUuid("550e8400-e29b-41d4-a716-446655440000");
 */
export type JourneyUuid = Brand<string, "JourneyUuid">;

/**
 * JourneySlug - URL-friendly journey identifier
 *
 * Use when:
 * - URL routing and search params
 * - Display in UI
 * - User-facing identifiers
 *
 * @example
 * const slug = createJourneySlug("saas-onboarding-m7k9p");
 */
export type JourneySlug = Brand<string, "JourneySlug">;

/**
 * JourneyIdOrSlug - Union type for API parameters
 *
 * Use when:
 * - API endpoints that accept both formats
 * - Functions that auto-detect UUID vs slug
 *
 * @example
 * async function getJourney(idOrSlug: JourneyIdOrSlug): Promise<Journey>
 */
export type JourneyIdOrSlug = JourneyUuid | JourneySlug;

// ============================================================================
// OTHER ENTITY IDENTIFIERS
// ============================================================================

/** Organization database UUID */
export type OrganizationId = Brand<string, "OrganizationId">;

/** User database UUID */
export type UserId = Brand<string, "UserId">;

/** Journey session database UUID */
export type SessionId = Brand<string, "SessionId">;

/** Messaging channel database UUID */
export type ChannelId = Brand<string, "ChannelId">;

/** Journey version database UUID */
export type VersionId = Brand<string, "VersionId">;

/** Client (end user) database UUID */
export type ClientId = Brand<string, "ClientId">;

/** Node database UUID */
export type NodeId = Brand<string, "NodeId">;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a string is a valid UUID format
 *
 * @example
 * isUuid("550e8400-e29b-41d4-a716-446655440000") // true
 * isUuid("my-slug") // false
 */
export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Check if a string is a valid slug format (and not a UUID)
 *
 * @example
 * isSlug("my-cool-journey") // true
 * isSlug("550e8400-e29b-41d4-a716-446655440000") // false (it's a UUID)
 */
export function isSlug(value: string): boolean {
  return SLUG_REGEX.test(value) && !UUID_REGEX.test(value);
}

/**
 * Type guard: Check if value is a JourneyUuid
 */
export function isJourneyUuid(value: string): value is JourneyUuid {
  return isUuid(value);
}

/**
 * Type guard: Check if value is a JourneySlug
 */
export function isJourneySlug(value: string): value is JourneySlug {
  return isSlug(value);
}

/**
 * Validates if a string is a valid UUID.
 * Returns the value if valid, null otherwise.
 * Useful for sanitizing optional UUID fields before DB insertion.
 *
 * @param value - String to validate (can be null/undefined/empty)
 * @returns The validated UUID string or null
 *
 * @example
 * validateUuidOrNull("550e8400-e29b-41d4-a716-446655440000") // returns the UUID
 * validateUuidOrNull("") // returns null
 * validateUuidOrNull("invalid") // returns null
 * validateUuidOrNull(null) // returns null
 */
export function validateUuidOrNull(value: string | undefined | null): string | null {
  if (!value || !isUuid(value)) {
    return null;
  }
  return value;
}

// ============================================================================
// ZOD SCHEMAS WITH BRANDING
// ============================================================================

/**
 * Zod schema for JourneyUuid with brand transform
 */
export const JourneyUuidSchema = z
  .string()
  .uuid("Must be a valid UUID")
  .transform((val) => val as JourneyUuid);

/**
 * Zod schema for JourneySlug with brand transform
 */
export const JourneySlugSchema = z
  .string()
  .regex(SLUG_REGEX, "Must be lowercase alphanumeric with hyphens")
  .refine((val) => !UUID_REGEX.test(val), "Cannot be a UUID")
  .transform((val) => val as JourneySlug);

/**
 * Zod schema for JourneyIdOrSlug (accepts either format)
 */
export const JourneyIdOrSlugSchema = z
  .string()
  .refine((val) => UUID_REGEX.test(val) || SLUG_REGEX.test(val), "Must be a valid UUID or slug")
  .transform((val) => val as JourneyIdOrSlug);

// Other entity schemas
export const OrganizationIdSchema = z
  .string()
  .uuid("Must be a valid UUID")
  .transform((val) => val as OrganizationId);

export const UserIdSchema = z
  .string()
  .uuid("Must be a valid UUID")
  .transform((val) => val as UserId);

export const SessionIdSchema = z
  .string()
  .uuid("Must be a valid UUID")
  .transform((val) => val as SessionId);

export const ChannelIdSchema = z
  .string()
  .uuid("Must be a valid UUID")
  .transform((val) => val as ChannelId);

export const VersionIdSchema = z
  .string()
  .uuid("Must be a valid UUID")
  .transform((val) => val as VersionId);

export const ClientIdSchema = z
  .string()
  .uuid("Must be a valid UUID")
  .transform((val) => val as ClientId);

export const NodeIdSchema = z
  .string()
  .uuid("Must be a valid UUID")
  .transform((val) => val as NodeId);

// ============================================================================
// BRANDED TYPE CONSTRUCTORS (with validation)
// ============================================================================

/**
 * Create a JourneyUuid from a string (with validation)
 * @throws Error if string is not a valid UUID
 *
 * @example
 * const uuid = createJourneyUuid("550e8400-e29b-41d4-a716-446655440000");
 */
export function createJourneyUuid(value: string): JourneyUuid {
  if (!isUuid(value)) {
    throw new Error(`Invalid JourneyUuid: "${value}" is not a valid UUID`);
  }
  return value as JourneyUuid;
}

/**
 * Create a JourneySlug from a string (with validation)
 * @throws Error if string is not a valid slug
 *
 * @example
 * const slug = createJourneySlug("saas-onboarding-m7k9p");
 */
export function createJourneySlug(value: string): JourneySlug {
  if (!SLUG_REGEX.test(value)) {
    throw new Error(`Invalid JourneySlug: "${value}" must be lowercase alphanumeric with hyphens`);
  }
  if (UUID_REGEX.test(value)) {
    throw new Error(`Invalid JourneySlug: "${value}" cannot be a UUID`);
  }
  return value as JourneySlug;
}

/**
 * Create a JourneyIdOrSlug from a string (with validation)
 * @throws Error if string is neither a valid UUID nor slug
 *
 * @example
 * const idOrSlug = createJourneyIdOrSlug(userInput);
 * if (isJourneyUuid(idOrSlug)) {
 *   // It's a UUID
 * } else {
 *   // It's a slug
 * }
 */
export function createJourneyIdOrSlug(value: string): JourneyIdOrSlug {
  if (isUuid(value)) {
    return value as JourneyUuid;
  }
  if (SLUG_REGEX.test(value)) {
    return value as JourneySlug;
  }
  throw new Error(`Invalid JourneyIdOrSlug: "${value}" must be a valid UUID or slug`);
}

// Other entity constructors
export function createOrganizationId(value: string): OrganizationId {
  if (!isUuid(value)) {
    throw new Error(`Invalid OrganizationId: "${value}" is not a valid UUID`);
  }
  return value as OrganizationId;
}

export function createUserId(value: string): UserId {
  if (!isUuid(value)) {
    throw new Error(`Invalid UserId: "${value}" is not a valid UUID`);
  }
  return value as UserId;
}

export function createSessionId(value: string): SessionId {
  if (!isUuid(value)) {
    throw new Error(`Invalid SessionId: "${value}" is not a valid UUID`);
  }
  return value as SessionId;
}

export function createChannelId(value: string): ChannelId {
  if (!isUuid(value)) {
    throw new Error(`Invalid ChannelId: "${value}" is not a valid UUID`);
  }
  return value as ChannelId;
}

export function createVersionId(value: string): VersionId {
  if (!isUuid(value)) {
    throw new Error(`Invalid VersionId: "${value}" is not a valid UUID`);
  }
  return value as VersionId;
}

export function createClientId(value: string): ClientId {
  if (!isUuid(value)) {
    throw new Error(`Invalid ClientId: "${value}" is not a valid UUID`);
  }
  return value as ClientId;
}

export function createNodeId(value: string): NodeId {
  if (!isUuid(value)) {
    throw new Error(`Invalid NodeId: "${value}" is not a valid UUID`);
  }
  return value as NodeId;
}

