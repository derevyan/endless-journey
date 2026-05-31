import type { InteractionEvent } from "./events/core";
import type { NodeOutput } from "./session";

export type ChannelPlatform = "telegram" | "whatsapp" | "simulator";
export type ChannelSessionStatus = "active" | "completed" | "dropped" | "paused" | "error";
export type ChannelSessionMode = "live" | "test" | "simulation";
export type ChannelMessageType =
  | "text"
  | "photo"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "contact"
  | "location"
  | "buttons";

export interface ChannelUserInfo {
  platform: ChannelPlatform;
  platformUserId: string;
  organizationId: string;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface ClientRecord {
  id: string;
  platform: ChannelPlatform;
  platformUserId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}

export interface ChannelSessionRecord {
  id: string;
  clientId: string;
  channelId: string | null;
  journeyId: string;
  currentNodeId: string;
  status: ChannelSessionStatus | null;
  mode: ChannelSessionMode | null;
  context: Record<string, unknown>;
  tags: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  completedAt: Date | null;
}

export interface BotRecord {
  id: string;
  organizationId?: string | null;
  userId: string;
  platform: ChannelPlatform;
  botToken: string;
  botUsername: string | null;
  defaultJourneyId: string | null;
  isActive: boolean;
  webhookSecret?: string | null;
  botName?: string | null;
  webhookUrl?: string | null;
  settings?: Record<string, unknown>;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  defaultJourneySlug?: string | null;
  defaultJourneyName?: string | null;
}

export interface SaveInteractionParams {
  id?: string;
  sessionId: string;
  type: string;
  nodeId: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SessionListItem {
  id: string;
  currentNodeId: string;
  status: ChannelSessionStatus | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
}

export interface SessionWithInteractions {
  id: string;
  clientId: string;
  channelId: string | null;
  journeyId: string;
  currentNodeId: string;
  status: ChannelSessionStatus | null;
  mode: ChannelSessionMode | null;
  context: Record<string, unknown>;
  tags: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  completedAt: Date | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
  interactions: InteractionEvent[];
  nodeOutputs: Record<string, NodeOutput>;
}

export interface SessionFilters {
  status?: ChannelSessionStatus;
  limit?: number;
  offset?: number;
}

export interface SaveSentMessagesParams {
  sessionId: string;
  nodeId: string;
  interactionEventId: string;
  platform: ChannelPlatform;
  platformChatId: string;
  content?: string;
  messages: Array<{
    platformMessageId: string;
    messageType: ChannelMessageType;
  }>;
}

export interface SentMessage {
  id: string;
  sessionId: string;
  nodeId: string;
  interactionEventId: string;
  platform: ChannelPlatform;
  platformMessageId: string | null;
  platformChatId: string;
  messageType: ChannelMessageType;
  content: string | null;
  replyToMessageId: string | null;
  metadata: unknown;
  sentAt: Date | null;
  editedAt: Date | null;
  deletedAt: Date | null;
}
