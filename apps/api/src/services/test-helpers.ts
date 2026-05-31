import type {
  GlobalVariable,
  IApiChannelService,
  IApiCrmService,
  IApiEventService,
  IApiJourneyService,
  IApiMindstateService,
  IApiPromptService,
  IApiSimulatorService,
  IApiTagService,
  IApiUploadService,
  IApiUserService,
  IApiVariableService,
  IApiWorkflowService,
  JourneyVariable,
  CreateTagDefinitionParams,
  TagDefinition,
  UpdateTagDefinitionParams,
  UserVariable,
  Pipeline,
  PipelineStage,
  PipelineWithStageCount,
  PipelineStageWithCount,
  BotRecord,
  ChannelSessionRecord,
  JourneyConfigRecord,
  JourneyConfig,
  JourneyVersion,
  CreatePipelineInput,
  CreateStageInput,
  UpdatePipelineInput,
  UpdateStageInput,
  MindstateDefinition,
  ClientMindstate,
  MindstateDefinitionVersion,
  VersionedMindstateData,
  AgentWorkflow,
  WorkflowVersion,
  VersionedWorkflowData,
  ApprovalRecord,
  PromptResponse,
  PromptVersionResponse,
  Persona,
} from "@journey/schemas";
import { DEFAULT_MAIN_AGENT } from "@journey/schemas";
import { vi } from "vitest";

import type { ServiceContainer } from "./service-container";

// =============================================================================
// BASE DATA BUILDERS
// =============================================================================

const baseVariable = {
  id: "mock",
  key: "mock",
  value: null,
  description: null,
  createdAt: null,
  updatedAt: null,
};

const baseTagDefinition: TagDefinition = {
  id: "mock-tag",
  organizationId: "mock-org",
  name: "mock-tag",
  description: null,
  color: null,
  createdAt: null,
  updatedAt: null,
};

function buildTagDefinition(name = "mock-tag"): TagDefinition {
  return {
    ...baseTagDefinition,
    id: `tag-${name}`,
    name,
  };
}

function buildGlobalVariable(organizationId = "mock-org"): GlobalVariable {
  return { ...baseVariable, organizationId };
}

function buildJourneyVariable(journeyId = "mock-journey"): JourneyVariable {
  return { ...baseVariable, journeyId };
}

function buildUserVariable(clientId = "mock-client"): UserVariable {
  return { ...baseVariable, clientId };
}

// =============================================================================
// CRM DATA BUILDERS
// =============================================================================

function buildPipeline(name = "mock-pipeline"): Pipeline {
  return {
    id: `pipeline-${name}`,
    organizationId: "mock-org",
    name,
    slug: name,
    description: null,
    position: 0,
    isDefault: null,
    isActive: true,
    color: null,
    createdAt: null,
    updatedAt: null,
  };
}

function buildPipelineWithCounts(name = "mock-pipeline"): PipelineWithStageCount {
  return {
    ...buildPipeline(name),
    stageCount: 0,
    clientCount: 0,
  };
}

