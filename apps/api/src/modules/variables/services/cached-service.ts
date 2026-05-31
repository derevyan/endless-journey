/**
 * Cached Variable Service
 *
 * Wraps the variable service with Redis caching for high-frequency reads.
 * Uses cache-aside for reads and write-through invalidation for writes.
 *
 * @module modules/variables/services/cached-service
 */

import { createLogger, serializeError } from "@journey/logger";
import type { JourneyIdOrSlug, VariableOperation, VariableOperationEventContext, VariableScope } from "@journey/schemas";
import { DEFAULT_VARIABLE_CACHE_TTL, VARIABLE_CACHE_KEYS } from "@journey/schemas";
import { redisCacheService } from "../../../services/redis-cache-service";
import { ApiVariableService } from "./variable-service";

const log = createLogger("cached-variable-service");

// =============================================================================
// TYPES
// =============================================================================

interface CachedVariable {
  value: unknown;
  cachedAt: number;
}

interface CachedVariablesMap {
  values: Record<string, unknown>;
  cachedAt: number;
}

// =============================================================================
// CACHED VARIABLE SERVICE
// =============================================================================

export class CachedVariableService extends ApiVariableService {
  async getVariableValue(scope: VariableScope, scopeId: string, key: string): Promise<unknown> {
    const cacheKey = getCacheKey(scope, scopeId, key);

    try {
      const cached = await redisCacheService.get<CachedVariable>(cacheKey);
      if (cached !== null) {
        log.debug({ scope, scopeId, key }, "cachedVariable:hit");
        return cached.value;
      }

      log.debug({ scope, scopeId, key }, "cachedVariable:miss");
      const value = await super.getVariableValue(scope, scopeId, key);

      await redisCacheService.set<CachedVariable>(
        cacheKey,
        { value, cachedAt: Date.now() },
        { ttlSeconds: getTTL(scope) }
      );

      return value;
    } catch (error) {
      log.error({ scope, scopeId, key, err: serializeError(error) }, "cachedVariable:getValue:error");
      return super.getVariableValue(scope, scopeId, key);
    }
  }

  async getVariablesAsMap(scope: VariableScope, scopeId: string): Promise<Record<string, unknown>> {
    const cacheKey = getCacheKeyAll(scope, scopeId);

    try {
      const cached = await redisCacheService.get<CachedVariablesMap>(cacheKey);
      if (cached !== null) {
        log.debug({ scope, scopeId, count: Object.keys(cached.values).length }, "cachedVariable:mapHit");
        return cached.values;
      }

      log.debug({ scope, scopeId }, "cachedVariable:mapMiss");
      const values = await super.getVariablesAsMap(scope, scopeId);

      await redisCacheService.set<CachedVariablesMap>(
        cacheKey,
        { values, cachedAt: Date.now() },
        { ttlSeconds: getTTL(scope) }
      );

      return values;
    } catch (error) {
      log.error({ scope, scopeId, err: serializeError(error) }, "cachedVariable:getVariablesAsMap:error");
      return super.getVariablesAsMap(scope, scopeId);
    }
  }

  async executeOperations(
    scope: VariableScope,
    scopeId: string,
    operations: VariableOperation[],
    context?: VariableOperationEventContext
  ): Promise<void> {
    await super.executeOperations(scope, scopeId, operations, context);
    await invalidateVariableCache(scope, scopeId, operations.map((op) => op.key));
  }

  async setGlobalVariable(key: string, value: unknown, description?: string) {
    const result = await super.setGlobalVariable(key, value, description);
    await invalidateGlobalVariableCache(this.organizationId, key);
    return result;
  }

  async deleteGlobalVariable(key: string): Promise<boolean> {
    const result = await super.deleteGlobalVariable(key);
    await invalidateGlobalVariableCache(this.organizationId, key);
    return result;
  }

  async setJourneyVariable(journeyId: JourneyIdOrSlug, key: string, value: unknown, description?: string) {
    const resolvedJourneyId = await this.resolveJourneyId(journeyId);
    const result = await this.setJourneyVariableById(resolvedJourneyId, key, value, description);
    await invalidateJourneyVariableCache(resolvedJourneyId, key);
    return result;
  }

