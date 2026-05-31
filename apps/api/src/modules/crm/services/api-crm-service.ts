import type { DbClient } from "@journey/db";
import { createLogger, serializeError } from "@journey/logger";
import type {
  ActivityEntry,
  ClientFieldValue,
  ClientFilters,
  ClientStageAssignment,
  CrmClient,
  CrmClientProfile,
  CrmTimelineOptions,
  CreateFieldInput,
  CreatePipelineInput,
  CreateStageInput,
  CustomFieldDefinition,
  DirectMessage,
  IApiCrmService,
  Pipeline,
  PipelineStage,
  PipelineStageWithCount,
  PipelineWithStageCount,
  SendMessageInput,
  SendMessageResult,
  StageHistoryEntry,
  UpdateFieldInput,
  UpdatePipelineInput,
  UpdateStageInput,
  CrmOperationEventContext,
} from "@journey/schemas";
import type { IApiTagService } from "@journey/schemas";

import type { IEventPublisher } from "../../../services/interfaces";
import { getClientTimeline } from "./activity-service";
import { getClientCrmProfile, getCrmClients, getClientsByStages } from "./client-service";
import {
  createDefaultPipeline,
  getPipelines,
  getPipeline,
  getPipelineBySlug,
  getDefaultPipeline,
  ensureDefaultPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  reorderPipelines,
  setDefaultPipeline,
} from "./pipeline-service";
import {
  getPipelineStages,
  getPipelineStageById,
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
  getClientStage,
  getClientStages,
  getClientStageHistory,
  getDefaultStage,
  assignClientToDefaultPipeline,
  assignClientToStage,
  removeClientFromPipeline,
  assignClientToPipeline,
} from "./stage-service";
import {
  getCustomFields,
  getCustomFieldById,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
  getClientFieldValues,
  updateClientFieldValues,
} from "./field-service";
import { sendDirectMessage, getClientMessages } from "./messaging-service";
import type { CrmServiceContext } from "./service-context";

const log = createLogger("api-crm-service");

export class ApiCrmService implements IApiCrmService {
  public readonly organizationId: string;
  private readonly ctx: CrmServiceContext;

  constructor(
    db: DbClient,
    organizationId: string,
    publisher: IEventPublisher,
    tagService: IApiTagService
  ) {
    this.organizationId = organizationId;
    this.ctx = { db, organizationId, publisher, tagService };
  }

  // =========================================================================
  // ICrmService (Engine Compatibility)
  // =========================================================================

  async updateClientPosition(
    clientId: string,
    pipelineId?: string,
    stageId?: string,
    notes?: string
  ): Promise<void> {
    try {
      const resolvedPipelineId =
        pipelineId ?? (await ensureDefaultPipeline(this.ctx)).id;

      if (stageId) {
        await assignClientToStage(
          this.ctx,
          clientId,
          stageId,
          null,
          notes,
          { triggeredBy: "manual" }
        );
        return;
      }

      const existingStage = await getClientStage(this.ctx, clientId, resolvedPipelineId);
      if (!existingStage) {
        await assignClientToPipeline(this.ctx, clientId, resolvedPipelineId, notes);
      }
    } catch (error) {
      log.error({ clientId, err: serializeError(error) }, "crmService:updateClientPosition:error");
      throw error;
    }
  }

  async addToPipeline(
    clientId: string,
    pipelineId?: string,
    stageId?: string,
    notes?: string
  ): Promise<void> {
    try {
      const resolvedPipelineId =
        pipelineId ?? (await ensureDefaultPipeline(this.ctx)).id;

      if (stageId) {
        await assignClientToStage(
          this.ctx,
          clientId,
          stageId,
          null,
          notes,
          { triggeredBy: "manual" }
        );
        return;
      }

      await assignClientToPipeline(this.ctx, clientId, resolvedPipelineId, notes);
    } catch (error) {
      log.error({ clientId, err: serializeError(error) }, "crmService:addToPipeline:error");
      throw error;
    }
  }

