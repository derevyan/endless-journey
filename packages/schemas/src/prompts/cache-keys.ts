/**
 * Prompt Cache Keys - Redis cache key constants
 *
 * Defines cache key patterns for prompt repository caching.
 *
 * @module schemas/prompts/cache-keys
 */

// =============================================================================
// CACHE KEY PATTERNS
// =============================================================================

/**
 * Prompt cache key generators
 *
 * Pattern:
 * - `prompt:{orgId}:{name}:label:{label}` - Most common runtime access
 * - `prompt:{orgId}:{name}:v:{versionId}` - Exact version access
 * - `prompt:{orgId}:{name}:*` - Invalidation pattern
 */
export const PROMPT_CACHE_KEYS = {
  /**
   * Cache key for fetching prompt by label (most common runtime access)
   * @example `prompt:org_123:customer-support:label:production`
   */
  byLabel: (orgId: string, name: string, label: string) => `prompt:${orgId}:${name}:label:${label}`,

  /**
   * Cache key for fetching prompt by exact version
   * @example `prompt:org_123:customer-support:v:v003`
   */
  byVersion: (orgId: string, name: string, versionId: string) => `prompt:${orgId}:${name}:v:${versionId}`,

  /**
   * Cache key for listing all versions (for UI)
   * @example `prompt:org_123:customer-support:versions`
   */
  allVersions: (orgId: string, name: string) => `prompt:${orgId}:${name}:versions`,

  /**
   * Pattern for invalidating all cache keys for a prompt
   * Used with Redis SCAN + DELETE pattern
   * @example `prompt:org_123:customer-support:*`
   */
  pattern: (orgId: string, name: string) => `prompt:${orgId}:${name}:*`,

  /**
   * Pattern for invalidating all prompts for an organization
   * @example `prompt:org_123:*`
   */
  orgPattern: (orgId: string) => `prompt:${orgId}:*`,
} as const;

// =============================================================================
// CACHE TTL CONSTANTS
// =============================================================================

/**
 * Default cache TTL values for prompts
 *
 * Prompts change infrequently, so we use longer TTLs:
 * - Runtime prompts (by label): 5 minutes
 * - Version list (for UI): 1 minute (refreshes more often during editing)
 */
export const PROMPT_CACHE_TTL = {
  /** TTL for runtime prompt fetching (by label or version) - 5 minutes */
  runtime: 300,
  /** TTL for version list in UI - 1 minute */
  list: 60,
} as const;

// =============================================================================
// SPECIAL LABELS
// =============================================================================

/**
 * Reserved prompt labels
 */
export const PROMPT_SPECIAL_LABELS = {
  /** Production-ready version (default for runtime fetching) */
  PRODUCTION: "production",
  /** Most recently created version (auto-assigned) */
  LATEST: "latest",
} as const;
