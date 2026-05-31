import type { DbClient } from "@journey/db";

import type { SessionQueryContext } from "../../channels/services/service-context";
import type { IEventPublisher } from "../../../services/interfaces";

export interface JourneyServiceContext {
  db: DbClient;
  publisher: IEventPublisher;
  /**
   * Minimal context for session queries.
   * Only contains db access - avoids circular dependency where
   * ChannelServiceContext requires journeyService which requires ChannelServiceContext.
   */
  sessionQueryContext: SessionQueryContext;
}
