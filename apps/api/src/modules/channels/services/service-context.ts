import type { DbClient } from "@journey/db";
import type { IApiJourneyService, IApiTagService, IApiVariableService } from "@journey/schemas";

import type { IEventPublisher } from "../../../services/interfaces";

/**
 * Minimal context for session query operations.
 * These functions only need database access, not full service dependencies.
 */
export interface SessionQueryContext {
  db: DbClient;
}

export interface ChannelServiceContext {
  db: DbClient;
  organizationId: string | null;
  publisher: IEventPublisher;
  variableService: IApiVariableService;
  tagService: IApiTagService;
  journeyService: IApiJourneyService;
}