  async moveToStage(clientId: string, stageId: string, notes?: string): Promise<void> {
    await assignClientToStage(this.ctx, clientId, stageId, null, notes, { triggeredBy: "manual" });
  }

  async removeFromPipeline(clientId: string, pipelineId: string): Promise<void> {
    await removeClientFromPipeline(this.ctx, clientId, pipelineId, null, { triggeredBy: "manual" });
  }

  async getPipelines(): Promise<PipelineWithStageCount[]> {
    return getPipelines(this.ctx);
  }

  async getStages(pipelineId?: string): Promise<PipelineStage[]> {
    return getPipelineStages(this.ctx, pipelineId);
  }

  async getDefaultPipeline(): Promise<Pipeline | null> {
    return getDefaultPipeline(this.ctx);
  }

  // =========================================================================
  // Pipelines
  // =========================================================================

  async createDefaultPipeline(): Promise<Pipeline> {
    return createDefaultPipeline(this.ctx);
  }

  async getPipeline(pipelineId: string): Promise<Pipeline | null> {
    return getPipeline(this.ctx, pipelineId);
  }

  async getPipelineBySlug(slug: string): Promise<Pipeline | null> {
    return getPipelineBySlug(this.ctx, slug);
  }

  async ensureDefaultPipeline(): Promise<Pipeline> {
    return ensureDefaultPipeline(this.ctx);
  }

  async createPipeline(data: CreatePipelineInput, performedBy?: string): Promise<Pipeline> {
    return createPipeline(this.ctx, data, performedBy);
  }

  async updatePipeline(
    pipelineId: string,
    data: UpdatePipelineInput,
    performedBy?: string
  ): Promise<Pipeline | null> {
    return updatePipeline(this.ctx, pipelineId, data, performedBy);
  }

  async deletePipeline(pipelineId: string, performedBy?: string): Promise<boolean> {
    return deletePipeline(this.ctx, pipelineId, performedBy);
  }

  async reorderPipelines(pipelineIds: string[]): Promise<void> {
    return reorderPipelines(this.ctx, pipelineIds);
  }

  async setDefaultPipeline(pipelineId: string, performedBy?: string): Promise<void> {
    return setDefaultPipeline(this.ctx, pipelineId, performedBy);
  }

  // =========================================================================
  // Stages
  // =========================================================================

  async getPipelineStages(pipelineId?: string): Promise<PipelineStageWithCount[]> {
    return getPipelineStages(this.ctx, pipelineId);
  }

  async getPipelineStageById(stageId: string): Promise<PipelineStage | null> {
    return getPipelineStageById(this.ctx, stageId);
  }

  async createPipelineStage(data: CreateStageInput, performedBy?: string): Promise<PipelineStage> {
    return createPipelineStage(this.ctx, data, performedBy);
  }

  async updatePipelineStage(
    stageId: string,
    data: UpdateStageInput,
    performedBy?: string
  ): Promise<PipelineStage | null> {
    return updatePipelineStage(this.ctx, stageId, data, performedBy);
  }

  async deletePipelineStage(stageId: string, performedBy?: string): Promise<boolean> {
    return deletePipelineStage(this.ctx, stageId, performedBy);
  }

  async reorderPipelineStages(
    pipelineId: string,
    stageIds: string[],
    performedBy?: string
  ): Promise<void> {
    return reorderPipelineStages(this.ctx, pipelineId, stageIds, performedBy);
  }

  async getClientStage(clientId: string, pipelineId?: string): Promise<ClientStageAssignment | null> {
    return getClientStage(this.ctx, clientId, pipelineId);
  }

  async getClientStages(clientId: string): Promise<ClientStageAssignment[]> {
    return getClientStages(this.ctx, clientId);
  }

  async getClientStageHistory(clientId: string, pipelineId?: string): Promise<StageHistoryEntry[]> {
    return getClientStageHistory(this.ctx, clientId, pipelineId);
  }

