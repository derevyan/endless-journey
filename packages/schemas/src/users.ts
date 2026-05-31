import type { ChannelPlatform, ChannelSessionStatus } from "./channels";

export interface ListUsersParams {
  organizationId: string;
  journeyId?: string;
  tags: string[];
  limit: number;
  offset: number;
}

export interface UserListItem {
  id: string;
  platformUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  platform: ChannelPlatform | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  sessionCount: number;
  lastActiveAt: string | null;
  tags: string[];
}

export interface UserListResult {
  users: UserListItem[];
  total: number;
}

export interface UserSessionInfo {
  id: string;
  journeyId: string;
  journeyName: string | null;
  currentNodeId: string;
  status: ChannelSessionStatus | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  completedAt: Date | null;
}

export interface UserActivityParams {
  organizationId: string;
  clientId: string;
  limit?: number;
  offset?: number;
}