  async deleteJourneyVariable(journeyId: JourneyIdOrSlug, key: string): Promise<boolean> {
    const resolvedJourneyId = await this.resolveJourneyId(journeyId);
    const result = await this.deleteJourneyVariableById(resolvedJourneyId, key);
    await invalidateJourneyVariableCache(resolvedJourneyId, key);
    return result;
  }

  async setUserVariable(clientId: string, key: string, value: unknown, description?: string) {
    const result = await super.setUserVariable(clientId, key, value, description);
    await invalidateUserVariableCache(clientId, key);
    return result;
  }

  async deleteUserVariable(clientId: string, key: string): Promise<boolean> {
    const result = await super.deleteUserVariable(clientId, key);
    await invalidateUserVariableCache(clientId, key);
    return result;
  }
}

// =============================================================================
// CACHE HELPERS
// =============================================================================

function getTTL(scope: VariableScope): number {
  switch (scope) {
    case "global":
      return DEFAULT_VARIABLE_CACHE_TTL.global;
    case "journey":
      return DEFAULT_VARIABLE_CACHE_TTL.journey;
    case "user":
      return DEFAULT_VARIABLE_CACHE_TTL.user;
  }
}

function getCacheKey(scope: VariableScope, scopeId: string, key: string): string {
  if (scope === "global") {
    return VARIABLE_CACHE_KEYS.global(scopeId, key);
  }

  if (scope === "journey") {
    return VARIABLE_CACHE_KEYS.journey(scopeId, key);
  }

  return VARIABLE_CACHE_KEYS.user(scopeId, key);
}

function getCacheKeyAll(scope: VariableScope, scopeId: string): string {
  if (scope === "global") {
    return VARIABLE_CACHE_KEYS.globalAll(scopeId);
  }

  if (scope === "journey") {
    return VARIABLE_CACHE_KEYS.journeyAll(scopeId);
  }

  return VARIABLE_CACHE_KEYS.userAll(scopeId);
}

async function invalidateVariableCache(scope: VariableScope, scopeId: string, keys: string[]): Promise<void> {
  const keysToDelete = [
    getCacheKeyAll(scope, scopeId),
    ...keys.map((key) => getCacheKey(scope, scopeId, key)),
  ];

  await redisCacheService.deleteMany(keysToDelete);
}

async function invalidateGlobalVariableCache(organizationId: string, key: string): Promise<void> {
  const keysToDelete = [
    VARIABLE_CACHE_KEYS.globalAll(organizationId),
    VARIABLE_CACHE_KEYS.global(organizationId, key),
  ];

  await redisCacheService.deleteMany(keysToDelete);
  log.debug({ organizationId, key }, "cachedVariable:globalCacheInvalidated");
}

async function invalidateJourneyVariableCache(journeyId: string, key: string): Promise<void> {
  const keysToDelete = [
    VARIABLE_CACHE_KEYS.journeyAll(journeyId),
    VARIABLE_CACHE_KEYS.journey(journeyId, key),
  ];

  await redisCacheService.deleteMany(keysToDelete);
  log.debug({ journeyId, key }, "cachedVariable:journeyCacheInvalidated");
}

async function invalidateUserVariableCache(clientId: string, key: string): Promise<void> {
  const keysToDelete = [
    VARIABLE_CACHE_KEYS.userAll(clientId),
    VARIABLE_CACHE_KEYS.user(clientId, key),
  ];

  await redisCacheService.deleteMany(keysToDelete);
  log.debug({ clientId, key }, "cachedVariable:userCacheInvalidated");
}

export async function invalidateJourneyVariables(journeyId: string): Promise<void> {
  await redisCacheService.deletePattern(VARIABLE_CACHE_KEYS.pattern("journey", journeyId));
  log.info({ journeyId }, "cachedVariable:allJourneyCacheInvalidated");
}

export async function invalidateGlobalVariables(organizationId: string): Promise<void> {
  await redisCacheService.deletePattern(VARIABLE_CACHE_KEYS.pattern("global", organizationId));
  log.info({ organizationId }, "cachedVariable:allGlobalCacheInvalidated");
}

export async function invalidateUserVariables(clientId: string): Promise<void> {
  await redisCacheService.deletePattern(VARIABLE_CACHE_KEYS.pattern("user", clientId));
  log.info({ clientId }, "cachedVariable:allUserCacheInvalidated");
}