  async getClientsByStage(stageId: string): Promise<CrmClient[]> {
    const { clients } = await getCrmClients(this.ctx, { stageId }, { limit: 500 });
    return clients;
  }

  async getDefaultStage(pipelineId?: string): Promise<PipelineStage | null> {
    return getDefaultStage(this.ctx, pipelineId);
  }

  async assignClientToDefaultPipeline(clientId: string): Promise<void> {
    return assignClientToDefaultPipeline(this.ctx, clientId);
  }

  async assignClientToStage(
    clientId: string,
    stageId: string,
    assignedBy: string | null,
    notes?: string,
    context?: CrmOperationEventContext
  ): Promise<void> {
    return assignClientToStage(
      this.ctx,
      clientId,
      stageId,
      assignedBy,
      notes,
      context ?? { triggeredBy: "manual" }
    );
  }

  async removeClientFromPipeline(
    clientId: string,
    pipelineId: string,
    assignedBy?: string | null,
    context?: CrmOperationEventContext
  ): Promise<boolean> {
    return removeClientFromPipeline(
      this.ctx,
      clientId,
      pipelineId,
      assignedBy,
      context ?? { triggeredBy: "manual" }
    );
  }

  async assignClientToPipeline(clientId: string, pipelineId: string, notes?: string): Promise<void> {
    return assignClientToPipeline(this.ctx, clientId, pipelineId, notes);
  }

  // =========================================================================
  // Fields
  // =========================================================================

  async getCustomFields(): Promise<CustomFieldDefinition[]> {
    return getCustomFields(this.ctx);
  }

  async getCustomFieldById(fieldId: string): Promise<CustomFieldDefinition | null> {
    return getCustomFieldById(this.ctx, fieldId);
  }

  async createCustomField(data: CreateFieldInput): Promise<CustomFieldDefinition> {
    return createCustomField(this.ctx, data);
  }

  async updateCustomField(fieldId: string, data: UpdateFieldInput): Promise<CustomFieldDefinition | null> {
    return updateCustomField(this.ctx, fieldId, data);
  }

  async deleteCustomField(fieldId: string): Promise<boolean> {
    return deleteCustomField(this.ctx, fieldId);
  }

  async reorderCustomFields(fieldIds: string[]): Promise<void> {
    return reorderCustomFields(this.ctx, fieldIds);
  }

  async getClientFieldValues(clientId: string): Promise<ClientFieldValue[]> {
    return getClientFieldValues(this.ctx, clientId);
  }

  async updateClientFieldValues(
    clientId: string,
    values: { fieldId: string; value: unknown }[],
    updatedBy: string
  ): Promise<void> {
    return updateClientFieldValues(this.ctx, clientId, values, updatedBy);
  }

  // =========================================================================
  // Clients
  // =========================================================================

  async getClientCrmProfile(clientId: string): Promise<CrmClientProfile | null> {
    return getClientCrmProfile(this.ctx, clientId);
  }

  async getCrmClients(
    filters: ClientFilters = {},
    options?: { limit?: number; offset?: number }
  ): Promise<{ clients: CrmClient[]; total: number }> {
    return getCrmClients(this.ctx, filters, options);
  }

  async getClientsByStages(filters: ClientFilters = {}): Promise<Map<string | null, CrmClient[]>> {
    return getClientsByStages(this.ctx, filters);
  }

  // =========================================================================
  // Activity
  // =========================================================================

  async getClientTimeline(clientId: string, options?: CrmTimelineOptions): Promise<ActivityEntry[]> {
    return getClientTimeline(this.ctx, clientId, options);
  }

  // =========================================================================
  // Messaging
  // =========================================================================

  async sendDirectMessage(
    input: SendMessageInput & { clientId: string },
    sentBy: string
  ): Promise<SendMessageResult> {
    return sendDirectMessage(this.ctx, input, sentBy);
  }

  async getClientMessages(
    clientId: string,
    limit?: number,
    offset?: number
  ): Promise<DirectMessage[]> {
    return getClientMessages(this.ctx, clientId, limit, offset);
  }
}
