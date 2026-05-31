/**
 * Events API
 *
 * Operations for fetching event logs and statistics.
 *
 * @module lib/api/events
 */

import type { EnrichedEvent } from "@journey/schemas";
import { apiUrl, authFetch } from "./base";

// =============================================================================
// TYPES
// =============================================================================

export interface EventsResponse {
  events: EnrichedEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface EventStatsResponse {
  total: number;
  last24h: number;
  byType: Record<string, number>;
}

export interface EventTypeInfo {
  type: string;
  label: string;
  level: string;
}

export interface EventTypesResponse {
  types: EventTypeInfo[];
}

export interface EventsQueryOptions {
  types?: string[];
  startDate?: string;
  endDate?: string;
  sessionId?: string;
  journeyId?: string;
  limit?: number;
  offset?: number;
}

export interface CrmActivityQueryOptions {
  types?: string[];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface CrmActivity {
  id: string;
  clientId: string | null;
  activityType: string;
  description: string;
  metadata: Record<string, unknown> | null;
  performedBy: string | null;
  createdAt: string;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientUsername: string | null;
}

export interface CrmActivityResponse {
  activities: CrmActivity[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface EventReplayQueryOptions {
  sinceSequence?: number;
  startDate?: string;
  endDate?: string;
  types?: string[];
  clientId?: string;
  sessionId?: string;
  journeyId?: string;
  limit?: number;
  offset?: number;
}

export interface EventReplayResponse {
  events: EnrichedEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface LatestSequenceResponse {
  latestSequence: number;
}

export interface EventHealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  components: {
    redis: {
      status: "healthy" | "degraded" | "unhealthy";
      latency?: number;
      message?: string;
    };
    eventBus: {
      status: "healthy" | "degraded" | "unhealthy";
      message?: string;
    };
    queues: {
      status: "healthy" | "degraded" | "unhealthy";
      latency?: number;
      message?: string;
    };
  };
  metrics?: {
    redisConnections?: number;
  };
}

// =============================================================================
// LLM USAGE TYPES
// =============================================================================

export interface LlmUsageQueryOptions {
  services?: string[];
  models?: string[];
  providers?: string[];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/** Message format for LLM I/O */
export interface LlmMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
}

/** Tool call format for LLM I/O */
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

  // I/O Content for debugging
  systemPrompt: string | null;
  inputMessages: LlmMessage[] | null;
  outputContent: string | null;
  outputToolCalls: LlmToolCall[] | null;
  finishReason: string | null;
  errorMessage: string | null;

  metadata: Record<string, unknown> | null;
  createdAt: string;
  journeyName: string | null;
  journeySlug: string | null;
}

export interface LlmUsageResponse {
  events: LlmUsageEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface LlmUsageStatsResponse {
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

// =============================================================================
// API FUNCTIONS
// =============================================================================

export const eventsApi = {
  /**
   * Fetch events with optional filters
   */
  async getEvents(options: EventsQueryOptions = {}): Promise<EventsResponse> {
    const params = new URLSearchParams();

    if (options.types && options.types.length > 0) {
      params.set("types", options.types.join(","));
    }
    if (options.startDate) {
      params.set("startDate", options.startDate);
    }
    if (options.endDate) {
      params.set("endDate", options.endDate);
    }
    if (options.sessionId) {
      params.set("sessionId", options.sessionId);
    }
    if (options.journeyId) {
      params.set("journeyId", options.journeyId);
    }
    if (options.limit) {
      params.set("limit", String(options.limit));
    }
    if (options.offset) {
      params.set("offset", String(options.offset));
    }

    const queryString = params.toString();
    const url = queryString ? `${apiUrl}/api/events?${queryString}` : `${apiUrl}/api/events`;

    return authFetch<EventsResponse>(url, undefined, {
      action: "getEvents",
      logContext: {
        types: options.types,
        sessionId: options.sessionId,
        journeyId: options.journeyId,
      },
    });
  },

  /**
   * Fetch event statistics
   */
  async getEventStats(): Promise<EventStatsResponse> {
    return authFetch<EventStatsResponse>(`${apiUrl}/api/events/stats`, undefined, {
      action: "getEventStats",
    });
  },

  /**
   * Fetch available event types
   */
  async getEventTypes(): Promise<EventTypesResponse> {
    return authFetch<EventTypesResponse>(`${apiUrl}/api/events/types`, undefined, {
      action: "getEventTypes",
    });
  },

  /**
   * Fetch CRM activity log
   */
  async getCrmActivityLog(options: CrmActivityQueryOptions = {}): Promise<CrmActivityResponse> {
    const params = new URLSearchParams();

    if (options.types && options.types.length > 0) {
      params.set("types", options.types.join(","));
    }
    if (options.startDate) {
      params.set("startDate", options.startDate);
    }
    if (options.endDate) {
      params.set("endDate", options.endDate);
    }
    if (options.limit) {
      params.set("limit", String(options.limit));
    }
    if (options.offset) {
      params.set("offset", String(options.offset));
    }

    const queryString = params.toString();
    const url = queryString ? `${apiUrl}/api/events/crm?${queryString}` : `${apiUrl}/api/events/crm`;

    return authFetch<CrmActivityResponse>(url, undefined, {
      action: "getCrmActivityLog",
      logContext: {
        types: options.types,
      },
    });
  },

  /**
   * Replay events from the events table (for rebuilding state, debugging)
   */
  async replayEvents(options: EventReplayQueryOptions = {}): Promise<EventReplayResponse> {
    const params = new URLSearchParams();

    if (options.sinceSequence !== undefined) {
      params.set("sinceSequence", String(options.sinceSequence));
    }
    if (options.types && options.types.length > 0) {
      params.set("types", options.types.join(","));
    }
    if (options.startDate) {
      params.set("startDate", options.startDate);
    }
    if (options.endDate) {
      params.set("endDate", options.endDate);
    }
    if (options.clientId) {
      params.set("clientId", options.clientId);
    }
    if (options.sessionId) {
      params.set("sessionId", options.sessionId);
    }
    if (options.journeyId) {
      params.set("journeyId", options.journeyId);
    }
    if (options.limit) {
      params.set("limit", String(options.limit));
    }
    if (options.offset) {
      params.set("offset", String(options.offset));
    }

    const queryString = params.toString();
    const url = queryString ? `${apiUrl}/api/events/replay?${queryString}` : `${apiUrl}/api/events/replay`;

    return authFetch<EventReplayResponse>(url, undefined, {
      action: "replayEvents",
      logContext: {
        sinceSequence: options.sinceSequence,
        types: options.types,
      },
    });
  },

  /**
   * Get the latest sequence number for the organization
   */
  async getLatestSequence(): Promise<LatestSequenceResponse> {
    return authFetch<LatestSequenceResponse>(`${apiUrl}/api/events/replay/latest`, undefined, {
      action: "getLatestSequence",
    });
  },

  /**
   * Get event system health status
   */
  async getHealth(): Promise<EventHealthResponse> {
    return authFetch<EventHealthResponse>(`${apiUrl}/api/events/health`, undefined, {
      action: "getEventHealth",
    });
  },

  /**
   * Fetch LLM usage events
   */
  async getLlmUsage(options: LlmUsageQueryOptions = {}): Promise<LlmUsageResponse> {
    const params = new URLSearchParams();

    if (options.services && options.services.length > 0) {
      params.set("services", options.services.join(","));
    }
    if (options.models && options.models.length > 0) {
      params.set("models", options.models.join(","));
    }
    if (options.providers && options.providers.length > 0) {
      params.set("providers", options.providers.join(","));
    }
    if (options.startDate) {
      params.set("startDate", options.startDate);
    }
    if (options.endDate) {
      params.set("endDate", options.endDate);
    }
    if (options.limit) {
      params.set("limit", String(options.limit));
    }
    if (options.offset) {
      params.set("offset", String(options.offset));
    }

    const queryString = params.toString();
    const url = queryString ? `${apiUrl}/api/events/llm?${queryString}` : `${apiUrl}/api/events/llm`;

    return authFetch<LlmUsageResponse>(url, undefined, {
      action: "getLlmUsage",
      logContext: {
        services: options.services,
        models: options.models,
      },
    });
  },

  /**
   * Fetch LLM usage statistics
   */
  async getLlmUsageStats(): Promise<LlmUsageStatsResponse> {
    return authFetch<LlmUsageStatsResponse>(`${apiUrl}/api/events/llm/stats`, undefined, {
      action: "getLlmUsageStats",
    });
  },
};
