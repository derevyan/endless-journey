import type { DbClient } from "@journey/db";
import type {
  CrmEventFilters,
  EventListFilters,
  EventStats,
  IApiEventService,
  LlmEventFilters,
  LlmUsageStats,
  ReplayFilters,
} from "@journey/schemas";

import {
  getEventStats,
  getLatestReplaySequence,
  getLlmStats,
  listCrmEvents,
  listEventTypes,
  listInteractionEvents,
  listLlmEvents,
  replayEvents,
} from "./event-service";
import type { EventServiceContext } from "./service-context";

export class ApiEventService implements IApiEventService {
  private readonly ctx: EventServiceContext;

  constructor(db: DbClient) {
    this.ctx = { db };
  }

  listInteractionEvents(filters: EventListFilters) {
    return listInteractionEvents(this.ctx, filters);
  }

  getEventStats(organizationId: string): Promise<EventStats> {
    return getEventStats(this.ctx, organizationId);
  }

  listEventTypes(organizationId: string) {
    return listEventTypes(this.ctx, organizationId);
  }

  listCrmEvents(filters: CrmEventFilters) {
    return listCrmEvents(this.ctx, filters);
  }

  listLlmEvents(filters: LlmEventFilters) {
    return listLlmEvents(this.ctx, filters);
  }

  getLlmStats(organizationId: string): Promise<LlmUsageStats> {
    return getLlmStats(this.ctx, organizationId);
  }

  replayEvents(filters: ReplayFilters) {
    return replayEvents(this.ctx, filters);
  }

  getLatestReplaySequence(organizationId: string): Promise<number> {
    return getLatestReplaySequence(this.ctx, organizationId);
  }
}
