/**
 * CRM API
 *
 * Operations for CRM pipeline, stages, custom fields, and messaging.
 *
 * @module lib/api/crm
 */

import { serializeError } from "@journey/logger";
import { apiUrl, authFetch, authFetchRaw, log } from "./base";

// =============================================================================
// TYPES - Re-exported from @journey/schemas
// =============================================================================

export type {
  // Pipeline types
  Pipeline,
  PipelineWithStageCount,
  CreatePipelineInput,
  UpdatePipelineInput,
  // Stage types
  PipelineStage,
  PipelineStageWithCount,
  CreateStageInput,
  UpdateStageInput,
  // Field types
  CustomFieldDefinition,
  CreateFieldInput,
  UpdateFieldInput,
  FieldValidation,
  FieldType,
  // Client types
  CrmClient,
  CrmClientProfile,
  ClientFilters,
  ClientStageInfo,
  ClientFieldValue,
  // Messaging types
  DirectMessage,
  SendMessageInput,
  MessageStatus,
  // Activity types
  ActivityEntry,
  ActivitySource,
} from "@journey/schemas";

import type {
  Pipeline,
  PipelineWithStageCount,
  CreatePipelineInput,
  UpdatePipelineInput,
  PipelineStage,
  PipelineStageWithCount,
  CreateStageInput,
  UpdateStageInput,
  CustomFieldDefinition,
  CreateFieldInput,
  UpdateFieldInput,
  CrmClient,
  CrmClientProfile,
  ClientFilters,
  DirectMessage,
  SendMessageInput,
  ActivityEntry,
} from "@journey/schemas";

// =============================================================================
// PIPELINES API
// =============================================================================

export const crmPipelinesApi = {
  async getPipelines(): Promise<PipelineWithStageCount[]> {
    const data = await authFetch<{ pipelines: PipelineWithStageCount[] }>(
      `${apiUrl}/api/crm/pipelines`,
      undefined,
      { action: "getPipelines" }
    );
    return data.pipelines || [];
  },

  async getPipeline(pipelineId: string): Promise<Pipeline> {
    const data = await authFetch<{ pipeline: Pipeline }>(
      `${apiUrl}/api/crm/pipelines/${pipelineId}`,
      undefined,
      { action: "getPipeline", logContext: { pipelineId } }
    );
    return data.pipeline;
  },

  async createPipeline(input: CreatePipelineInput): Promise<Pipeline> {
    const data = await authFetch<{ pipeline: Pipeline }>(
      `${apiUrl}/api/crm/pipelines`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "createPipeline", logContext: { name: input.name } }
    );
    log.info({ name: input.name }, "apiClient:createPipeline:success");
    return data.pipeline;
  },

  async updatePipeline(pipelineId: string, input: UpdatePipelineInput): Promise<Pipeline> {
    const res = await authFetchRaw(
      `${apiUrl}/api/crm/pipelines/${pipelineId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "updatePipeline", logContext: { pipelineId } }
    );

    if (res.status === 404) {
      throw new Error("Pipeline not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to update pipeline: ${res.status}`);
      log.error({ pipelineId, status: res.status, err: serializeError(error) }, "apiClient:updatePipeline:error");
      throw error;
    }

    const data = await res.json();
    log.info({ pipelineId }, "apiClient:updatePipeline:success");
    return data.pipeline;
  },

  async deletePipeline(pipelineId: string): Promise<void> {
    const res = await authFetchRaw(
      `${apiUrl}/api/crm/pipelines/${pipelineId}`,
      { method: "DELETE" },
      { action: "deletePipeline", logContext: { pipelineId } }
    );

    if (res.status === 404) {
      throw new Error("Pipeline not found");
    }

    if (!res.ok) {
      const errorBody = await res.text();
      const error = new Error(`Failed to delete pipeline: ${errorBody || res.status}`);
      log.error({ pipelineId, status: res.status, err: serializeError(error) }, "apiClient:deletePipeline:error");
      throw error;
    }

    log.info({ pipelineId }, "apiClient:deletePipeline:success");
  },

  async reorderPipelines(pipelineIds: string[]): Promise<void> {
    await authFetch<{ success: boolean }>(
      `${apiUrl}/api/crm/pipelines/reorder`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineIds }),
      },
      { action: "reorderPipelines" }
    );
    log.info({ count: pipelineIds.length }, "apiClient:reorderPipelines:success");
  },

  async setDefaultPipeline(pipelineId: string): Promise<void> {
    await authFetch<{ success: boolean }>(
      `${apiUrl}/api/crm/pipelines/${pipelineId}/default`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      },
      { action: "setDefaultPipeline", logContext: { pipelineId } }
    );
    log.info({ pipelineId }, "apiClient:setDefaultPipeline:success");
  },
};

