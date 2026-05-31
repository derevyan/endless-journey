import type { DbClient } from "@journey/db";
import type { IApiJourneyService, IApiTagService } from "@journey/schemas";

export interface UserServiceContext {
  db: DbClient;
  organizationId: string;
  tagService: IApiTagService;
  journeyService: IApiJourneyService;
}
