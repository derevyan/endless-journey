export interface EventListFilters {
  organizationId: string;
  types?: string[];
  startDate?: string;
  endDate?: string;
  sessionId?: string;
  journeyId?: string;
  limit: number;
  offset: number;
}

export interface InteractionEventListItem {
  id: string;
  sessionId: string;
  type: string;
  nodeId: string;
  payload: unknown;
  metadata: Record<string, unknown> | null;
  timestamp: Date;
  journeyId: string;
  journeyName: string;
  clientId: string;
}

export interface EventStats {
  total: number;
  last24h: number;
  byType: Record<string, number>;
}

export interface CrmEventFilters {
  organizationId: string;
  eventTypes: string[];
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}

export interface CrmEventListItem {
  id: string;
  type: string;
  clientId: string | null;
  organizationId: string;
  payload: Record<string, unknown> | null;
  performedBy: string | null;
  timestamp: Date;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientUsername: string | null;
}

export interface LlmEventFilters {
  organizationId: string;
  services?: string[];
  models?: string[];
  providers?: string[];
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}

export interface LlmMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  args: unknown;
}

export interface LlmUsageEvent {
  id: string;
  organizationId: string;
  userId: string | null;
  journeyId: string | null;
  journeySessionId: string | null;
  clientId: string | null;
  service: string;
  module: string | null;
  tool: string | null;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: string;
  durationMs: number | null;
  systemPrompt: string | null;
  inputMessages: LlmMessage[] | null;
  outputContent: string | null;
  outputToolCalls: LlmToolCall[] | null;
  finishReason: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  journeyName: string | null;
  journeySlug: string | null;
}

export interface LlmUsageStats {
  totals: {
    tokens: number;
    costUSD: string;
    calls: number;
  };
  byModel: Record<string, { tokens: number; costUSD: string; calls: number }>;
  byService: Record<string, { tokens: number; costUSD: string; calls: number }>;
  filters: {
    services: string[];
    models: string[];
    providers: string[];
  };
}

export interface ReplayFilters {
  organizationId: string;
  sinceSequence?: number;
  startDate?: string;
  endDate?: string;
  types?: string[];
  clientId?: string;
  sessionId?: string;
  journeyId?: string;
  limit: number;
  offset: number;
  order: "asc" | "desc";
}

export interface ReplayEventRecord {
  id: string;
  type: string;
  timestamp: Date;
  version: number;
  organizationId: string;
  clientId: string | null;
  sessionId: string | null;
  journeyId: string | null;
  source: string;
  performedBy: string | null;
  sequence: number;
  correlationId: string | null;
  causedBy: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface IApiEventService {
  listInteractionEvents(filters: EventListFilters): Promise<{ events: InteractionEventListItem[]; total: number }>;
  getEventStats(organizationId: string): Promise<EventStats>;
  listEventTypes(organizationId: string): Promise<string[]>;
  listCrmEvents(filters: CrmEventFilters): Promise<{ events: CrmEventListItem[]; total: number }>;
  listLlmEvents(filters: LlmEventFilters): Promise<{ events: LlmUsageEvent[]; total: number }>;
  getLlmStats(organizationId: string): Promise<LlmUsageStats>;
  replayEvents(filters: ReplayFilters): Promise<{ events: ReplayEventRecord[]; total: number }>;
  getLatestReplaySequence(organizationId: string): Promise<number>;
}