// =============================================================================
// STAGES API
// =============================================================================

export const crmStagesApi = {
  async getStages(pipelineId?: string): Promise<PipelineStageWithCount[]> {
    const params = new URLSearchParams();
    if (pipelineId) {
      params.set("pipelineId", pipelineId);
    }

    const url = pipelineId
      ? `${apiUrl}/api/crm/stages?${params.toString()}`
      : `${apiUrl}/api/crm/stages`;

    const data = await authFetch<{ stages: PipelineStageWithCount[] }>(
      url,
      undefined,
      { action: "getStages", logContext: { pipelineId } }
    );
    return data.stages || [];
  },

  async createStage(input: CreateStageInput): Promise<PipelineStage> {
    const data = await authFetch<{ stage: PipelineStage }>(
      `${apiUrl}/api/crm/stages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "createStage", logContext: { name: input.name } }
    );
    log.info({ name: input.name }, "apiClient:createStage:success");
    return data.stage;
  },

  async updateStage(stageId: string, input: UpdateStageInput): Promise<PipelineStage> {
    const res = await authFetchRaw(
      `${apiUrl}/api/crm/stages/${stageId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "updateStage", logContext: { stageId } }
    );

    if (res.status === 404) {
      throw new Error("Stage not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to update stage: ${res.status}`);
      log.error({ stageId, status: res.status, err: serializeError(error) }, "apiClient:updateStage:error");
      throw error;
    }

    const data = await res.json();
    log.info({ stageId }, "apiClient:updateStage:success");
    return data.stage;
  },

  async deleteStage(stageId: string): Promise<void> {
    const res = await authFetchRaw(
      `${apiUrl}/api/crm/stages/${stageId}`,
      { method: "DELETE" },
      { action: "deleteStage", logContext: { stageId } }
    );

    if (res.status === 404) {
      throw new Error("Stage not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete stage: ${res.status}`);
      log.error({ stageId, status: res.status, err: serializeError(error) }, "apiClient:deleteStage:error");
      throw error;
    }

    log.info({ stageId }, "apiClient:deleteStage:success");
  },

  async reorderStages(pipelineId: string, stageIds: string[]): Promise<void> {
    await authFetch<{ success: boolean }>(
      `${apiUrl}/api/crm/stages/reorder`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId, stageIds }),
      },
      { action: "reorderStages", logContext: { pipelineId } }
    );
    log.info({ pipelineId, count: stageIds.length }, "apiClient:reorderStages:success");
  },
};

// =============================================================================
// CUSTOM FIELDS API
// =============================================================================

export const crmFieldsApi = {
  async getFields(): Promise<CustomFieldDefinition[]> {
    const data = await authFetch<{ fields: CustomFieldDefinition[] }>(
      `${apiUrl}/api/crm/fields`,
      undefined,
      { action: "getFields" }
    );
    return data.fields || [];
  },

  async createField(input: CreateFieldInput): Promise<CustomFieldDefinition> {
    const data = await authFetch<{ field: CustomFieldDefinition }>(
      `${apiUrl}/api/crm/fields`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "createField", logContext: { name: input.name, key: input.key } }
    );
    log.info({ name: input.name }, "apiClient:createField:success");
    return data.field;
  },

  async updateField(fieldId: string, input: UpdateFieldInput): Promise<CustomFieldDefinition> {
    const res = await authFetchRaw(
      `${apiUrl}/api/crm/fields/${fieldId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "updateField", logContext: { fieldId } }
    );

    if (res.status === 404) {
      throw new Error("Field not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to update field: ${res.status}`);
      log.error({ fieldId, status: res.status, err: serializeError(error) }, "apiClient:updateField:error");
      throw error;
    }

    const data = await res.json();
    log.info({ fieldId }, "apiClient:updateField:success");
    return data.field;
  },

  async deleteField(fieldId: string): Promise<void> {
    const res = await authFetchRaw(
      `${apiUrl}/api/crm/fields/${fieldId}`,
      { method: "DELETE" },
      { action: "deleteField", logContext: { fieldId } }
    );

    if (res.status === 404) {
      throw new Error("Field not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete field: ${res.status}`);
      log.error({ fieldId, status: res.status, err: serializeError(error) }, "apiClient:deleteField:error");
      throw error;
    }

    log.info({ fieldId }, "apiClient:deleteField:success");
  },
};

// =============================================================================
// CLIENTS API
// =============================================================================

