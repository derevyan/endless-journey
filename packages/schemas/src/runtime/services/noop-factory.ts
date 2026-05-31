/**
 * No-op Service Factory
 *
 * Provides no-op (null object) implementations of service interfaces.
 * Useful for:
 * - Unit testing without mocking
 * - Contexts where certain services aren't needed
 * - Default values before real services are configured
 *
 * All no-op services are safe to call - they just don't do anything.
 *
 * @module services/noop-factory
 */

import type { VariableScope, VariableData } from "../../variables";
import type { VariableAction } from "../../nodes";
import type { IVariableService } from "./variable-service";
import type { IApiVariableService } from "./api-variable-service";
import type {
  IApiTagService,
  TagDefinition,
} from "./api-tag-service";
import type { IMessengerService, SendResult } from "./messenger-service";
import type { ITemplateService, TemplateContext, TemplateOptions } from "./template-service";
import type { IMemoryService } from "./memory-service";
import type { ICrmService } from "./crm-service";
import type {
  IApiCrmService,
  CrmOperationEventContext,
  CrmTimelineOptions,
  SendMessageResult as ApiSendMessageResult,
} from "./api-crm-service";
import type { IApiChannelService } from "./api-channel-service";
import type { IApiJourneyService } from "./api-journey-service";
import type { IApiUserService } from "./api-user-service";
import type { IApiUploadService } from "./api-upload-service";
import type { IApiPromptService } from "./api-prompt-service";
import type { IApiMindstateService } from "./api-mindstate-service";
import type { IApiWorkflowService, ApprovalListResult, ApprovalRecord, WorkflowListResult } from "./api-workflow-service";
import type { IApiEventService } from "./api-event-service";
import type { IApiSimulatorService, Persona } from "./api-simulator-service";
import type {
  ClientFilters,
  CrmClient,
  CrmClientProfile,
  CustomFieldDefinition,
  Pipeline,
  PipelineStage,
  PipelineStageWithCount,
  PipelineWithStageCount,
  CreateFieldInput,
  CreatePipelineInput,
  CreateStageInput,
  SendMessageInput,
  UpdateFieldInput,
  UpdatePipelineInput,
  UpdateStageInput,
} from "../../crm";
import type {
  AgentWorkflow,
  AtomicWorkflowSaveResult,
  VersionedWorkflowData,
  WorkflowConfiguration,
  WorkflowVersion,
} from "../../agents/workflow";
import type { CompiledPrompt, PromptChatMessage, PromptListResponse, PromptResponse, PromptVersionResponse } from "../../prompts";
import type {
  JourneyAtomicSaveResult,
  JourneyConfig,
  JourneyConfigRecord,
  JourneyVersion,
  SaveVersionInput,
  VersionedJourneyData,
} from "../../journey";
import type { ListUsersParams, UserActivityParams, UserListResult, UserSessionInfo } from "../../users";
import type { BotRecord, ChannelSessionRecord, ChannelUserInfo } from "../../channels";
import { DEFAULT_MAIN_AGENT } from "../../mindstate";
import type {
  AtomicSaveMindstateResult,
  ClientMindstate,
  MindstateDefinition,
  MindstateDefinitionVersion,
  VersionedMindstateData,
} from "../../mindstate";
import type { ITagService } from "./tag-service";
import type { ICacheService } from "./cache-service";
import type { IJourneyService } from "./journey-service";
import type { SharedServiceContext, OptionalServiceName, IMindstateService, IDlqService, IExpressionService, IFollowUpService } from "./shared-context";

// =============================================================================
// NO-OP SERVICE IMPLEMENTATIONS
// =============================================================================

/**
 * Create a no-op variable service that returns empty values.
 *
 * @example
 * ```typescript
 * const varService = createNoOpVariableService();
 * const value = await varService.getAll("journey"); // Returns {}
 * await varService.executeAction({ journey: [{ op: "set", key: "x", value: 1 }] }); // Does nothing
 * ```
 */
export function createNoOpVariableService(): IVariableService {
  return {
    getAll: async () => ({}),
    executeAction: async () => {},
    getValue: async () => undefined,
    setValue: async () => {},
    executeOperation: async () => {},
    delete: async () => {},
    exists: async () => false,
  };
}

