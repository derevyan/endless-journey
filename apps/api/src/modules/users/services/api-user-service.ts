import type { DbClient } from "@journey/db";
import type {
  IApiJourneyService,
  IApiTagService,
  IApiUserService,
  ListUsersParams,
  UserActivityEntry,
  UserActivityParams,
  UserListResult,
  UserSessionInfo,
} from "@journey/schemas";

import { listOrganizationUsers, listUserActivity, listUserSessions, userHasSessionsInOrg } from "./user-service";
import type { UserServiceContext } from "./service-context";

export class ApiUserService implements IApiUserService {
  public readonly organizationId: string;
  private readonly ctx: UserServiceContext;

  constructor(
    db: DbClient,
    organizationId: string,
    tagService: IApiTagService,
    journeyService: IApiJourneyService
  ) {
    this.organizationId = organizationId;
    this.ctx = { db, organizationId, tagService, journeyService };
  }

  async listOrganizationUsers(params: ListUsersParams): Promise<UserListResult> {
    return listOrganizationUsers(this.ctx, params);
  }

  async listUserSessions(organizationId: string, clientId: string): Promise<UserSessionInfo[]> {
    return listUserSessions(this.ctx, organizationId, clientId);
  }

  async listUserActivity(params: UserActivityParams): Promise<UserActivityEntry[]> {
    return listUserActivity(this.ctx, params);
  }

  async userHasSessionsInOrg(organizationId: string, clientId: string): Promise<boolean> {
    return userHasSessionsInOrg(this.ctx, organizationId, clientId);
  }
}
