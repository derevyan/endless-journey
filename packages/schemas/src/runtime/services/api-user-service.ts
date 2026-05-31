import type { UserActivityEntry } from "../../user-activity";
import type { ListUsersParams, UserActivityParams, UserListResult, UserSessionInfo } from "../../users";

export interface IApiUserService {
  listOrganizationUsers(params: ListUsersParams): Promise<UserListResult>;
  listUserSessions(organizationId: string, clientId: string): Promise<UserSessionInfo[]>;
  listUserActivity(params: UserActivityParams): Promise<UserActivityEntry[]>;
  userHasSessionsInOrg(organizationId: string, clientId: string): Promise<boolean>;
}