function createNoOpVariableData(): VariableData {
  return {
    id: "noop",
    key: "noop",
    value: null,
    description: null,
    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Create a no-op API variable service for routes and tests.
 */
export function createNoOpApiVariableService(): IApiVariableService {
  const base = createNoOpVariableService();

  return {
    ...base,
    getGlobalVariables: async () => [],
    getGlobalVariable: async () => null,
    setGlobalVariable: async (key: string) => ({
      ...createNoOpVariableData(),
      key,
      organizationId: "noop-org",
    }),
    deleteGlobalVariable: async () => false,
    getJourneyVariables: async () => [],
    getJourneyVariable: async () => null,
    setJourneyVariable: async (journeyId: string, key: string) => ({
      ...createNoOpVariableData(),
      key,
      journeyId,
    }),
    deleteJourneyVariable: async () => false,
    getUserVariables: async () => [],
    getUserVariable: async () => null,
    setUserVariable: async (clientId: string, key: string) => ({
      ...createNoOpVariableData(),
      key,
      clientId,
    }),
    deleteUserVariable: async () => false,
    executeOperations: async () => {},
    getVariablesAsMap: async () => ({}),
  };
}

function createNoOpTagDefinition(name = "noop-tag"): TagDefinition {
  return {
    id: `noop-${name}`,
    organizationId: "noop-org",
    name,
    description: null,
    color: null,
    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Create a no-op API tag service for routes and tests.
 */
export function createNoOpApiTagService(): IApiTagService {
  const base = createNoOpTagService();

  return {
    ...base,
    getClientTags: async () => [],
    getClientTagNames: async () => [],
    assignTagToClient: async () => {},
    removeTagFromClient: async () => false,
    executeOperations: async () => {},
    getAllUniqueTagsForOrganization: async () => [],
    getAllTagsForUsers: async () => new Map(),
    verifyClientBelongsToOrg: async () => false,
    getTagDefinitions: async () => [],
    getTagDefinitionByName: async () => null,
    createTagDefinition: async (input) => createNoOpTagDefinition(input.name),
    updateTagDefinition: async (tagId, updates) => {
      const name = updates.name ?? tagId;
      return createNoOpTagDefinition(name);
    },
    deleteTagDefinition: async () => false,
    ensureTag: async (name) => createNoOpTagDefinition(name).id,
    ensureTags: async (names) => {
      const entries = names.map((name) => [name, createNoOpTagDefinition(name).id] as const);
      return new Map(entries);
    },
    getAllAvailableTags: async () => [],
  };
}

/**
 * Create a no-op messenger service that silently accepts messages.
 *
 * @example
 * ```typescript
 * const messenger = createNoOpMessengerService();
 * const result = await messenger.sendMessage("Hello"); // Returns { success: true, messageId: "noop-..." }
 * ```
 */
export function createNoOpMessengerService(): IMessengerService {
  const createResult = (): SendResult => ({
    success: true,
    messageId: `noop-${Date.now()}`,
  });

  return {
    sendMessage: async () => createResult(),
    sendButtons: async () => createResult(),
    sendMedia: async () => createResult(),
    editMessage: async () => createResult(),
    deleteMessage: async () => createResult(),
    sendTypingIndicator: async () => {},
  };
}

/**
 * Create a no-op template service that returns templates unchanged.
 *
 * For production use, consider returning the template with placeholders replaced
 * by empty strings instead.
 *
 * @example
 * ```typescript
 * const template = createNoOpTemplateService();
 * const result = template.substitute("Hello {{name}}", {}); // Returns "Hello {{name}}"
 * ```
 */
export function createNoOpTemplateService(): ITemplateService {
  return {
    substitute: (template: string) => template,
    resolve: async (template: string) => template,
    resolveSync: (template: string) => template,
    hasVariables: (template: string) => template.includes("{{"),
    extractVariables: (template: string) => {
      const matches = template.match(/\{\{([^}]+)\}\}/g);
      return matches ? matches.map((m) => m.slice(2, -2).trim()) : [];
    },
    validateVariables: () => [],
    getValueAtPath: () => undefined,
  };
}

/**
 * Create a no-op memory service that doesn't store anything.
 */
export function createNoOpMemoryService(): IMemoryService {
  return {
    save: async () => {},
    search: async () => [],
    getRecent: async () => [],
    get: async () => null,
    delete: async () => false,
    exists: async () => false,
    getAll: async () => [],
    clear: async () => {},
  };
}

/**
 * Create a no-op tag service that returns empty arrays.
 */
export function createNoOpTagService(): ITagService {
  return {
    executeTagAction: async () => {},
    getTags: async () => [],
    addTags: async () => [],
    removeTags: async () => [],
    setTags: async () => {},
    hasTag: async () => false,
    hasAllTags: async () => false,
    hasAnyTag: async () => false,
    clearTags: async () => {},
    getAllAvailableTags: async () => [],
  };
}

/**
 * Create a no-op CRM service that returns success.
 */
export function createNoOpCrmService(): ICrmService {
  return {
    updateClientPosition: async () => {},
    addToPipeline: async () => {},
    removeFromPipeline: async () => {},
    moveToStage: async () => {},
    updatePosition: async () => {},
    setDealValue: async () => {},
    assignOwner: async () => {},
    updateContact: async () => {},
    createNote: async () => {},
    getPipelines: async () => [],
    getUserPipeline: async () => null,
    getUserPipelines: async () => [],
    getStages: async () => [],
    getDefaultPipeline: async () => null,
    getNotes: async () => [],
  };
}

function createNoOpPipeline(name = "noop-pipeline"): Pipeline {
  return {
    id: `noop-${name}`,
    organizationId: "noop-org",
    name,
    slug: name,
    description: null,
    position: 0,
    isDefault: null,
    isActive: null,
    color: null,
    createdAt: null,
    updatedAt: null,
  };
}

function createNoOpPipelineWithCounts(name = "noop-pipeline"): PipelineWithStageCount {
  return {
    ...createNoOpPipeline(name),
    stageCount: 0,
    clientCount: 0,
  };
}

function createNoOpStage(pipelineId = "noop-pipeline", name = "noop-stage"): PipelineStage {
  return {
    id: `noop-${name}`,
    pipelineId,
    organizationId: "noop-org",
    name,
    description: null,
    color: null,
    position: 0,
    isDefault: null,
    isSystem: null,
    createdAt: null,
    updatedAt: null,
  };
}

function createNoOpStageWithCounts(pipelineId = "noop-pipeline", name = "noop-stage"): PipelineStageWithCount {
  return {
    ...createNoOpStage(pipelineId, name),
    clientCount: 0,
  };
}

function createNoOpField(name = "noop-field"): CustomFieldDefinition {
  return {
    id: `noop-${name}`,
    organizationId: "noop-org",
    name,
    key: name,
    fieldType: "text",
    description: null,
    validation: null,
    isRequired: null,
    position: 0,
    defaultValue: null,
    createdAt: null,
    updatedAt: null,
  };
}

function createNoOpClient(clientId = "noop-client"): CrmClient {
  return {
    id: clientId,
    platform: "noop",
    firstName: null,
    lastName: null,
    username: null,
    stageId: null,
    stageName: null,
    stageColor: null,
    totalSessions: 0,
    lastActiveAt: null,
    tags: [],
  };
}

function createNoOpBotRecord(id = "noop-bot"): BotRecord {
  return {
    id,
    organizationId: "noop-org",
    userId: "noop-user",
    platform: "telegram",
    botToken: "noop-token",
    botUsername: null,
    defaultJourneyId: null,
    isActive: false,
    webhookSecret: null,
    botName: null,
    webhookUrl: null,
    settings: {},
    createdAt: null,
    updatedAt: null,
    defaultJourneySlug: null,
    defaultJourneyName: null,
  };
}

function createNoOpSessionRecord(id = "noop-session"): ChannelSessionRecord {
  return {
    id,
    clientId: "noop-client",
    channelId: "noop-channel",
    journeyId: "noop-journey",
    currentNodeId: "noop-node",
    status: "active",
    mode: "live",
    context: {},
    tags: [],
    createdAt: null,
    updatedAt: null,
    completedAt: null,
  };
}

/**
 * Create a no-op API CRM service.
 */
export function createNoOpApiCrmService(): IApiCrmService {
  const base = createNoOpCrmService();
  const defaultPipeline = createNoOpPipeline();
  const defaultStage = createNoOpStage(defaultPipeline.id);

  return {
    ...base,
    createDefaultPipeline: async () => defaultPipeline,
    getPipelines: async () => [createNoOpPipelineWithCounts()],
    getPipeline: async (pipelineId: string) => ({ ...defaultPipeline, id: pipelineId }),
    getPipelineBySlug: async (slug: string) => ({ ...defaultPipeline, slug }),
    getDefaultPipeline: async () => defaultPipeline,
    ensureDefaultPipeline: async () => defaultPipeline,
    createPipeline: async (data: CreatePipelineInput) => createNoOpPipeline(data.name),
    updatePipeline: async (pipelineId: string, updates: UpdatePipelineInput) => ({
      ...defaultPipeline,
      id: pipelineId,
      name: updates.name ?? defaultPipeline.name,
      description: updates.description ?? defaultPipeline.description,
      color: updates.color ?? defaultPipeline.color,
      isActive: updates.isActive ?? defaultPipeline.isActive,
    }),
    deletePipeline: async () => false,
    reorderPipelines: async () => {},
    setDefaultPipeline: async () => {},

    getPipelineStages: async () => [createNoOpStageWithCounts(defaultPipeline.id)],
    getPipelineStageById: async (stageId: string) => ({ ...defaultStage, id: stageId }),
    createPipelineStage: async (data: CreateStageInput) => createNoOpStage(data.pipelineId, data.name),
    updatePipelineStage: async (stageId: string, updates: UpdateStageInput) => ({
      ...defaultStage,
      id: stageId,
      name: updates.name ?? defaultStage.name,
      description: updates.description ?? defaultStage.description,
      color: updates.color ?? defaultStage.color,
      isDefault: updates.isDefault ?? defaultStage.isDefault,
    }),
    deletePipelineStage: async () => false,
    reorderPipelineStages: async () => {},

    getClientStage: async () => null,
    getClientStages: async () => [],
    getClientStageHistory: async () => [],
    getClientsByStage: async () => [],
    getDefaultStage: async () => defaultStage,
    assignClientToDefaultPipeline: async () => {},
    assignClientToStage: async (
      _clientId: string,
      _stageId: string,
      _assignedBy: string | null,
      _notes?: string,
      _context?: CrmOperationEventContext
    ) => {},
    removeClientFromPipeline: async (
      _clientId: string,
      _pipelineId: string,
      _assignedBy?: string | null,
      _context?: CrmOperationEventContext
    ) => false,
    assignClientToPipeline: async () => {},

    getCustomFields: async () => [],
    getCustomFieldById: async () => null,
    createCustomField: async (data: CreateFieldInput) => createNoOpField(data.name),
    updateCustomField: async (fieldId: string, updates: UpdateFieldInput) => ({
      ...createNoOpField(fieldId),
      name: updates.name ?? fieldId,
      description: updates.description ?? null,
      validation: updates.validation ?? null,
      isRequired: updates.isRequired ?? null,
      defaultValue: updates.defaultValue ?? null,
    }),
    deleteCustomField: async () => false,
    reorderCustomFields: async () => {},
    getClientFieldValues: async () => [],
    updateClientFieldValues: async () => {},

    getClientCrmProfile: async (clientId: string) => ({
      id: clientId,
      platform: "noop",
      platformUserId: "noop-platform",
      firstName: null,
      lastName: null,
      username: null,
      createdAt: null,
      updatedAt: null,
      stage: null,
      customFields: [],
      tags: [],
      totalSessions: 0,
      lastActiveAt: null,
    } satisfies CrmClientProfile),
    getCrmClients: async (_filters?: ClientFilters, _options?: { limit?: number; offset?: number }) => ({
      clients: [],
      total: 0,
    }),
    getClientsByStages: async () => new Map<string | null, CrmClient[]>(),

    getClientTimeline: async (_clientId: string, _options?: CrmTimelineOptions) => [],

    sendDirectMessage: async (_input: SendMessageInput & { clientId: string }, _sentBy: string): Promise<ApiSendMessageResult> => ({
      success: true,
      messageId: "noop-message",
    }),
    getClientMessages: async () => [],
  };
}

/**
 * Create a no-op API channel service.
 */
export function createNoOpApiChannelService(): IApiChannelService {
  return {
    createBot: async () => createNoOpBotRecord(),
    getOrganizationBots: async () => [],
    getOrganizationBot: async () => null,
    updateBot: async () => null,
    deleteBot: async () => false,
    reregisterWebhook: async () => false,
    findOrCreateChannelUser: async (_info: ChannelUserInfo) => "noop-client",
    getClientById: async () => null,
    deleteChannelUser: async () => false,
    getChannelUserVars: async () => ({}),
    updateChannelUserVars: async () => {},
    getChannelBot: async () => null,
    getBotByToken: async () => null,
    getChannelOrganizationId: async () => null,
    findActiveSession: async () => null,
    createSession: async () => createNoOpSessionRecord(),
    updateSession: async () => {},
    getSessionById: async () => null,
    deleteSession: async () => false,
    getJourneyConfig: async () => null,
    getJourneyOrganizationId: async () => null,
    getJourneyDefaultPipelineId: async () => null,
    getJourneyMindstateConfig: async () => null,
    getJourneyName: async () => null,
    getJourneyStatus: async () => null,
    saveInteraction: async () => "noop-interaction",
    getSessionsByJourneyId: async () => [],
    getSessionWithInteractions: async () => null,
    getActiveSessionsForJourney: async () => [],
    getPausedSessionsForJourney: async () => [],
    getActiveSessionCountForJourney: async () => 0,
    bulkUpdateSessionStatus: async () => 0,
    resetJourneySessions: async () => 0,
    saveSentMessages: async () => {},
    getLastMessageForSession: async () => null,
    getMessagesForSession: async () => [],
  };
}

function createNoOpJourneyConfig(): JourneyConfig {
  return { nodes: [], edges: [] };
}

function createNoOpJourneyRecord(overrides: Partial<JourneyConfigRecord> = {}): JourneyConfigRecord {
  return {
    id: "noop-journey",
    slug: null,
    name: "Noop Journey",
    description: null,
    status: "draft",
    configuration: createNoOpJourneyConfig(),
    organizationId: "noop-org",
    defaultPipelineId: null,
    mindstateConfig: null,
    transferAllowlist: null,
    variableSchemas: null,
    createdBy: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function createNoOpJourneyVersion(journeyId = "noop-journey", versionId = "v000"): JourneyVersion {
  return {
    id: `noop-version-${versionId}`,
    journeyId,
    versionId,
    notes: null,
    createdBy: null,
    createdAt: new Date(0),
  };
}

/**
 * Create a no-op API journey service.
 */
export function createNoOpApiJourneyService(): IApiJourneyService {
  return {
    getOrganizationJourneys: async () => [],
    getJourneyById: async () => null,
    createJourney: async (_organizationId: string, _userId: string, data) =>
      createNoOpJourneyRecord({ name: data.name }),
    updateJourney: async (_journeyIdOrSlug, _organizationId, data) =>
      createNoOpJourneyRecord({ name: data.name ?? "Noop Journey" }),
    deleteJourney: async () => false,
    deactivateJourney: async () => ({ sessionsAffected: 0, timersAffected: 0 }),
    reactivateJourney: async () => ({ sessionsAffected: 0, timersAffected: 0 }),
    listVersions: async () => [],
    saveVersion: async (journeyId: string, _organizationId: string, _userId: string, data: SaveVersionInput) =>
      createNoOpJourneyVersion(journeyId, data.versionId),
    getVersion: async (): Promise<VersionedJourneyData | null> => ({
      version: createNoOpJourneyVersion(),
      data: createNoOpJourneyConfig(),
    }),
    deleteVersion: async () => false,
    saveVersionAtomic: async (): Promise<JourneyAtomicSaveResult> => {
      const versionId = "v000";
      return {
        version: createNoOpJourneyVersion("noop-journey", versionId),
        versionId,
      };
    },
  };
}

/**
 * Create a no-op API user service.
 */
export function createNoOpApiUserService(): IApiUserService {
  return {
    listOrganizationUsers: async (_params: ListUsersParams): Promise<UserListResult> => ({
      users: [],
      total: 0,
    }),
    listUserSessions: async (_organizationId: string, _clientId: string): Promise<UserSessionInfo[]> => [],
    listUserActivity: async (_params: UserActivityParams) => [],
    userHasSessionsInOrg: async () => false,
  };
}

function createNoOpPromptVersion(versionId = "v000"): PromptVersionResponse {
  return {
    id: `noop-version-${versionId}`,
    versionId,
    content: "",
    labels: [],
    notes: null,
    createdBy: null,
    createdAt: new Date(0),
  };
}

function createNoOpPromptResponse(name = "noop-prompt"): PromptResponse {
  return {
    id: `noop-${name}`,
    name,
    description: null,
    type: "text",
    tags: [],
    isSystem: false,
    createdBy: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    productionVersion: null,
    latestVersion: null,
  };
}

function createNoOpCompiledPrompt(name = "noop-prompt", versionId = "v000"): CompiledPrompt {
  return {
    name,
    type: "text",
    versionId,
    label: "production",
    content: "",
  };
}

function createNoOpMindstateDefinition(key = "noop-mindstate"): MindstateDefinition {
  return {
    id: `noop-${key}`,
    organizationId: "noop-org",
    key,
    name: "Noop Mindstate",
    description: undefined,
    mainAgentConfig: DEFAULT_MAIN_AGENT,
    defaultAgents: [],
    defaultParameters: [],
    analysisMode: "automatic",
    categories: [],
    status: "draft",
    createdAt: undefined,
    updatedAt: undefined,
  };
}

function createNoOpClientMindstate(definitionId = "noop-definition"): ClientMindstate {
  return {
    id: `noop-client-mindstate-${definitionId}`,
    clientId: "noop-client",
    definitionId,
    stateParameters: [],
    systemAgents: [],
    agentInsights: [],
    lastAnalyzedAt: null,
    createdAt: undefined,
    updatedAt: undefined,
  };
}

function createNoOpMindstateDefinitionVersion(
  definitionId = "noop-definition",
  versionId = "v000"
): MindstateDefinitionVersion {
  return {
    id: `noop-version-${versionId}`,
    definitionId,
    versionId,
    notes: null,
    createdBy: null,
    createdAt: new Date(0),
  };
}

function createNoOpVersionedMindstateData(
  definitionId = "noop-definition",
  versionId = "v000"
): VersionedMindstateData {
  return {
    version: createNoOpMindstateDefinitionVersion(definitionId, versionId),
    data: {
      mainAgentConfig: DEFAULT_MAIN_AGENT,
      defaultAgents: [],
      defaultParameters: [],
      analysisMode: "automatic",
      categories: [],
    },
  };
}

function createNoOpWorkflowConfiguration(): WorkflowConfiguration {
  return {
    nodes: [],
    edges: [],
  };
}

function createNoOpWorkflow(key = "noop-workflow"): AgentWorkflow {
  return {
    id: `noop-${key}`,
    orgId: "noop-org",
    key,
    name: "Noop Workflow",
    description: undefined,
    status: "draft",
    configuration: createNoOpWorkflowConfiguration(),
    settings: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    createdBy: undefined,
    updatedBy: undefined,
    deletedAt: undefined,
  };
}

function createNoOpWorkflowVersion(
  workflowId = "noop-workflow",
  versionId = "v000"
): WorkflowVersion {
  return {
    id: `noop-version-${versionId}`,
    workflowId,
    versionId,
    notes: null,
    createdBy: null,
    createdAt: new Date(0),
  };
}

function createNoOpVersionedWorkflowData(
  workflowId = "noop-workflow",
  versionId = "v000"
): VersionedWorkflowData {
  return {
    version: createNoOpWorkflowVersion(workflowId, versionId),
    data: createNoOpWorkflowConfiguration(),
  };
}

function createNoOpApprovalRecord(id = "noop-approval"): ApprovalRecord {
  return {
    id,
    workflowId: "noop-workflow",
    workflowRunId: "noop-run",
    orgId: "noop-org",
    nodeId: "noop-node",
    message: "Noop approval",
    status: "pending",
    executionState: null,
    timeoutSeconds: null,
    timeoutAction: null,
    expiresAt: null,
    timeoutJobId: null,
    allowedRoles: null,
    respondedBy: null,
    respondedAt: null,
    responseNote: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function createNoOpPersona(id = "noop-persona"): Persona {
  return {
    id,
    organizationId: "noop-org",
    name: "Noop Persona",
    clientId: null,
    profile: {},
    userVars: {},
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

/**
 * Create a no-op API upload service.
 */
export function createNoOpApiUploadService(): IApiUploadService {
  return {
    saveJourneyMedia: async () => {},
    listJourneyMedia: async () => [],
    getJourneyMediaById: async () => null,
    deleteJourneyMediaById: async () => {},
    isMediaUsedInJourney: async () => false,
  };
}

/**
 * Create a no-op API prompt service.
 */
export function createNoOpApiPromptService(): IApiPromptService {
  return {
    listPrompts: async (): Promise<PromptListResponse> => ({ prompts: [], total: 0 }),
    getPromptByName: async (name: string) => createNoOpPromptResponse(name),
    getPromptById: async (id: string) => createNoOpPromptResponse(id),
    createPrompt: async (_userId, input) => createNoOpPromptResponse(input.name),
    updatePrompt: async (name) => createNoOpPromptResponse(name),
    deletePrompt: async () => {},
    listVersions: async () => [],
    getVersion: async (_name: string, versionId: string) => createNoOpPromptVersion(versionId),
    getVersionByLabel: async (_name: string, label: string) => createNoOpPromptVersion(label),
    createVersion: async (_name: string, _userId: string, input) => createNoOpPromptVersion(input.labels?.[0] ?? "v000"),
    updateLabels: async (_name: string, _versionId: string) => createNoOpPromptVersion(),
    deleteVersion: async () => {},
    compilePrompt: async (name: string) => createNoOpCompiledPrompt(name),
    compileTextPrompt: (content: string) => content,
    compileChatPrompt: (messages: PromptChatMessage[]) => messages,
    extractVariables: () => [],
    extractVariablePaths: () => [],
    validateVariables: () => ({ valid: true, missing: [] }),
  };
}

/**
 * Create a no-op API mindstate service.
 */
export function createNoOpApiMindstateService(): IApiMindstateService {
  return {
    listDefinitions: async () => [],
    ensureDefaultMindstate: async () => false,
    getDefinition: async () => null,
    getDefinitionById: async () => null,
    createDefinition: async (data) => createNoOpMindstateDefinition(data.key),
    updateDefinition: async () => createNoOpMindstateDefinition(),
    deleteDefinition: async () => false,
    previewAnalyzeMessage: async () => ({
      response: "",
      insights: [],
      stateChanges: [],
      updatedState: [],
      metrics: {
        durationMs: 0,
        agentCount: 0,
        parameterCount: 0,
        changesCount: 0,
      },
    }),
    listVersions: async () => [],
    getVersion: async (definitionId: string, versionId: string) =>
      createNoOpVersionedMindstateData(definitionId, versionId),
    deleteVersion: async () => false,
    saveVersionAtomic: async (definitionId: string): Promise<AtomicSaveMindstateResult> => ({
      version: createNoOpMindstateDefinitionVersion(definitionId, "v000"),
      versionId: "v000",
    }),
    listClientMindstates: async () => [],
    getOrCreateClientMindstate: async (_clientId: string, key: string) => createNoOpClientMindstate(key),
    analyzeMessage: async () => ({
      mindstateId: "noop-mindstate",
      changes: [],
      newInsights: [],
      metrics: {
        durationMs: 0,
        agentCount: 0,
        parameterCount: 0,
        changesCount: 0,
      },
      responseMessage: undefined,
    }),
    getAnalysisHistory: async () => [],
    getParameterValue: async () => null,
    getParameterValues: async () => new Map(),
    getMindstateContext: async () => ({}),
  };
}

/**
 * Create a no-op API workflow service.
 */
export function createNoOpApiWorkflowService(): IApiWorkflowService {
  return {
    listWorkflows: async (): Promise<WorkflowListResult> => ({
      workflows: [],
      total: 0,
      limit: 0,
      offset: 0,
    }),
    getWorkflowByKey: async () => null,
    createWorkflow: async (_userId, data) => createNoOpWorkflow(data.key),
    updateWorkflow: async (_userId, key) => createNoOpWorkflow(key),
    deleteWorkflow: async () => {},
    validateWorkflowConfig: async () => ({ valid: true, errors: [], warnings: [] }),
    listWorkflowVersions: async () => [],
    saveWorkflowVersion: async (workflowKey: string) => createNoOpWorkflowVersion(workflowKey),
    getWorkflowVersion: async (workflowKey: string, versionId: string) =>
      createNoOpVersionedWorkflowData(workflowKey, versionId),
    deleteWorkflowVersion: async () => false,
    saveVersionAtomic: async (workflowKey: string): Promise<AtomicWorkflowSaveResult> => ({
      version: createNoOpWorkflowVersion(workflowKey, "v000"),
      versionId: "v000",
    }),
    listApprovals: async (): Promise<ApprovalListResult> => ({
      approvals: [],
      total: 0,
      limit: 0,
      offset: 0,
    }),
    getApproval: async () => null,
    respondToApproval: async (id: string) => createNoOpApprovalRecord(id),
    createWorkflowEmitter: () => () => {},
  };
}

/**
 * Create a no-op API event service.
 */
export function createNoOpApiEventService(): IApiEventService {
  return {
    listInteractionEvents: async () => ({ events: [], total: 0 }),
    getEventStats: async () => ({ total: 0, last24h: 0, byType: {} }),
    listEventTypes: async () => [],
    listCrmEvents: async () => ({ events: [], total: 0 }),
    listLlmEvents: async () => ({ events: [], total: 0 }),
    getLlmStats: async () => ({
      totals: { tokens: 0, costUSD: "0", calls: 0 },
      byModel: {},
      byService: {},
      filters: { services: [], models: [], providers: [] },
    }),
    replayEvents: async () => ({ events: [], total: 0 }),
    getLatestReplaySequence: async () => 0,
  };
}

/**
 * Create a no-op API simulator service.
 */
export function createNoOpApiSimulatorService(): IApiSimulatorService {
  return {
    createSession: async () => ({
      sessionId: "noop-session",
      clientId: "noop-client",
      journeyId: "noop-journey",
      currentNodeId: "noop-node",
      status: "active",
    }),
    executeInput: async () => {},
    getSessionRecord: async () => null,
    cleanupSession: async () => {},
    updateSessionState: async () => {},
    listActiveTimers: async () => [],
    getActiveTimer: async () => null,
    getActiveSessionCount: () => 0,
    listPersonas: async () => [],
    getPersona: async () => null,
    createPersona: async () => createNoOpPersona(),
    updatePersona: async (_id, input) => (input ? createNoOpPersona(_id) : null),
    deletePersona: async () => false,
    resetPersonaData: async () => ({
      tagsDeleted: 0,
      crmStagesDeleted: 0,
      sessionsDeleted: 0,
      variablesReset: false,
    }),
    cleanupAllTestData: async () => ({
      personasReset: 0,
      anonymousClientsDeleted: 0,
      totalTagsDeleted: 0,
      totalSessionsDeleted: 0,
    }),
  };
}

/**
 * Create a no-op mindstate service.
 */
export function createNoOpMindstateService(): IMindstateService {
  return {
    getParameterValue: async () => null,
    getState: async () => null,
    updateState: async () => {},
    analyzeAndUpdate: async () => {},
  };
}

/**
 * Create a no-op DLQ service.
 */
export function createNoOpDlqService(): IDlqService {
  return {
    sendToDlq: async () => {},
    retry: async () => false,
  };
}

/**
 * Create a no-op expression service that always returns false.
 */
export function createNoOpExpressionService(): IExpressionService {
  return {
    evaluate: () => undefined,
    isTruthy: () => false,
    validate: () => true,
  };
}

/**
 * Create a no-op follow-up service.
 */
export function createNoOpFollowUpService(): IFollowUpService {
  return {
    schedule: async () => `noop-${Date.now()}`,
    cancel: async () => {},
    cancelAllForUser: async () => {},
  };
}

/**
 * Create a no-op cache service.
 */
export function createNoOpCacheService(): ICacheService {
  return {
    get: async () => null,
    set: async () => {},
    delete: async () => false,
    exists: async () => false,
    getMany: async () => new Map(),
    setMany: async () => {},
    deleteMany: async () => 0,
    deletePattern: async () => 0,
    ttl: async () => -2,
    expire: async () => false,
    touch: async () => false,
    getStats: async () => null,
    clear: async () => {},
    isHealthy: async () => true,
  };
}

/**
 * Create a no-op journey service that blocks all transfers.
 *
 * Returns failure for all transfer attempts (simulates empty allowlist).
 */
export function createNoOpJourneyService(): IJourneyService {
  return {
    startUserInJourney: async () => ({
      success: false,
      error: "no_current_journey" as const,
      errorMessage: "Journey service not available",
    }),
    getUserActiveJourneys: async () => [],
    listJourneys: async () => [],
    endUserSession: async () => false,
    getJourneyInfo: async () => null,
    hasUserCompletedJourney: async () => false,
  };
}

// =============================================================================
// COMPLETE CONTEXT FACTORY
// =============================================================================

/**
 * Create a complete SharedServiceContext with all no-op services.
 *
 * Useful for testing or contexts where no real services are needed.
 * All services are available (has() returns true for all).
 *
 * @example
 * ```typescript
 * const context = createNoOpServiceContext();
 * await context.variable.getAll("journey"); // Returns {}
 * await context.messenger.sendMessage("Test"); // Silently succeeds
 * context.has("memory"); // Returns true
 * ```
 */
export function createNoOpServiceContext(): SharedServiceContext {
  return {
    variable: createNoOpVariableService(),
    template: createNoOpTemplateService(),
    messenger: createNoOpMessengerService(),
    memory: createNoOpMemoryService(),
    crm: createNoOpCrmService(),
    tag: createNoOpTagService(),
    mindstate: createNoOpMindstateService(),
    dlq: createNoOpDlqService(),
    expression: createNoOpExpressionService(),
    followUp: createNoOpFollowUpService(),
    cache: createNoOpCacheService(),
    journey: createNoOpJourneyService(),
    has: () => true,
  };
}

/**
 * Create a minimal SharedServiceContext with only core services.
 *
 * Optional services will not be available (has() returns false for them).
 *
 * @example
 * ```typescript
 * const context = createMinimalServiceContext();
 * await context.variable.getAll("journey"); // Returns {}
 * context.has("memory"); // Returns false
 * context.memory; // undefined
 * ```
 */
export function createMinimalServiceContext(): SharedServiceContext {
  return {
    variable: createNoOpVariableService(),
    template: createNoOpTemplateService(),
    messenger: createNoOpMessengerService(),
    has: () => false,
  };
}

/**
 * Create a SharedServiceContext with specific services enabled.
 *
 * @param enabledServices - Array of optional service names to enable
 * @returns SharedServiceContext with specified services enabled
 *
 * @example
 * ```typescript
 * const context = createPartialServiceContext(["memory", "tag"]);
 * context.has("memory"); // Returns true
 * context.has("crm"); // Returns false
 * ```
 */
export function createPartialServiceContext(
  enabledServices: OptionalServiceName[]
): SharedServiceContext {
  const serviceSet = new Set(enabledServices);

  return {
    // Core services (always available)
    variable: createNoOpVariableService(),
    template: createNoOpTemplateService(),
    messenger: createNoOpMessengerService(),

    // Optional services (conditionally available)
    memory: serviceSet.has("memory") ? createNoOpMemoryService() : undefined,
    crm: serviceSet.has("crm") ? createNoOpCrmService() : undefined,
    tag: serviceSet.has("tag") ? createNoOpTagService() : undefined,
    mindstate: serviceSet.has("mindstate") ? createNoOpMindstateService() : undefined,
    dlq: serviceSet.has("dlq") ? createNoOpDlqService() : undefined,
    expression: serviceSet.has("expression") ? createNoOpExpressionService() : undefined,
    followUp: serviceSet.has("followUp") ? createNoOpFollowUpService() : undefined,
    cache: serviceSet.has("cache") ? createNoOpCacheService() : undefined,
    journey: serviceSet.has("journey") ? createNoOpJourneyService() : undefined,

    has: (service: OptionalServiceName) => serviceSet.has(service),
  };
}
