import type { DbClient } from "@journey/db";

import type { IEventPublisher } from "../../../services/interfaces";

export interface SimulatorServiceContext {
  db: DbClient;
  organizationId: string;
  publisher: IEventPublisher;
}
