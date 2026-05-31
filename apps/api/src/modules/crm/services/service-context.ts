import type { DbClient } from "@journey/db";
import type { IApiTagService } from "@journey/schemas";

import type { IEventPublisher } from "../../../services/interfaces";

export interface CrmServiceContext {
  db: DbClient;
  organizationId: string;
  publisher: IEventPublisher;
  tagService: IApiTagService;
}
