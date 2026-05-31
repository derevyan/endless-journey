/**
 * Variable Service
 *
 * CRUD operations for global, journey, and user-scoped variables.
 * Supports get, set, delete, increment, decrement, push, pop, merge operations.
 *
 * @module modules/variables/services/variable-service
 */

import type { DbClient } from "@journey/db";
import { variables } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import {
  BadRequestError,
  NotFoundError,
  type GlobalVariable,
  type IApiVariableService,
  type JourneyIdOrSlug,
  type JourneyVariable,
  type UserVariable,
  type VariableAction,
  type VariableData,
  type VariableOperation,
  type VariableOperationEventContext,
  type VariableScope,
} from "@journey/schemas";
import { and, desc, eq } from "drizzle-orm";

import { verifyJourneyOrganization } from "../../../lib/verification";
import { isRecord } from "../../../lib/type-guards";
import type { IEventPublisher } from "../../../services/interfaces";

const log = createLogger("variable-service");

// =============================================================================
// TYPES
// =============================================================================

export type VariableOperationContext = VariableOperationEventContext;

type VariableRow = typeof variables.$inferSelect;

interface VariableRecord {
  key: string;
  value: unknown;
}

function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toVariableData(row: VariableRow): VariableData {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    description: row.description ?? null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function toGlobalVariable(row: VariableRow): GlobalVariable {
  return { ...toVariableData(row), organizationId: row.ownerId };
}

function toJourneyVariable(row: VariableRow): JourneyVariable {
  return { ...toVariableData(row), journeyId: row.ownerId };
}

function toUserVariable(row: VariableRow): UserVariable {
  return { ...toVariableData(row), clientId: row.ownerId };
}

async function getVariablesByScope(
  dbClient: DbClient,
  scope: VariableScope,
  ownerId: string
): Promise<VariableRow[]> {
  return dbClient
    .select()
    .from(variables)
    .where(and(eq(variables.scope, scope), eq(variables.ownerId, ownerId)))
    .orderBy(desc(variables.updatedAt));
}

async function getVariableByScope(
  dbClient: DbClient,
  scope: VariableScope,
  ownerId: string,
  key: string
): Promise<VariableRow | null> {
  const results = await dbClient
    .select()
    .from(variables)
    .where(and(eq(variables.scope, scope), eq(variables.ownerId, ownerId), eq(variables.key, key)));

  return results[0] ?? null;
}

async function setVariableByScopeInternal(
  dbClient: DbClient,
  organizationId: string,
  scope: VariableScope,
  ownerId: string,
  key: string,
  value: unknown,
  description?: string
): Promise<VariableRow> {
  const existing = await getVariableByScope(dbClient, scope, ownerId, key);

  if (existing) {
    const [updated] = await dbClient
      .update(variables)
      .set({
        value,
        description: description ?? existing.description,
        updatedAt: new Date(),
      })
      .where(eq(variables.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await dbClient
    .insert(variables)
    .values({
      organizationId,
      scope,
      ownerId,
      key,
      value,
      description: description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

async function deleteVariableByScopeInternal(
  dbClient: DbClient,
  scope: VariableScope,
  ownerId: string,
  key: string
): Promise<boolean> {
  const result = await dbClient
    .delete(variables)
    .where(and(eq(variables.scope, scope), eq(variables.ownerId, ownerId), eq(variables.key, key)))
    .returning({ id: variables.id });

  return result.length > 0;
}

// =============================================================================
// SCOPE HELPERS
// =============================================================================

interface ScopeLogLabels {
  list: string;
  listError: string;
  get: string;
  getError: string;
  set: string;
  setError: string;
  delete: string;
  deleteError: string;
}

const globalLogLabels: ScopeLogLabels = {
  list: "variableService:getGlobalVariables",
  listError: "variableService:getGlobalVariables:error",
  get: "variableService:getGlobalVariable",
  getError: "variableService:getGlobalVariable:error",
  set: "variableService:setGlobalVariable",
  setError: "variableService:setGlobalVariable:error",
  delete: "variableService:deleteGlobalVariable",
  deleteError: "variableService:deleteGlobalVariable:error",
};

const journeyLogLabels: ScopeLogLabels = {
  list: "variableService:getJourneyVariables",
  listError: "variableService:getJourneyVariables:error",
  get: "variableService:getJourneyVariable",
  getError: "variableService:getJourneyVariable:error",
  set: "variableService:setJourneyVariable",
  setError: "variableService:setJourneyVariable:error",
  delete: "variableService:deleteJourneyVariable",
  deleteError: "variableService:deleteJourneyVariable:error",
};

const userLogLabels: ScopeLogLabels = {
  list: "variableService:getUserVariables",
  listError: "variableService:getUserVariables:error",
  get: "variableService:getUserVariable",
  getError: "variableService:getUserVariable:error",
  set: "variableService:setUserVariable",
  setError: "variableService:setUserVariable:error",
  delete: "variableService:deleteUserVariable",
  deleteError: "variableService:deleteUserVariable:error",
};

async function getVariablesForScope<T extends VariableRecord>(
  dbClient: DbClient,
  scope: VariableScope,
  ownerId: string,
  mapRecord: (row: VariableRow) => T,
  logContext: Record<string, unknown>,
  logLabels: ScopeLogLabels
): Promise<T[]> {
  try {
    const records = await getVariablesByScope(dbClient, scope, ownerId);
    log.debug({ ...logContext, count: records.length }, logLabels.list);
    return records.map(mapRecord);
  } catch (error) {
    log.error({ ...logContext, err: serializeError(error) }, logLabels.listError);
    throw error;
  }
}

async function getVariableForScope<T extends VariableRecord>(
  dbClient: DbClient,
  scope: VariableScope,
  ownerId: string,
  key: string,
  mapRecord: (row: VariableRow) => T,
  logContext: Record<string, unknown>,
  logLabels: ScopeLogLabels
): Promise<T | null> {
  try {
    const record = await getVariableByScope(dbClient, scope, ownerId, key);
    if (!record) {
      return null;
    }
    log.debug(logContext, logLabels.get);
    return mapRecord(record);
  } catch (error) {
    log.error({ ...logContext, err: serializeError(error) }, logLabels.getError);
    throw error;
  }
}

async function setVariableForScope<T extends VariableRecord>(
  dbClient: DbClient,
  organizationId: string,
  scope: VariableScope,
  ownerId: string,
  key: string,
  value: unknown,
  description: string | undefined,
  mapRecord: (row: VariableRow) => T,
  logContext: Record<string, unknown>,
  logLabels: ScopeLogLabels
): Promise<T> {
  try {
    const record = await setVariableByScopeInternal(dbClient, organizationId, scope, ownerId, key, value, description);
    log.info(logContext, logLabels.set);
    return mapRecord(record);
  } catch (error) {
    log.error({ ...logContext, err: serializeError(error) }, logLabels.setError);
    throw error;
  }
}

async function deleteVariableForScope(
  dbClient: DbClient,
  scope: VariableScope,
  ownerId: string,
  key: string,
  logContext: Record<string, unknown>,
  logLabels: ScopeLogLabels
): Promise<boolean> {
  try {
    const result = await deleteVariableByScopeInternal(dbClient, scope, ownerId, key);
    log.info(logContext, logLabels.delete);
    return result;
  } catch (error) {
    log.error({ ...logContext, err: serializeError(error) }, logLabels.deleteError);
    throw error;
  }
}

// =============================================================================
// SERVICE
// =============================================================================

export class ApiVariableService implements IApiVariableService {
  public readonly organizationId: string;

  constructor(
    private readonly db: DbClient,
    organizationId: string,
    private readonly publisher: IEventPublisher
  ) {
    this.organizationId = organizationId;
  }

  // =========================================================================
  // IVariableService
  // =========================================================================

  async getAll(scope: VariableScope): Promise<Record<string, unknown>> {
    const scopeId = this.resolveScopeId(scope);
    return this.getVariablesAsMap(scope, scopeId);
  }

  async executeAction(action: VariableAction): Promise<void> {
    const journeyOps = action.journeyOperations ?? [];
    const globalOps = action.globalOperations ?? [];
    const userOps = action.userOperations ?? [];

    if (journeyOps.length > 0) {
      throw new BadRequestError("journeyId is required for journey scope");
    }

    if (userOps.length > 0) {
      throw new BadRequestError("userId is required for user scope");
    }

    if (globalOps.length === 0) {
      return;
    }

    await this.executeOperations("global", this.organizationId, globalOps);
  }

  async getValue(scope: VariableScope, key: string): Promise<unknown> {
    const scopeId = this.resolveScopeId(scope);
    return this.getVariableValue(scope, scopeId, key);
  }

  async setValue(scope: VariableScope, key: string, value: unknown): Promise<void> {
    const scopeId = this.resolveScopeId(scope);
    await this.setVariableByScope(scope, scopeId, key, value);
  }

  async executeOperation(scope: VariableScope, operation: VariableOperation): Promise<void> {
    const scopeId = this.resolveScopeId(scope);
    await this.executeSingleOperation(scope, scopeId, operation);
  }

  async delete(scope: VariableScope, key: string): Promise<void> {
    const scopeId = this.resolveScopeId(scope);
    await this.deleteVariableByScope(scope, scopeId, key);
  }

  async exists(scope: VariableScope, key: string): Promise<boolean> {
    const scopeId = this.resolveScopeId(scope);
    const value = await this.getVariableValue(scope, scopeId, key);
    return value !== undefined;
  }

  // =========================================================================
  // API METHODS
  // =========================================================================

  async getGlobalVariables(): Promise<GlobalVariable[]> {
    return getVariablesForScope(
      this.db,
      "global",
      this.organizationId,
      toGlobalVariable,
      { organizationId: this.organizationId },
      globalLogLabels
    );
  }

  async getGlobalVariable(key: string): Promise<GlobalVariable | null> {
    return getVariableForScope(
      this.db,
      "global",
      this.organizationId,
      key,
      toGlobalVariable,
      { organizationId: this.organizationId, key },
      globalLogLabels
    );
  }

  async setGlobalVariable(key: string, value: unknown, description?: string): Promise<GlobalVariable> {
    return setVariableForScope(
      this.db,
      this.organizationId,
      "global",
      this.organizationId,
      key,
      value,
      description,
      toGlobalVariable,
      { organizationId: this.organizationId, key },
      globalLogLabels
    );
  }

  async deleteGlobalVariable(key: string): Promise<boolean> {
    return deleteVariableForScope(
      this.db,
      "global",
      this.organizationId,
      key,
      { organizationId: this.organizationId, key },
      globalLogLabels
    );
  }

  async getJourneyVariables(journeyId: JourneyIdOrSlug): Promise<JourneyVariable[]> {
    const resolvedJourneyId = await this.resolveJourneyId(journeyId);

    return this.getJourneyVariablesById(resolvedJourneyId);
  }

  async getJourneyVariable(journeyId: JourneyIdOrSlug, key: string): Promise<JourneyVariable | null> {
    const resolvedJourneyId = await this.resolveJourneyId(journeyId);

    return this.getJourneyVariableById(resolvedJourneyId, key);
  }

  async setJourneyVariable(
    journeyId: JourneyIdOrSlug,
    key: string,
    value: unknown,
    description?: string
  ): Promise<JourneyVariable> {
    const resolvedJourneyId = await this.resolveJourneyId(journeyId);

    return this.setJourneyVariableById(resolvedJourneyId, key, value, description);
  }

  async deleteJourneyVariable(journeyId: JourneyIdOrSlug, key: string): Promise<boolean> {
    const resolvedJourneyId = await this.resolveJourneyId(journeyId);

    return this.deleteJourneyVariableById(resolvedJourneyId, key);
  }

  protected async getJourneyVariablesById(journeyId: string): Promise<JourneyVariable[]> {
    return getVariablesForScope(
      this.db,
      "journey",
      journeyId,
      toJourneyVariable,
      { organizationId: this.organizationId, journeyId },
      journeyLogLabels
    );
  }

  protected async getJourneyVariableById(journeyId: string, key: string): Promise<JourneyVariable | null> {
    return getVariableForScope(
      this.db,
      "journey",
      journeyId,
      key,
      toJourneyVariable,
      { organizationId: this.organizationId, journeyId, key },
      journeyLogLabels
    );
  }

  protected async setJourneyVariableById(
    journeyId: string,
    key: string,
    value: unknown,
    description?: string
  ): Promise<JourneyVariable> {
    return setVariableForScope(
      this.db,
      this.organizationId,
      "journey",
      journeyId,
      key,
      value,
      description,
      toJourneyVariable,
      { organizationId: this.organizationId, journeyId, key },
      journeyLogLabels
    );
  }

  protected async deleteJourneyVariableById(journeyId: string, key: string): Promise<boolean> {
    return deleteVariableForScope(
      this.db,
      "journey",
      journeyId,
      key,
      { organizationId: this.organizationId, journeyId, key },
      journeyLogLabels
    );
  }

  async getUserVariables(clientId: string): Promise<UserVariable[]> {
    return getVariablesForScope(
      this.db,
      "user",
      clientId,
      toUserVariable,
      { organizationId: this.organizationId, clientId },
      userLogLabels
    );
  }

  async getUserVariable(clientId: string, key: string): Promise<UserVariable | null> {
    return getVariableForScope(
      this.db,
      "user",
      clientId,
      key,
      toUserVariable,
      { organizationId: this.organizationId, clientId, key },
      userLogLabels
    );
  }

  async setUserVariable(clientId: string, key: string, value: unknown, description?: string): Promise<UserVariable> {
    return setVariableForScope(
      this.db,
      this.organizationId,
      "user",
      clientId,
      key,
      value,
      description,
      toUserVariable,
      { organizationId: this.organizationId, clientId, key },
      userLogLabels
    );
  }

  async deleteUserVariable(clientId: string, key: string): Promise<boolean> {
    return deleteVariableForScope(
      this.db,
      "user",
      clientId,
      key,
      { organizationId: this.organizationId, clientId, key },
      userLogLabels
    );
  }

  async executeOperations(
    scope: VariableScope,
    scopeId: string,
    operations: VariableOperation[],
    context?: VariableOperationEventContext
  ): Promise<void> {
    for (const operation of operations) {
      await this.executeSingleOperation(scope, scopeId, operation, context);
    }
  }

  async getVariablesAsMap(scope: VariableScope, scopeId: string): Promise<Record<string, unknown>> {
    let variablesByScope: VariableRecord[] = [];

    if (scope === "global") {
      variablesByScope = await this.getGlobalVariables();
    } else if (scope === "user") {
      variablesByScope = await this.getUserVariables(scopeId);
    } else {
      variablesByScope = await this.getJourneyVariablesById(scopeId);
    }

    const map: Record<string, unknown> = {};
    for (const variable of variablesByScope) {
      map[variable.key] = variable.value;
    }

    return map;
  }

  async getVariableValue(scope: VariableScope, scopeId: string, key: string): Promise<unknown> {
    if (scope === "global") {
      const variable = await this.getGlobalVariable(key);
      return variable?.value;
    }

    if (scope === "user") {
      const variable = await this.getUserVariable(scopeId, key);
      return variable?.value;
    }

    const variable = await this.getJourneyVariableById(scopeId, key);
    return variable?.value;
  }

  // =========================================================================
  // INTERNAL HELPERS
  // =========================================================================

  private resolveScopeId(scope: VariableScope): string {
    if (scope === "global") {
      return this.organizationId;
    }

    throw new BadRequestError("scopeId required for non-global scope");
  }

  protected async resolveJourneyId(journeyId: JourneyIdOrSlug): Promise<string> {
    const resolvedJourneyId = await verifyJourneyOrganization(journeyId, this.organizationId, this.db);
    if (!resolvedJourneyId) {
      throw new NotFoundError("Journey", journeyId);
    }

    return resolvedJourneyId;
  }

  private async setVariableByScope(
    scope: VariableScope,
    scopeId: string,
    key: string,
    value: unknown
  ): Promise<void> {
    if (scope === "global") {
      await this.setGlobalVariable(key, value);
      return;
    }

    if (scope === "user") {
      await this.setUserVariable(scopeId, key, value);
      return;
    }

    await this.setJourneyVariableById(scopeId, key, value);
  }

  private async deleteVariableByScope(scope: VariableScope, scopeId: string, key: string): Promise<void> {
    if (scope === "global") {
      await this.deleteGlobalVariable(key);
      return;
    }

    if (scope === "user") {
      await this.deleteUserVariable(scopeId, key);
      return;
    }

    await this.deleteJourneyVariableById(scopeId, key);
  }

  private async executeSingleOperation(
    scope: VariableScope,
    scopeId: string,
    operation: VariableOperation,
    eventContext?: VariableOperationEventContext
  ): Promise<void> {
    const { op, key } = operation;

    let previousValue: unknown = undefined;
    let newValue: unknown = undefined;

    try {
      const current = await this.getVariableForScope(scope, scopeId, key);
      previousValue = current?.value;

      switch (op) {
        case "set": {
          newValue = operation.value;
          await this.setVariableByScope(scope, scopeId, key, newValue);
          break;
        }

        case "delete": {
          newValue = undefined;
          await this.deleteVariableByScope(scope, scopeId, key);
          break;
        }

        case "increment": {
          const amount = operation.amount ?? 1;
          const currentValue = typeof previousValue === "number" ? previousValue : 0;
          newValue = currentValue + amount;
          await this.setVariableByScope(scope, scopeId, key, newValue);
          break;
        }

        case "decrement": {
          const amount = operation.amount ?? 1;
          const currentValue = typeof previousValue === "number" ? previousValue : 0;
          newValue = currentValue - amount;
          await this.setVariableByScope(scope, scopeId, key, newValue);
          break;
        }

        case "push": {
          const currentArray = Array.isArray(previousValue) ? previousValue : [];
          newValue = [...currentArray, operation.value];
          await this.setVariableByScope(scope, scopeId, key, newValue);
          break;
        }

        case "pop": {
          if (Array.isArray(previousValue) && previousValue.length > 0) {
            newValue = previousValue.slice(0, -1);
            await this.setVariableByScope(scope, scopeId, key, newValue);
          } else {
            newValue = previousValue;
          }
          break;
        }

        case "merge": {
          const currentObj = isRecord(previousValue) ? previousValue : {};
          newValue = { ...currentObj, ...operation.value };
          await this.setVariableByScope(scope, scopeId, key, newValue);
          break;
        }
      }

      if (eventContext?.organizationId && newValue !== previousValue) {
        await this.publisher.variable.changed(
          {
            organizationId: eventContext.organizationId,
            clientId: eventContext.clientId ?? "",
            sessionId: eventContext.sessionId ?? "",
            journeyId: eventContext.journeyId ?? "",
            triggeredBy: eventContext.triggeredBy,
            performedBy: eventContext.performedBy ?? "system",
          },
          { key, value: newValue, previousValue, scope, scopeId }
        );
      }

      log.debug({ scope, scopeId, op, key }, "variableService:executeOperation");
    } catch (error) {
      log.error({ scope, scopeId, op, key, err: serializeError(error) }, "variableService:executeOperation:error");
      throw error;
    }
  }

  private async getVariableForScope(
    scope: VariableScope,
    scopeId: string,
    key: string
  ): Promise<VariableRecord | null> {
    if (scope === "global") {
      return this.getGlobalVariable(key);
    }

    if (scope === "user") {
      return this.getUserVariable(scopeId, key);
    }

    return this.getJourneyVariableById(scopeId, key);
  }
}
