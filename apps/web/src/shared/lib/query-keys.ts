export const journeyKeys = {
  all: ["journeys"] as const,
  list: () => [...journeyKeys.all, "list"] as const,
  detail: (id: string) => [...journeyKeys.all, id] as const,
  sessions: (id: string) => [...journeyKeys.all, id, "sessions"] as const,
  session: (journeyId: string, file: string) => [...journeyKeys.all, journeyId, "session", file] as const,
  activeSessionsCount: (id: string) => [...journeyKeys.all, id, "activeSessionsCount"] as const,
} as const;

// Session keys for Users Viewer
export const sessionKeys = {
  all: ["sessions"] as const,
  list: (journeyId: string, status?: string) => [...sessionKeys.all, "list", journeyId, status ?? "all"] as const,
  detail: (sessionId: string) => [...sessionKeys.all, "detail", sessionId] as const,
} as const;

// Channel keys for channel management
export const channelKeys = {
  all: ["channels"] as const,
  list: () => [...channelKeys.all, "list"] as const,
  detail: (channelId: string) => [...channelKeys.all, channelId] as const,
} as const;

// Upload keys
export const uploadKeys = {
  all: ["uploads"] as const,
  config: ["uploads", "config"] as const,
  gallery: (journeyId: string) => [...uploadKeys.all, "gallery", journeyId] as const,
} as const;

// Variable keys
export const variableKeys = {
  all: ["variables"] as const,
  global: () => [...variableKeys.all, "global"] as const,
  globalDetail: (key: string) => [...variableKeys.all, "global", key] as const,
  journey: (journeyId: string) => [...variableKeys.all, "journey", journeyId] as const,
  journeyDetail: (journeyId: string, key: string) => [...variableKeys.all, "journey", journeyId, key] as const,
} as const;

// Tag keys
export const tagKeys = {
  all: ["tags"] as const,
  global: () => [...tagKeys.all, "global"] as const,
  user: (channelUserId: string) => [...tagKeys.all, "user", channelUserId] as const,
} as const;

// Event keys
export const eventKeys = {
  all: ["events"] as const,
  list: (filters?: { types?: string[]; startDate?: string; endDate?: string }) =>
    filters ? ([...eventKeys.all, "list", filters] as const) : ([...eventKeys.all, "list"] as const),
  stats: () => [...eventKeys.all, "stats"] as const,
  types: () => [...eventKeys.all, "types"] as const,
  crmActivity: (filters?: { types?: string[]; startDate?: string; endDate?: string }) =>
    filters ? ([...eventKeys.all, "crm", filters] as const) : ([...eventKeys.all, "crm"] as const),
  llmUsage: (filters?: { services?: string[]; models?: string[]; providers?: string[]; startDate?: string; endDate?: string }) =>
    filters ? ([...eventKeys.all, "llm", filters] as const) : ([...eventKeys.all, "llm"] as const),
  llmUsageStats: () => [...eventKeys.all, "llm", "stats"] as const,
} as const;

// CRM keys
export const crmKeys = {
  all: ["crm"] as const,
  pipelines: () => [...crmKeys.all, "pipelines"] as const,
  pipeline: (pipelineId: string) => [...crmKeys.all, "pipeline", pipelineId] as const,
  stages: (pipelineId?: string) =>
    pipelineId ? ([...crmKeys.all, "stages", pipelineId] as const) : ([...crmKeys.all, "stages"] as const),
  // When called without filters, returns 2-element array for proper prefix matching in invalidation
  // When called with filters, returns 3-element array for specific query caching
  clients: (filters?: { stageId?: string; stageIds?: string[]; pipelineId?: string; journeyId?: string; search?: string; tags?: string[] }) =>
    filters ? ([...crmKeys.all, "clients", filters] as const) : ([...crmKeys.all, "clients"] as const),
  client: (clientId: string) => [...crmKeys.all, "client", clientId] as const,
  clientTimeline: (clientId: string) => [...crmKeys.all, "client", clientId, "timeline"] as const,
  clientMessages: (clientId: string) => [...crmKeys.all, "client", clientId, "messages"] as const,
  fields: () => [...crmKeys.all, "fields"] as const,
} as const;

// Mindstate keys
export const mindstateKeys = {
  all: ["mindstates"] as const,
  definitions: () => [...mindstateKeys.all, "definitions"] as const,
  definition: (keyOrId: string) => [...mindstateKeys.all, "definition", keyOrId] as const,
  client: (clientId: string) => [...mindstateKeys.all, "client", clientId] as const,
  clientMindstate: (clientId: string, key: string) => [...mindstateKeys.all, "client", clientId, key] as const,
  history: (clientId: string, key: string) => [...mindstateKeys.all, "history", clientId, key] as const,
} as const;

// Agent Workflow keys
export const agentWorkflowKeys = {
  all: ["agent-workflows"] as const,
  list: (filters?: { status?: string; search?: string }) =>
    filters ? ([...agentWorkflowKeys.all, "list", filters] as const) : ([...agentWorkflowKeys.all, "list"] as const),
  detail: (key: string) => [...agentWorkflowKeys.all, "detail", key] as const,
  versions: (key: string) => [...agentWorkflowKeys.all, "versions", key] as const,
  version: (key: string, versionId: string) => [...agentWorkflowKeys.versions(key), versionId] as const,
} as const;

// Prompt repository keys
export const promptKeys = {
  all: ["prompts"] as const,
  list: (filters?: { type?: string; search?: string; tags?: string[]; isSystem?: boolean }) =>
    filters ? ([...promptKeys.all, "list", filters] as const) : ([...promptKeys.all, "list"] as const),
  detail: (name: string) => [...promptKeys.all, "detail", name] as const,
  versions: (name: string) => [...promptKeys.all, "versions", name] as const,
  version: (name: string, versionId: string) => [...promptKeys.versions(name), versionId] as const,
  variables: (name: string, versionId?: string) =>
    versionId
      ? ([...promptKeys.all, "variables", name, versionId] as const)
      : ([...promptKeys.all, "variables", name] as const),
} as const;

// User keys for telegram users and user management
export const userKeys = {
  all: ["users"] as const,
  telegramUsers: (filters?: { journeyId?: string }) =>
    filters?.journeyId ? ([...userKeys.all, "telegram", filters] as const) : ([...userKeys.all, "telegram"] as const),
  userTags: () => [...userKeys.all, "tags"] as const,
} as const;

// Combined query keys for easy import
export const queryKeys = {
  journeys: journeyKeys,
  sessions: sessionKeys,
  channels: channelKeys,
  uploadConfig: uploadKeys.config,
  variables: variableKeys,
  tags: tagKeys,
  events: eventKeys,
  crm: crmKeys,
  mindstates: mindstateKeys,
  agentWorkflows: agentWorkflowKeys,
  prompts: promptKeys,
  users: userKeys,
} as const;
