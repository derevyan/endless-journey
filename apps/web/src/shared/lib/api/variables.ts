/**
 * Variables API
 *
 * Operations for global and journey variables.
 *
 * @module lib/api/variables
 */

import { serializeError } from "@journey/logger";
import type { VariableOperation, VariableScope } from "@journey/schemas";
import { apiUrl, authFetch, authFetchRaw, log } from "./base";
import type { GlobalVariable, JourneyVariable } from "./types";

export const variablesApi = {
  /**
   * Get all global variables for the organization
   */
  async getGlobalVariables(): Promise<GlobalVariable[]> {
    const data = await authFetch<{ variables: GlobalVariable[] }>(`${apiUrl}/api/variables/global`, undefined, { action: "getGlobalVariables" });

    log.debug({ count: data.variables?.length }, "apiClient:getGlobalVariables:success");
    return data.variables || [];
  },

  /**
   * Get a single global variable by key
   */
  async getGlobalVariable(key: string): Promise<GlobalVariable | null> {
    const res = await authFetchRaw(`${apiUrl}/api/variables/global/${encodeURIComponent(key)}`, undefined, {
      action: "getGlobalVariable",
      logContext: { key },
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const error = new Error(`Failed to fetch global variable: ${res.status}`);
      log.error({ key, status: res.status, err: serializeError(error) }, "apiClient:getGlobalVariable:error");
      throw error;
    }

    const data = await res.json();
    return data.variable;
  },

  /**
   * Set a global variable
   */
  async setGlobalVariable(key: string, value: unknown, description?: string): Promise<GlobalVariable> {
    const data = await authFetch<{ variable: GlobalVariable }>(
      `${apiUrl}/api/variables/global/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, description }),
      },
      { action: "setGlobalVariable", logContext: { key } }
    );

    log.info({ key }, "apiClient:setGlobalVariable:success");
    return data.variable;
  },

  /**
   * Delete a global variable
   */
  async deleteGlobalVariable(key: string): Promise<void> {
    const res = await authFetchRaw(
      `${apiUrl}/api/variables/global/${encodeURIComponent(key)}`,
      { method: "DELETE" },
      { action: "deleteGlobalVariable", logContext: { key } }
    );

    if (res.status === 404) {
      log.warn({ key }, "apiClient:deleteGlobalVariable:notFound");
      throw new Error("Variable not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete global variable: ${res.status}`);
      log.error({ key, status: res.status, err: serializeError(error) }, "apiClient:deleteGlobalVariable:error");
      throw error;
    }

    log.info({ key }, "apiClient:deleteGlobalVariable:success");
  },

  /**
   * Get all journey variables
   */
  async getJourneyVariables(journeyId: string): Promise<JourneyVariable[]> {
    const data = await authFetch<{ variables: JourneyVariable[] }>(`${apiUrl}/api/variables/journey/${journeyId}`, undefined, {
      action: "getJourneyVariables",
      logContext: { journeyId },
    });

    log.debug({ journeyId, count: data.variables?.length }, "apiClient:getJourneyVariables:success");
    return data.variables || [];
  },

  /**
   * Get a single journey variable by key
   */
  async getJourneyVariable(journeyId: string, key: string): Promise<JourneyVariable | null> {
    const res = await authFetchRaw(`${apiUrl}/api/variables/journey/${journeyId}/${encodeURIComponent(key)}`, undefined, {
      action: "getJourneyVariable",
      logContext: { journeyId, key },
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const error = new Error(`Failed to fetch journey variable: ${res.status}`);
      log.error({ journeyId, key, status: res.status, err: serializeError(error) }, "apiClient:getJourneyVariable:error");
      throw error;
    }

    const data = await res.json();
    return data.variable;
  },

  /**
   * Set a journey variable
   */
  async setJourneyVariable(journeyId: string, key: string, value: unknown, description?: string): Promise<JourneyVariable> {
    const data = await authFetch<{ variable: JourneyVariable }>(
      `${apiUrl}/api/variables/journey/${journeyId}/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, description }),
      },
      { action: "setJourneyVariable", logContext: { journeyId, key } }
    );

    log.info({ journeyId, key }, "apiClient:setJourneyVariable:success");
    return data.variable;
  },

  /**
   * Delete a journey variable
   */
  async deleteJourneyVariable(journeyId: string, key: string): Promise<void> {
    const res = await authFetchRaw(
      `${apiUrl}/api/variables/journey/${journeyId}/${encodeURIComponent(key)}`,
      { method: "DELETE" },
      { action: "deleteJourneyVariable", logContext: { journeyId, key } }
    );

    if (res.status === 404) {
      log.warn({ journeyId, key }, "apiClient:deleteJourneyVariable:notFound");
      throw new Error("Variable not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete journey variable: ${res.status}`);
      log.error({ journeyId, key, status: res.status, err: serializeError(error) }, "apiClient:deleteJourneyVariable:error");
      throw error;
    }

    log.info({ journeyId, key }, "apiClient:deleteJourneyVariable:success");
  },

  /**
   * Execute variable operations (for engine use)
   */
  async executeVariableOperations(scope: VariableScope, operations: VariableOperation[], journeyId?: string, organizationId?: string): Promise<void> {
    await authFetch<{ success: boolean }>(
      `${apiUrl}/api/variables/execute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, operations, journeyId, organizationId }),
      },
      { action: "executeVariableOperations", logContext: { scope, operationCount: operations.length } }
    );

    log.info({ scope, operationCount: operations.length }, "apiClient:executeVariableOperations:success");
  },
};
