/**
 * Mindstate API
 *
 * Operations for mindstate definitions and client mindstates.
 *
 * @module lib/api/mindstate
 */

import { apiUrl, authFetch, authFetchRaw, log } from "./base";
import { serializeError } from "@journey/logger";

// =============================================================================
// TYPES
// =============================================================================

export type {
  MindstateDefinition,
  ClientMindstate,
  StateParameter,
  StateParameterValue,
  SystemAgent,
  AgentInsight,
  StateChange,
  PipelineMetrics,
  AnalysisTrigger,
  CreateMindstateDefinitionInput,
  UpdateMindstateDefinitionInput,
} from "@journey/schemas";

import type {
  MindstateDefinition,
  ClientMindstate,
  StateChange,
  AgentInsight,
  PipelineMetrics,
  AnalysisTrigger,
  StateParameter,
  SystemAgent,
  MainAgent,
  CreateMindstateDefinitionInput,
  UpdateMindstateDefinitionInput,
} from "@journey/schemas";

/** Result from mindstate analysis */
export interface AnalysisResult {
  mindstateId: string;
  changes: StateChange[];
  newInsights: AgentInsight[];
  metrics: PipelineMetrics;
  responseMessage?: string;
}

/** Input for preview analysis (Builder testing mode) */
export interface PreviewAnalysisInput {
  message: string;
  currentState: StateParameter[];
  systemAgents: SystemAgent[];
  mainAgent: MainAgent;
  messageHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

/** Result from preview analysis */
export interface PreviewAnalysisResult {
  response: string;
  insights: AgentInsight[];
  stateChanges: StateChange[];
  updatedState: StateParameter[];
  metrics: PipelineMetrics;
}

/** Entry in the analysis history log */
export interface AnalysisLogEntry {
  id: string;
  trigger: AnalysisTrigger;
  changes: StateChange[];
  newInsights: AgentInsight[];
  metrics: PipelineMetrics | null;
  inputMessage: string | null;
  responseMessage: string | null;
  createdAt: string | null;
}

// Type aliases for convenience (imported from @journey/schemas above)
export type CreateDefinitionInput = CreateMindstateDefinitionInput;
export type UpdateDefinitionInput = UpdateMindstateDefinitionInput;

// =============================================================================
// DEFINITIONS API
// =============================================================================

export const mindstateDefinitionsApi = {
  /**
   * List all mindstate definitions for the organization
   */
  async list(): Promise<MindstateDefinition[]> {
    const data = await authFetch<{ definitions: MindstateDefinition[] }>(
      `${apiUrl}/api/mindstates/definitions`,
      undefined,
      { action: "listMindstateDefinitions" }
    );
    return data.definitions || [];
  },

  /**
   * Get a mindstate definition by key
   */
  async get(key: string): Promise<MindstateDefinition | null> {
    const res = await authFetchRaw(
      `${apiUrl}/api/mindstates/definitions/${key}`,
      undefined,
      { action: "getMindstateDefinition", logContext: { key } }
    );

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const error = new Error(`Failed to get mindstate definition: ${res.status}`);
      log.error({ key, status: res.status, err: serializeError(error) }, "apiClient:getMindstateDefinition:error");
      throw error;
    }

    const data = await res.json();
    return data.definition;
  },

  /**
   * Create a new mindstate definition
   */
  async create(input: CreateDefinitionInput): Promise<MindstateDefinition> {
    const data = await authFetch<{ definition: MindstateDefinition }>(
      `${apiUrl}/api/mindstates/definitions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "createMindstateDefinition", logContext: { key: input.key } }
    );
    log.info({ key: input.key }, "apiClient:createMindstateDefinition:success");
    return data.definition;
  },

  /**
   * Update a mindstate definition
   */
  async update(key: string, input: UpdateDefinitionInput): Promise<MindstateDefinition> {
    const res = await authFetchRaw(
      `${apiUrl}/api/mindstates/definitions/${key}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "updateMindstateDefinition", logContext: { key } }
    );

