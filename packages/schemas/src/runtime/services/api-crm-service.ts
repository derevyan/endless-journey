import type {
  ActivityEntry,
  CrmActivityType,
  ClientFieldValue,
  ClientFilters,
  ClientStageAssignment,
  CrmClient,
  CrmClientProfile,
  CustomFieldDefinition,
  DirectMessage,
  Pipeline,
  PipelineStage,
  PipelineStageWithCount,
  PipelineWithStageCount,
  StageHistoryEntry,
  CreateFieldInput,
  CreatePipelineInput,
  CreateStageInput,
  SendMessageInput,
  UpdateFieldInput,
  UpdatePipelineInput,
  UpdateStageInput,
} from "../../crm";
import type { CrmEventTrigger } from "../../events/payloads/crm";
import type { ICrmService } from "./crm-service";

export interface CrmOperationEventContext {
  triggeredBy: CrmEventTrigger;
  performedBy?: string;
  sessionId?: string;
  journeyId?: string;
}

export interface CrmTimelineOptions {
  limit?: number;
  offset?: number;
  types?: CrmActivityType[];
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  platformMessageId?: string;
  error?: string;
}

export interface IApiCrmService extends ICrmService {
  // Pipelines
  createDefaultPipeline(): Promise<Pipeline>;
  getPipelines(): Promise<PipelineWithStageCount[]>;
  getPipeline(pipelineId: string): Promise<Pipeline | null>;
  getPipelineBySlug(slug: string): Promise<Pipeline | null>;
  getDefaultPipeline(): Promise<Pipeline | null>;
  ensureDefaultPipeline(): Promise<Pipeline>;
  createPipeline(data: CreatePipelineInput, performedBy?: string): Promise<Pipeline>;
  updatePipeline(pipelineId: string, data: UpdatePipelineInput, performedBy?: string): Promise<Pipeline | null>;
  deletePipeline(pipelineId: string, performedBy?: string): Promise<boolean>;
  reorderPipelines(pipelineIds: string[]): Promise<void>;
  setDefaultPipeline(pipelineId: string, performedBy?: string): Promise<void>;

  // Stages
  getPipelineStages(pipelineId?: string): Promise<PipelineStageWithCount[]>;
  getPipelineStageById(stageId: string): Promise<PipelineStage | null>;
  createPipelineStage(data: CreateStageInput, performedBy?: string): Promise<PipelineStage>;
  updatePipelineStage(stageId: string, data: UpdateStageInput, performedBy?: string): Promise<PipelineStage | null>;
  deletePipelineStage(stageId: string, performedBy?: string): Promise<boolean>;
  reorderPipelineStages(pipelineId: string, stageIds: string[], performedBy?: string): Promise<void>;

  getClientStage(clientId: string, pipelineId?: string): Promise<ClientStageAssignment | null>;
  getClientStages(clientId: string): Promise<ClientStageAssignment[]>;
  getClientStageHistory(clientId: string, pipelineId?: string): Promise<StageHistoryEntry[]>;
  getClientsByStage(stageId: string): Promise<CrmClient[]>;
  getDefaultStage(pipelineId?: string): Promise<PipelineStage | null>;
  assignClientToDefaultPipeline(clientId: string): Promise<void>;
  assignClientToStage(
    clientId: string,
    stageId: string,
    assignedBy: string | null,
    notes?: string,
    context?: CrmOperationEventContext
  ): Promise<void>;
  removeClientFromPipeline(
    clientId: string,
    pipelineId: string,
    assignedBy?: string | null,
    context?: CrmOperationEventContext
  ): Promise<boolean>;
  assignClientToPipeline(clientId: string, pipelineId: string, notes?: string): Promise<void>;

  // Fields
  getCustomFields(): Promise<CustomFieldDefinition[]>;
  getCustomFieldById(fieldId: string): Promise<CustomFieldDefinition | null>;
  createCustomField(data: CreateFieldInput): Promise<CustomFieldDefinition>;
  updateCustomField(fieldId: string, data: UpdateFieldInput): Promise<CustomFieldDefinition | null>;
  deleteCustomField(fieldId: string): Promise<boolean>;
  reorderCustomFields(fieldIds: string[]): Promise<void>;
  getClientFieldValues(clientId: string): Promise<ClientFieldValue[]>;
  updateClientFieldValues(clientId: string, values: { fieldId: string; value: unknown }[], updatedBy: string): Promise<void>;

  // Clients
  getClientCrmProfile(clientId: string): Promise<CrmClientProfile | null>;
  getCrmClients(filters?: ClientFilters, options?: { limit?: number; offset?: number }): Promise<{ clients: CrmClient[]; total: number }>;
  getClientsByStages(filters?: ClientFilters): Promise<Map<string | null, CrmClient[]>>;

  // Activity
  getClientTimeline(clientId: string, options?: CrmTimelineOptions): Promise<ActivityEntry[]>;

  // Messaging
  sendDirectMessage(input: SendMessageInput & { clientId: string }, sentBy: string): Promise<SendMessageResult>;
  getClientMessages(clientId: string, limit?: number, offset?: number): Promise<DirectMessage[]>;
}