export const crmClientsApi = {
  async getClients(
    filters: ClientFilters = {},
    limit = 50,
    offset = 0
  ): Promise<{ clients: CrmClient[]; total: number }> {
    const params = new URLSearchParams();
    // Support both single stageId and stageIds array
    if (filters.stageIds?.length) {
      params.set("stageIds", filters.stageIds.join(","));
    } else if (filters.stageId) {
      params.set("stageId", filters.stageId);
    }
    if (filters.pipelineId) params.set("pipelineId", filters.pipelineId);
    if (filters.journeyId) params.set("journeyId", filters.journeyId);
    if (filters.search) params.set("search", filters.search);
    if (filters.tags?.length) params.set("tags", filters.tags.join(","));
    if (filters.noStage) params.set("noStage", "true");
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    const data = await authFetch<{ clients: CrmClient[]; total: number }>(
      `${apiUrl}/api/crm/clients?${params.toString()}`,
      undefined,
      { action: "getClients", logContext: { filters } }
    );
    return data;
  },

  async getClient(clientId: string): Promise<CrmClientProfile> {
    const data = await authFetch<{ client: CrmClientProfile }>(
      `${apiUrl}/api/crm/clients/${clientId}`,
      undefined,
      { action: "getClient", logContext: { clientId } }
    );
    return data.client;
  },

  async updateClientStage(clientId: string, stageId: string | null): Promise<void> {
    await authFetch<{ success: boolean }>(
      `${apiUrl}/api/crm/clients/${clientId}/stage`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      },
      { action: "updateClientStage", logContext: { clientId, stageId } }
    );
    log.info({ clientId, stageId }, "apiClient:updateClientStage:success");
  },

  async updateClientFields(
    clientId: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    await authFetch<{ success: boolean }>(
      `${apiUrl}/api/crm/clients/${clientId}/fields`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      },
      { action: "updateClientFields", logContext: { clientId } }
    );
    log.info({ clientId }, "apiClient:updateClientFields:success");
  },

  async getClientTimeline(
    clientId: string,
    limit = 50,
    offset = 0
  ): Promise<ActivityEntry[]> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    const data = await authFetch<{ activities: ActivityEntry[] }>(
      `${apiUrl}/api/crm/clients/${clientId}/timeline?${params.toString()}`,
      undefined,
      { action: "getClientTimeline", logContext: { clientId } }
    );
    return data.activities || [];
  },
};

// =============================================================================
// MESSAGES API
// =============================================================================

export const crmMessagesApi = {
  async sendMessage(
    clientId: string,
    input: SendMessageInput
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const data = await authFetch<{ success: boolean; messageId?: string; error?: string }>(
      `${apiUrl}/api/crm/clients/${clientId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "sendMessage", logContext: { clientId } }
    );

    if (data.success) {
      log.info({ clientId, messageId: data.messageId }, "apiClient:sendMessage:success");
    } else {
      log.warn({ clientId, error: data.error }, "apiClient:sendMessage:failed");
    }

    return data;
  },

  async getMessages(clientId: string, limit = 50, offset = 0): Promise<DirectMessage[]> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    const data = await authFetch<{ messages: DirectMessage[] }>(
      `${apiUrl}/api/crm/clients/${clientId}/messages?${params.toString()}`,
      undefined,
      { action: "getMessages", logContext: { clientId } }
    );
    return data.messages || [];
  },
};

// =============================================================================
// CLIENT TAGS API
// =============================================================================

export const crmClientTagsApi = {
  /**
   * Add a tag to a client
   */
  async addTag(clientId: string, tag: string): Promise<{ id: string; tag: string }> {
    const data = await authFetch<{ tag: { id: string; tag: string } }>(
      `${apiUrl}/api/crm/clients/${clientId}/tags`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      },
      { action: "addClientTag", logContext: { clientId, tag } }
    );

    log.info({ clientId, tag }, "apiClient:addClientTag:success");
    return data.tag;
  },

  /**
   * Remove a tag from a client
   */
  async removeTag(clientId: string, tag: string): Promise<void> {
    const res = await authFetchRaw(
      `${apiUrl}/api/crm/clients/${clientId}/tags/${encodeURIComponent(tag)}`,
      { method: "DELETE" },
      { action: "removeClientTag", logContext: { clientId, tag } }
    );

    if (res.status === 404) {
      log.warn({ clientId, tag }, "apiClient:removeClientTag:notFound");
      throw new Error("Tag not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to remove client tag: ${res.status}`);
      log.error({ clientId, tag, status: res.status, err: serializeError(error) }, "apiClient:removeClientTag:error");
      throw error;
    }

    log.info({ clientId, tag }, "apiClient:removeClientTag:success");
  },
};

// =============================================================================
// COMBINED API
// =============================================================================

export const crmApi = {
  pipelines: crmPipelinesApi,
  stages: crmStagesApi,
  fields: crmFieldsApi,
  clients: crmClientsApi,
  messages: crmMessagesApi,
  clientTags: crmClientTagsApi,
};