function buildStage(pipelineId = "mock-pipeline", name = "mock-stage"): PipelineStage {
  return {
    id: `stage-${name}`,
    pipelineId,
    organizationId: "mock-org",
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

function buildStageWithCounts(pipelineId = "mock-pipeline", name = "mock-stage"): PipelineStageWithCount {
  return {
    ...buildStage(pipelineId, name),
    clientCount: 0,
  };
}

// =============================================================================
// CHANNEL DATA BUILDERS
// =============================================================================

function buildBotRecord(id = "mock-bot"): BotRecord {
  return {
    id,
    organizationId: "mock-org",
    userId: "mock-user",
    platform: "telegram",
    botToken: "mock-token",
    botUsername: "mock_bot",
    defaultJourneyId: null,
    isActive: true,
    webhookSecret: null,
    botName: "Mock Bot",
    webhookUrl: null,
    settings: {},
    createdAt: null,
    updatedAt: null,
    defaultJourneySlug: null,
    defaultJourneyName: null,
  };
}

function buildSessionRecord(id = "mock-session"): ChannelSessionRecord {
  return {
    id,
    clientId: "mock-client",
    channelId: "mock-channel",
    journeyId: "mock-journey",
    currentNodeId: "mock-node",
    status: "active",
    mode: "live",
    context: {},
    tags: [],
    createdAt: null,
    updatedAt: null,
    completedAt: null,
  };
}

// =============================================================================
// JOURNEY DATA BUILDERS
// =============================================================================

function buildJourneyConfig(): JourneyConfig {
  return { nodes: [], edges: [] };
}

function buildJourneyRecord(overrides: Partial<JourneyConfigRecord> = {}): JourneyConfigRecord {
  return {
    id: "mock-journey",
    slug: "mock-journey",
    name: "Mock Journey",
    description: null,
    status: "draft",
    configuration: buildJourneyConfig(),
    organizationId: "mock-org",
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

function buildJourneyVersion(journeyId = "mock-journey", versionId = "v000"): JourneyVersion {
  return {
    id: `version-${versionId}`,
    journeyId,
    versionId,
    notes: null,
    createdBy: null,
    createdAt: new Date(0),
  };
}

// =============================================================================
// MINDSTATE DATA BUILDERS
// =============================================================================

function buildMindstateDefinition(key = "mock-mindstate"): MindstateDefinition {
  return {
    id: `mindstate-${key}`,
    organizationId: "mock-org",
    key,
    name: "Mock Mindstate",
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

function buildClientMindstate(definitionId = "mock-definition"): ClientMindstate {
  return {
    id: `client-mindstate-${definitionId}`,
    clientId: "mock-client",
    definitionId,
    stateParameters: [],
    systemAgents: [],
    agentInsights: [],
    lastAnalyzedAt: null,
    createdAt: undefined,
    updatedAt: undefined,
  };
}

function buildMindstateDefinitionVersion(
  definitionId = "mock-definition",
  versionId = "v000"
): MindstateDefinitionVersion {
  return {
    id: `version-${versionId}`,
    definitionId,
    versionId,
    notes: null,
    createdBy: null,
    createdAt: new Date(0),
  };
}

function buildVersionedMindstateData(
  definitionId = "mock-definition",
  versionId = "v000"
): VersionedMindstateData {
  return {
    version: buildMindstateDefinitionVersion(definitionId, versionId),
    data: {
      mainAgentConfig: DEFAULT_MAIN_AGENT,
      defaultAgents: [],
      defaultParameters: [],
      analysisMode: "automatic",
      categories: [],
    },
  };
}

// =============================================================================
// WORKFLOW DATA BUILDERS
// =============================================================================

function buildWorkflow(key = "mock-workflow"): AgentWorkflow {
  return {
    id: `workflow-${key}`,
    orgId: "mock-org",
    key,
    name: "Mock Workflow",
    description: undefined,
    status: "draft",
    configuration: { nodes: [], edges: [] },
    settings: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    createdBy: undefined,
    updatedBy: undefined,
    deletedAt: undefined,
  };
}

function buildWorkflowVersion(workflowId = "mock-workflow", versionId = "v000"): WorkflowVersion {
  return {
    id: `version-${versionId}`,
    workflowId,
    versionId,
    notes: null,
    createdBy: null,
    createdAt: new Date(0),
  };
}

function buildVersionedWorkflowData(
  workflowId = "mock-workflow",
  versionId = "v000"
): VersionedWorkflowData {
  return {
    version: buildWorkflowVersion(workflowId, versionId),
    data: { nodes: [], edges: [] },
  };
}

function buildApprovalRecord(id = "mock-approval"): ApprovalRecord {
  return {
    id,
    workflowId: "mock-workflow",
    workflowRunId: "mock-run",
    orgId: "mock-org",
    nodeId: "mock-node",
    message: "Mock approval",
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

// =============================================================================
// PROMPT DATA BUILDERS
// =============================================================================

function buildPromptResponse(name = "mock-prompt"): PromptResponse {
  return {
    id: `prompt-${name}`,
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

function buildPromptVersion(versionId = "v000"): PromptVersionResponse {
  return {
    id: `version-${versionId}`,
    versionId,
    content: "",
    labels: [],
    notes: null,
    createdBy: null,
    createdAt: new Date(0),
  };
}

// =============================================================================
// SIMULATOR DATA BUILDERS
// =============================================================================

function buildPersona(id = "mock-persona"): Persona {
  return {
    id,
    organizationId: "mock-org",
    name: "Mock Persona",
    clientId: null,
    profile: {},
    userVars: {},
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

// =============================================================================
// SERVICE FACTORY
// =============================================================================

export function createTestServices(overrides: Partial<ServiceContainer> = {}): ServiceContainer {
  const { services } = createMockServices();
  return { ...services, ...overrides };
}

// =============================================================================
// MOCK SERVICES (with vi.fn() for all methods)
// =============================================================================

/**
 * Mock record type - Record of mock functions keyed by method name.
 */
type MockRecord = Record<string, ReturnType<typeof vi.fn>>;

export function createMockServices(): {
  services: ServiceContainer;
  mocks: {
    variable: MockRecord;
    tag: MockRecord;
    crm: MockRecord;
    channel: MockRecord;
    journey: MockRecord;
    user: MockRecord;
    prompt: MockRecord;
    event: MockRecord;
    upload: MockRecord;
    workflow: MockRecord;
    mindstate: MockRecord;
    simulator: MockRecord;
  };
} {
  // ---------------------------------------------------------------------------
  // Variable Service Mocks
  // ---------------------------------------------------------------------------
  const variableMocks = {
    getAll: vi.fn(async () => ({})),
    executeAction: vi.fn(async () => {}),
    getValue: vi.fn(async () => undefined),
    setValue: vi.fn(async () => {}),
    executeOperation: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    exists: vi.fn(async () => false),
    getGlobalVariables: vi.fn(async () => []),
    getGlobalVariable: vi.fn(async () => null),
    setGlobalVariable: vi.fn(async (key: string, _value: unknown, _description?: string) => ({
      ...buildGlobalVariable(),
      key,
    })),
    deleteGlobalVariable: vi.fn(async () => false),
    getJourneyVariables: vi.fn(async (_journeyId: string) => []),
    getJourneyVariable: vi.fn(async (_journeyId: string, _key: string) => null),
    setJourneyVariable: vi.fn(async (journeyId: string, key: string, _value: unknown, _description?: string) => ({
      ...buildJourneyVariable(journeyId),
      key,
    })),
    deleteJourneyVariable: vi.fn(async () => false),
    getUserVariables: vi.fn(async (_clientId: string) => []),
    getUserVariable: vi.fn(async (_clientId: string, _key: string) => null),
    setUserVariable: vi.fn(async (clientId: string, key: string, _value: unknown, _description?: string) => ({
      ...buildUserVariable(clientId),
      key,
    })),
    deleteUserVariable: vi.fn(async () => false),
    executeOperations: vi.fn(async () => {}),
    getVariablesAsMap: vi.fn(async () => ({})),
  };

  // ---------------------------------------------------------------------------
  // Tag Service Mocks
  // ---------------------------------------------------------------------------
  const tagMocks = {
    executeTagAction: vi.fn(async () => {}),
    getTags: vi.fn(async () => []),
    getAllAvailableTags: vi.fn(async () => []),
    getClientTags: vi.fn(async (_clientId: string) => []),
    getClientTagNames: vi.fn(async (_clientId: string) => []),
    assignTagToClient: vi.fn(async () => {}),
    removeTagFromClient: vi.fn(async () => false),
    executeOperations: vi.fn(async () => {}),
    getAllUniqueTagsForOrganization: vi.fn(async () => []),
    getAllTagsForUsers: vi.fn(async (_clientIds: string[]) => new Map<string, string[]>()),
    verifyClientBelongsToOrg: vi.fn(async () => false),
    getTagDefinitions: vi.fn(async () => []),
    getTagDefinitionByName: vi.fn(async (_name: string) => null),
    createTagDefinition: vi.fn(async (input: CreateTagDefinitionParams) => buildTagDefinition(input.name)),
    updateTagDefinition: vi.fn(async (_tagId: string, updates: UpdateTagDefinitionParams) => {
      const name = updates.name ?? "mock-tag";
      return buildTagDefinition(name);
    }),
    deleteTagDefinition: vi.fn(async () => false),
    ensureTag: vi.fn(async (name: string) => buildTagDefinition(name).id),
    ensureTags: vi.fn(async (names: string[]) => {
      const entries: Array<[string, string]> = names.map((name) => [name, buildTagDefinition(name).id]);
      return new Map(entries);
    }),
  };

  // ---------------------------------------------------------------------------
  // CRM Service Mocks
  // ---------------------------------------------------------------------------
  const defaultPipeline = buildPipeline("default");
  const defaultStage = buildStage(defaultPipeline.id, "default-stage");

  const crmMocks = {
    // ICrmService (engine compatibility)
    updateClientPosition: vi.fn(async () => {}),
    addToPipeline: vi.fn(async () => {}),
    removeFromPipeline: vi.fn(async () => {}),
    moveToStage: vi.fn(async () => {}),
    getPipelines: vi.fn(async () => [buildPipelineWithCounts()]),
    getStages: vi.fn(async () => [buildStageWithCounts()]),
    getDefaultPipeline: vi.fn(async () => defaultPipeline),

    // IApiCrmService extensions
    createDefaultPipeline: vi.fn(async () => defaultPipeline),
    getPipeline: vi.fn(async (pipelineId: string) => ({ ...defaultPipeline, id: pipelineId })),
    getPipelineBySlug: vi.fn(async (slug: string) => ({ ...defaultPipeline, slug })),
    ensureDefaultPipeline: vi.fn(async () => defaultPipeline),
    createPipeline: vi.fn(async (data: CreatePipelineInput) => buildPipeline(data.name)),
    updatePipeline: vi.fn(async (pipelineId: string, data: UpdatePipelineInput) => ({
      ...defaultPipeline,
      id: pipelineId,
      name: data.name ?? defaultPipeline.name,
    })),
    deletePipeline: vi.fn(async () => false),
    reorderPipelines: vi.fn(async () => {}),
    setDefaultPipeline: vi.fn(async () => {}),

    // Stages
    getPipelineStages: vi.fn(async () => [buildStageWithCounts()]),
    getPipelineStageById: vi.fn(async (stageId: string) => ({ ...defaultStage, id: stageId })),
    createPipelineStage: vi.fn(async (data: CreateStageInput) => buildStage(data.pipelineId, data.name)),
    updatePipelineStage: vi.fn(async (stageId: string, data: UpdateStageInput) => ({
      ...defaultStage,
      id: stageId,
      name: data.name ?? defaultStage.name,
    })),
    deletePipelineStage: vi.fn(async () => false),
    reorderPipelineStages: vi.fn(async () => {}),
    getClientStage: vi.fn(async () => null),
    getClientStages: vi.fn(async () => []),
    getClientStageHistory: vi.fn(async () => []),
    getClientsByStage: vi.fn(async () => []),
    getDefaultStage: vi.fn(async () => defaultStage),
    assignClientToDefaultPipeline: vi.fn(async () => {}),
    assignClientToStage: vi.fn(async () => {}),
    removeClientFromPipeline: vi.fn(async () => false),
    assignClientToPipeline: vi.fn(async () => {}),

    // Fields
    getCustomFields: vi.fn(async () => []),
    getCustomFieldById: vi.fn(async () => null),
    createCustomField: vi.fn(async () => ({ id: "mock-field", organizationId: "mock-org", name: "Mock", key: "mock", fieldType: "text" as const, description: null, validation: null, isRequired: null, position: 0, defaultValue: null, createdAt: null, updatedAt: null })),
    updateCustomField: vi.fn(async () => null),
    deleteCustomField: vi.fn(async () => false),
    reorderCustomFields: vi.fn(async () => {}),
    getClientFieldValues: vi.fn(async () => []),
    updateClientFieldValues: vi.fn(async () => {}),

    // Clients
    getClientCrmProfile: vi.fn(async () => null),
    getCrmClients: vi.fn(async () => ({ clients: [], total: 0 })),
    getClientsByStages: vi.fn(async () => new Map()),

    // Activity & Messaging
    getClientTimeline: vi.fn(async () => []),
    sendDirectMessage: vi.fn(async () => ({ success: true, messageId: "mock-message" })),
    getClientMessages: vi.fn(async () => []),
  };

  // ---------------------------------------------------------------------------
  // Channel Service Mocks
  // ---------------------------------------------------------------------------
  const channelMocks = {
    // Bots
    createBot: vi.fn(async () => buildBotRecord()),
    getOrganizationBots: vi.fn(async () => []),
    getOrganizationBot: vi.fn(async () => null),
    updateBot: vi.fn(async () => null),
    deleteBot: vi.fn(async () => false),
    reregisterWebhook: vi.fn(async () => false),

    // Clients
    findOrCreateChannelUser: vi.fn(async () => "mock-client"),
    getClientById: vi.fn(async () => null),
    deleteChannelUser: vi.fn(async () => false),
    getChannelUserVars: vi.fn(async () => ({})),
    updateChannelUserVars: vi.fn(async () => {}),

    // Sessions
    getChannelBot: vi.fn(async () => null),
    getBotByToken: vi.fn(async () => null),
    getChannelOrganizationId: vi.fn(async () => "mock-org"),
    findActiveSession: vi.fn(async () => null),
    createSession: vi.fn(async () => buildSessionRecord()),
    updateSession: vi.fn(async () => {}),
    getSessionById: vi.fn(async () => null),
    deleteSession: vi.fn(async () => false),

    // Journey lookups
    getJourneyConfig: vi.fn(async () => buildJourneyConfig()),
    getJourneyOrganizationId: vi.fn(async () => "mock-org"),
    getJourneyDefaultPipelineId: vi.fn(async () => null),
    getJourneyMindstateConfig: vi.fn(async () => null),
    getJourneyName: vi.fn(async () => "Mock Journey"),
    getJourneyStatus: vi.fn(async () => "active" as const),

    // Interactions
    saveInteraction: vi.fn(async () => "mock-interaction"),

    // Session queries
    getSessionsByJourneyId: vi.fn(async () => []),
    getSessionWithInteractions: vi.fn(async () => null),
    getActiveSessionsForJourney: vi.fn(async () => []),
    getPausedSessionsForJourney: vi.fn(async () => []),
    getActiveSessionCountForJourney: vi.fn(async () => 0),
    bulkUpdateSessionStatus: vi.fn(async () => 0),
    resetJourneySessions: vi.fn(async () => 0),

    // Messages
    saveSentMessages: vi.fn(async () => {}),
    getLastMessageForSession: vi.fn(async () => null),
    getMessagesForSession: vi.fn(async () => []),
  };

  // ---------------------------------------------------------------------------
  // Journey Service Mocks
  // ---------------------------------------------------------------------------
  const journeyMocks = {
    getOrganizationJourneys: vi.fn(async () => []),
    getJourneyById: vi.fn(async () => null),
    createJourney: vi.fn(async (_organizationId: string, _userId: string, data: { name: string }) => buildJourneyRecord({ name: data.name })),
    updateJourney: vi.fn(async () => buildJourneyRecord()),
    deleteJourney: vi.fn(async () => false),
    deactivateJourney: vi.fn(async () => ({ sessionsAffected: 0, timersAffected: 0 })),
    reactivateJourney: vi.fn(async () => ({ sessionsAffected: 0, timersAffected: 0 })),
    listVersions: vi.fn(async () => []),
    saveVersion: vi.fn(async (journeyId: string, _organizationId: string, _userId: string, data: { versionId: string }) => buildJourneyVersion(journeyId, data.versionId)),
    getVersion: vi.fn(async () => ({ version: buildJourneyVersion(), data: buildJourneyConfig() })),
    deleteVersion: vi.fn(async () => false),
    saveVersionAtomic: vi.fn(async () => ({ version: buildJourneyVersion(), versionId: "v000" })),
  };

  // ---------------------------------------------------------------------------
  // User Service Mocks
  // ---------------------------------------------------------------------------
  const userMocks = {
    listOrganizationUsers: vi.fn(async () => ({ users: [], total: 0 })),
    listUserSessions: vi.fn(async () => []),
    listUserActivity: vi.fn(async () => []),
    userHasSessionsInOrg: vi.fn(async () => false),
  };

  // ---------------------------------------------------------------------------
  // Prompt Service Mocks
  // ---------------------------------------------------------------------------
  const promptMocks = {
    listPrompts: vi.fn(async () => ({ prompts: [], total: 0 })),
    getPromptByName: vi.fn(async (name: string) => buildPromptResponse(name)),
    getPromptById: vi.fn(async (id: string) => buildPromptResponse(id)),
    createPrompt: vi.fn(async (_userId: string, input: { name: string }) => buildPromptResponse(input.name)),
    updatePrompt: vi.fn(async (name: string) => buildPromptResponse(name)),
    deletePrompt: vi.fn(async () => {}),
    listVersions: vi.fn(async () => []),
    getVersion: vi.fn(async (_name: string, versionId: string) => buildPromptVersion(versionId)),
    getVersionByLabel: vi.fn(async (_name: string, label: string) => buildPromptVersion(label)),
    createVersion: vi.fn(async (_name: string, _userId: string, input: { labels?: string[] }) =>
      buildPromptVersion(input.labels?.[0] ?? "v000")
    ),
    updateLabels: vi.fn(async () => buildPromptVersion()),
    deleteVersion: vi.fn(async () => {}),
    compilePrompt: vi.fn(async (name: string) => ({
      name,
      type: "text" as const,
      versionId: "v000",
      label: "production",
      content: "",
    })),
    compileTextPrompt: vi.fn((content: string) => content),
    compileChatPrompt: vi.fn((messages: Array<{ role: "user" | "system" | "assistant"; content: string }>) => messages),
    extractVariables: vi.fn(() => []),
    extractVariablePaths: vi.fn(() => []),
    validateVariables: vi.fn(() => ({ valid: true, missing: [] })),
  };

  // ---------------------------------------------------------------------------
  // Event Service Mocks
  // ---------------------------------------------------------------------------
  const eventMocks = {
    listInteractionEvents: vi.fn(async () => ({ events: [], total: 0 })),
    getEventStats: vi.fn(async () => ({ total: 0, last24h: 0, byType: {} })),
    listEventTypes: vi.fn(async () => []),
    listCrmEvents: vi.fn(async () => ({ events: [], total: 0 })),
    listLlmEvents: vi.fn(async () => ({ events: [], total: 0 })),
    getLlmStats: vi.fn(async () => ({
      totals: { tokens: 0, costUSD: "0", calls: 0 },
      byModel: {},
      byService: {},
      filters: { services: [], models: [], providers: [] },
    })),
    replayEvents: vi.fn(async () => ({ events: [], total: 0 })),
    getLatestReplaySequence: vi.fn(async () => 0),
  };

  // ---------------------------------------------------------------------------
  // Upload Service Mocks
  // ---------------------------------------------------------------------------
  const uploadMocks = {
    saveJourneyMedia: vi.fn(async () => {}),
    listJourneyMedia: vi.fn(async () => []),
    getJourneyMediaById: vi.fn(async () => null),
    deleteJourneyMediaById: vi.fn(async () => {}),
    isMediaUsedInJourney: vi.fn(async () => false),
  };

  // ---------------------------------------------------------------------------
  // Workflow Service Mocks
  // ---------------------------------------------------------------------------
  const workflowMocks = {
    listWorkflows: vi.fn(async () => ({ workflows: [], total: 0, limit: 0, offset: 0 })),
    getWorkflowByKey: vi.fn(async () => null),
    createWorkflow: vi.fn(async (_userId: string, data: { key: string }) => buildWorkflow(data.key)),
    updateWorkflow: vi.fn(async (_userId: string, key: string) => buildWorkflow(key)),
    deleteWorkflow: vi.fn(async () => {}),
    validateWorkflowConfig: vi.fn(async () => ({ valid: true, errors: [], warnings: [] })),
    listWorkflowVersions: vi.fn(async () => []),
    saveWorkflowVersion: vi.fn(async (workflowKey: string) => buildWorkflowVersion(workflowKey)),
    getWorkflowVersion: vi.fn(async (workflowKey: string, versionId: string) =>
      buildVersionedWorkflowData(workflowKey, versionId)
    ),
    deleteWorkflowVersion: vi.fn(async () => false),
    saveVersionAtomic: vi.fn(async (workflowKey: string) => ({
      version: buildWorkflowVersion(workflowKey, "v000"),
      versionId: "v000",
    })),
    listApprovals: vi.fn(async () => ({ approvals: [], total: 0, limit: 0, offset: 0 })),
    getApproval: vi.fn(async () => null),
    respondToApproval: vi.fn(async (id: string) => buildApprovalRecord(id)),
    createWorkflowEmitter: vi.fn(() => () => {}),
  };

  // ---------------------------------------------------------------------------
  // Mindstate Service Mocks
  // ---------------------------------------------------------------------------
  const mindstateMocks = {
    listDefinitions: vi.fn(async () => []),
    ensureDefaultMindstate: vi.fn(async () => false),
    getDefinition: vi.fn(async () => null),
    getDefinitionById: vi.fn(async () => null),
    createDefinition: vi.fn(async (data: { key: string }) => buildMindstateDefinition(data.key)),
    updateDefinition: vi.fn(async () => buildMindstateDefinition()),
    deleteDefinition: vi.fn(async () => false),
    previewAnalyzeMessage: vi.fn(async () => ({
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
    })),
    listVersions: vi.fn(async () => []),
    getVersion: vi.fn(async (definitionId: string, versionId: string) =>
      buildVersionedMindstateData(definitionId, versionId)
    ),
    deleteVersion: vi.fn(async () => false),
    saveVersionAtomic: vi.fn(async (definitionId: string) => ({
      version: buildMindstateDefinitionVersion(definitionId, "v000"),
      versionId: "v000",
    })),
    listClientMindstates: vi.fn(async () => []),
    getOrCreateClientMindstate: vi.fn(async (_clientId: string, key: string) => buildClientMindstate(key)),
    analyzeMessage: vi.fn(async () => ({
      mindstateId: "mock-mindstate",
      changes: [],
      newInsights: [],
      metrics: {
        durationMs: 0,
        agentCount: 0,
        parameterCount: 0,
        changesCount: 0,
      },
      responseMessage: undefined,
    })),
    getAnalysisHistory: vi.fn(async () => []),
    getParameterValue: vi.fn(async () => null),
    getParameterValues: vi.fn(async () => new Map()),
    getMindstateContext: vi.fn(async () => ({})),
  };

  // ---------------------------------------------------------------------------
  // Simulator Service Mocks
  // ---------------------------------------------------------------------------
  const simulatorMocks = {
    createSession: vi.fn(async () => ({
      sessionId: "mock-session",
      clientId: "mock-client",
      journeyId: "mock-journey",
      currentNodeId: "mock-node",
      status: "active",
    })),
    executeInput: vi.fn(async () => {}),
    getSessionRecord: vi.fn(async () => null),
    cleanupSession: vi.fn(async () => {}),
    updateSessionState: vi.fn(async () => {}),
    listActiveTimers: vi.fn(async () => []),
    getActiveTimer: vi.fn(async () => null),
    getActiveSessionCount: vi.fn(() => 0),
    listPersonas: vi.fn(async () => []),
    getPersona: vi.fn(async () => null),
    createPersona: vi.fn(async () => buildPersona()),
    updatePersona: vi.fn(async (id: string) => buildPersona(id)),
    deletePersona: vi.fn(async () => false),
    resetPersonaData: vi.fn(async () => ({
      tagsDeleted: 0,
      crmStagesDeleted: 0,
      sessionsDeleted: 0,
      variablesReset: false,
    })),
    cleanupAllTestData: vi.fn(async () => ({
      personasReset: 0,
      anonymousClientsDeleted: 0,
      totalTagsDeleted: 0,
      totalSessionsDeleted: 0,
    })),
  };

  // ---------------------------------------------------------------------------
  // Assemble Services
  // ---------------------------------------------------------------------------
  const variable: IApiVariableService = variableMocks;
  const tag: IApiTagService = tagMocks;
  const crm: IApiCrmService = crmMocks;
  const channel: IApiChannelService = channelMocks;
  const journey: IApiJourneyService = journeyMocks;
  const user: IApiUserService = userMocks;
  const prompt: IApiPromptService = promptMocks;
  const event: IApiEventService = eventMocks;
  const upload: IApiUploadService = uploadMocks;
  const workflow: IApiWorkflowService = workflowMocks;
  const mindstate: IApiMindstateService = mindstateMocks;
  const simulator: IApiSimulatorService = simulatorMocks;

  return {
    services: {
      variable,
      tag,
      crm,
      channel,
      journey,
      user,
      prompt,
      event,
      upload,
      workflow,
      mindstate,
      simulator,
    },
    mocks: {
      variable: variableMocks,
      tag: tagMocks,
      crm: crmMocks,
      channel: channelMocks,
      journey: journeyMocks,
      user: userMocks,
      prompt: promptMocks,
      event: eventMocks,
      upload: uploadMocks,
      workflow: workflowMocks,
      mindstate: mindstateMocks,
      simulator: simulatorMocks,
    },
  };
}

// =============================================================================
// EXPORTED BUILDERS (for custom test data)
// =============================================================================

export const testBuilders = {
  // Core builders
  tagDefinition: buildTagDefinition,
  globalVariable: buildGlobalVariable,
  journeyVariable: buildJourneyVariable,
  userVariable: buildUserVariable,
  pipeline: buildPipeline,
  pipelineWithCounts: buildPipelineWithCounts,
  stage: buildStage,
  stageWithCounts: buildStageWithCounts,
  botRecord: buildBotRecord,
  sessionRecord: buildSessionRecord,
  journeyConfig: buildJourneyConfig,
  journeyRecord: buildJourneyRecord,
  journeyVersion: buildJourneyVersion,
  // Mindstate builders
  mindstateDefinition: buildMindstateDefinition,
  clientMindstate: buildClientMindstate,
  mindstateDefinitionVersion: buildMindstateDefinitionVersion,
  versionedMindstateData: buildVersionedMindstateData,
  // Workflow builders
  workflow: buildWorkflow,
  workflowVersion: buildWorkflowVersion,
  versionedWorkflowData: buildVersionedWorkflowData,
  approvalRecord: buildApprovalRecord,
  // Prompt builders
  promptResponse: buildPromptResponse,
  promptVersion: buildPromptVersion,
  // Simulator builders
  persona: buildPersona,
};
