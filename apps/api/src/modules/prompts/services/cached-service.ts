/**
 * Cached Prompt Service
 *
 * Wraps prompt service with Redis caching for runtime performance.
 * Uses cache-aside pattern for reads and write-through invalidation.
 *
 * Cache keys:
 * - prompt:{orgId}:{name}:label:{label} - Get by label (production, latest)
 * - prompt:{orgId}:{name}:v:{versionId} - Get by specific version
 *
 * @module modules/prompts/services/cached-service
 */

import { createLogger, serializeError } from "@journey/logger";
import { PROMPT_CACHE_KEYS, PROMPT_CACHE_TTL } from "@journey/schemas";
import type { CreateVersionInput, PromptVersionResponse, UpdateLabelsInput } from "@journey/schemas";

import { redisCacheService } from "../../../services/redis-cache-service";
import type { PromptServiceContext } from "./service-context";
import * as versionService from "./version-service";

const log = createLogger("cached-prompt-service");

// =============================================================================
// TYPES
// =============================================================================

/** Cached prompt version with metadata */
interface CachedPromptVersion {
  version: PromptVersionResponse;
  cachedAt: number;
}

// =============================================================================
// CACHED READ OPERATIONS
// =============================================================================

/**
 * Get a prompt version by label with caching.
 * Most common runtime access pattern (agent nodes requesting "production" prompt).
 *
 * @param promptName - Prompt name
 * @param label - Version label (e.g., "production", "latest")
 * @param organizationId - Organization ID
 * @returns Prompt version response
 */
export async function getVersionByLabel(
  ctx: PromptServiceContext,
  promptName: string,
  label: string
): Promise<PromptVersionResponse> {
  const cacheKey = PROMPT_CACHE_KEYS.byLabel(ctx.organizationId, promptName, label);

  try {
    // Check cache first
    const cached = await redisCacheService.get<CachedPromptVersion>(cacheKey);
    if (cached !== null) {
      log.debug({ promptName, label, organizationId: ctx.organizationId }, "cachedPrompt:label:hit");
      return cached.version;
    }

    // Cache miss - get from database
    log.debug({ promptName, label, organizationId: ctx.organizationId }, "cachedPrompt:label:miss");
    const version = await versionService.getVersionByLabel(ctx, promptName, label);

    // Cache the result
    await redisCacheService.set<CachedPromptVersion>(
      cacheKey,
      { version, cachedAt: Date.now() },
      { ttlSeconds: PROMPT_CACHE_TTL.runtime }
    );

    return version;
  } catch (error) {
    log.error({ promptName, label, organizationId: ctx.organizationId, err: serializeError(error) }, "cachedPrompt:label:error");
    // Fallback to direct DB access on cache error
    return versionService.getVersionByLabel(ctx, promptName, label);
  }
}

/**
 * Get a specific prompt version by ID with caching.
 * Less common but useful for version pinning scenarios.
 *
 * @param promptName - Prompt name
 * @param versionId - Version ID (e.g., "v001")
 * @param organizationId - Organization ID
 * @returns Prompt version response
 */
export async function getVersion(
  ctx: PromptServiceContext,
  promptName: string,
  versionId: string
): Promise<PromptVersionResponse> {
  const cacheKey = PROMPT_CACHE_KEYS.byVersion(ctx.organizationId, promptName, versionId);

  try {
    // Check cache first
    const cached = await redisCacheService.get<CachedPromptVersion>(cacheKey);
    if (cached !== null) {
      log.debug({ promptName, versionId, organizationId: ctx.organizationId }, "cachedPrompt:version:hit");
      return cached.version;
    }

    // Cache miss - get from database
    log.debug({ promptName, versionId, organizationId: ctx.organizationId }, "cachedPrompt:version:miss");
    const version = await versionService.getVersion(ctx, promptName, versionId);

    // Cache the result
    await redisCacheService.set<CachedPromptVersion>(
      cacheKey,
      { version, cachedAt: Date.now() },
      { ttlSeconds: PROMPT_CACHE_TTL.runtime }
    );

    return version;
  } catch (error) {
    log.error({ promptName, versionId, organizationId: ctx.organizationId, err: serializeError(error) }, "cachedPrompt:version:error");
    // Fallback to direct DB access on cache error
    return versionService.getVersion(ctx, promptName, versionId);
  }
}

// =============================================================================
// WRITE OPERATIONS WITH CACHE INVALIDATION
// =============================================================================

/**
 * Create a new prompt version with cache invalidation.
 * Invalidates "latest" label cache (and "production" if promoted).
 */
export async function createVersion(
  ctx: PromptServiceContext,
  promptName: string,
  userId: string,
  input: CreateVersionInput
): Promise<PromptVersionResponse> {
  // Create in database first
  const version = await versionService.createVersion(ctx, promptName, userId, input);

  // Invalidate affected caches
  await invalidatePromptCache(ctx, promptName);

  log.info({ promptName, versionId: version.versionId, organizationId: ctx.organizationId }, "cachedPrompt:createVersion:invalidated");

  return version;
}

/**
 * Update version labels with cache invalidation.
 * Important for "production" label promotion.
 */
export async function updateLabels(
  ctx: PromptServiceContext,
  promptName: string,
  versionId: string,
  input: UpdateLabelsInput
): Promise<PromptVersionResponse> {
  // Update in database first
  const version = await versionService.updateLabels(ctx, promptName, versionId, input);

  // Invalidate affected caches (all labels for this prompt)
  await invalidatePromptCache(ctx, promptName);

  log.info({ promptName, versionId, labels: input.labels, organizationId: ctx.organizationId }, "cachedPrompt:updateLabels:invalidated");

  return version;
}

/**
 * Delete a prompt version with cache invalidation.
 */
export async function deleteVersion(
  ctx: PromptServiceContext,
  promptName: string,
  versionId: string
): Promise<void> {
  // Delete from database first
  await versionService.deleteVersion(ctx, promptName, versionId);

  // Invalidate affected caches
  await invalidatePromptCache(ctx, promptName);

  log.info({ promptName, versionId, organizationId: ctx.organizationId }, "cachedPrompt:deleteVersion:invalidated");
}

// =============================================================================
// CACHE INVALIDATION
// =============================================================================

/**
 * Invalidate all cached versions for a prompt.
 * Called on any write operation to ensure consistency.
 */
export async function invalidatePromptCache(ctx: PromptServiceContext, promptName: string): Promise<void> {
  try {
    const pattern = PROMPT_CACHE_KEYS.pattern(ctx.organizationId, promptName);
    await redisCacheService.deletePattern(pattern);
    log.debug({ organizationId: ctx.organizationId, promptName, pattern }, "cachedPrompt:invalidated");
  } catch (error) {
    log.error({ organizationId: ctx.organizationId, promptName, err: serializeError(error) }, "cachedPrompt:invalidate:error");
    // Swallow error - cache invalidation failure is non-critical
  }
}

/**
 * Invalidate all cached prompts for an organization.
 * Called when organization settings change or for cache reset.
 */
export async function invalidateOrganizationPromptCache(ctx: PromptServiceContext): Promise<void> {
  try {
    const pattern = `prompt:${ctx.organizationId}:*`;
    await redisCacheService.deletePattern(pattern);
    log.info({ organizationId: ctx.organizationId }, "cachedPrompt:orgInvalidated");
  } catch (error) {
    log.error({ organizationId: ctx.organizationId, err: serializeError(error) }, "cachedPrompt:orgInvalidate:error");
    // Swallow error
  }
}