    if (res.status === 404) {
      throw new Error("Mindstate definition not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to update mindstate definition: ${res.status}`);
      log.error({ key, status: res.status, err: serializeError(error) }, "apiClient:updateMindstateDefinition:error");
      throw error;
    }

    const data = await res.json();
    log.info({ key }, "apiClient:updateMindstateDefinition:success");
    return data.definition;
  },

  /**
   * Delete a mindstate definition
   */
  async delete(key: string): Promise<void> {
    const res = await authFetchRaw(
      `${apiUrl}/api/mindstates/definitions/${key}`,
      { method: "DELETE" },
      { action: "deleteMindstateDefinition", logContext: { key } }
    );

    if (res.status === 404) {
      throw new Error("Mindstate definition not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete mindstate definition: ${res.status}`);
      log.error({ key, status: res.status, err: serializeError(error) }, "apiClient:deleteMindstateDefinition:error");
      throw error;
    }

    log.info({ key }, "apiClient:deleteMindstateDefinition:success");
  },

  /**
   * Run preview analysis (Builder testing mode)
   * Runs the full pipeline without persisting to database
   */
  async previewAnalyze(key: string, input: PreviewAnalysisInput): Promise<PreviewAnalysisResult> {
    const data = await authFetch<{ result: PreviewAnalysisResult }>(
      `${apiUrl}/api/mindstates/definitions/${key}/preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "previewAnalyzeMindstate", logContext: { key } }
    );
    log.info(
      { key, changesCount: data.result.stateChanges.length, insightsCount: data.result.insights.length },
      "apiClient:previewAnalyzeMindstate:success"
    );
    return data.result;
  },
};

// =============================================================================
// CLIENT MINDSTATES API
// =============================================================================

export const mindstateClientsApi = {
  /**
   * List all mindstates for a client
   */
  async list(clientId: string): Promise<ClientMindstate[]> {
    const data = await authFetch<{ mindstates: ClientMindstate[] }>(
      `${apiUrl}/api/mindstates/clients/${clientId}`,
      undefined,
      { action: "listClientMindstates", logContext: { clientId } }
    );
    return data.mindstates || [];
  },

  /**
   * Get a specific mindstate for a client (creates if doesn't exist)
   */
  async get(clientId: string, key: string): Promise<ClientMindstate> {
    const res = await authFetchRaw(
      `${apiUrl}/api/mindstates/clients/${clientId}/${key}`,
      undefined,
      { action: "getClientMindstate", logContext: { clientId, key } }
    );

    if (res.status === 404) {
      const errorData = await res.json().catch(() => ({ error: "Not found" }));
      throw new Error(errorData.error || "Mindstate definition not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to get client mindstate: ${res.status}`);
      log.error({ clientId, key, status: res.status, err: serializeError(error) }, "apiClient:getClientMindstate:error");
      throw error;
    }

    const data = await res.json();
    return data.mindstate;
  },

  /**
   * Trigger manual analysis of a message
   */
  async analyze(
    clientId: string,
    key: string,
    message: string,
    sessionId?: string
  ): Promise<AnalysisResult> {
    const data = await authFetch<{ result: AnalysisResult }>(
      `${apiUrl}/api/mindstates/clients/${clientId}/${key}/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId }),
      },
      { action: "analyzeMindstate", logContext: { clientId, key } }
    );
    log.info({ clientId, key, changesCount: data.result.changes.length }, "apiClient:analyzeMindstate:success");
    return data.result;
  },

  /**
   * Get analysis history for a client's mindstate
   */
  async getHistory(clientId: string, key: string, limit = 50): Promise<AnalysisLogEntry[]> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));

    const data = await authFetch<{ history: AnalysisLogEntry[] }>(
      `${apiUrl}/api/mindstates/clients/${clientId}/${key}/history?${params.toString()}`,
      undefined,
      { action: "getMindstateHistory", logContext: { clientId, key } }
    );
    return data.history || [];
  },
};

// =============================================================================
// COMBINED API
// =============================================================================

export const mindstateApi = {
  definitions: mindstateDefinitionsApi,
  clients: mindstateClientsApi,
};
