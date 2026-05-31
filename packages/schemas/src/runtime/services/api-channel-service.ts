import type {
  BotRecord,
  ChannelSessionRecord,
  ChannelSessionStatus,
  ChannelUserInfo,
  ClientRecord,
  SaveInteractionParams,
  SaveSentMessagesParams,
  SentMessage,
  SessionFilters,
  SessionListItem,
  SessionWithInteractions,
} from "../../channels";
import type { JourneyConfig, JourneyStatus } from "../../journey";
import type { JourneyMindstateConfig } from "../../mindstate";
import type { VariableOperation } from "../../variables";

export interface IApiChannelService {
  // Bots
  createBot(
    organizationId: string,
    userId: string,
    botToken: string,
    webhookBaseUrl: string
  ): Promise<BotRecord | { error: string }>;
  getOrganizationBots(organizationId: string): Promise<BotRecord[]>;
  getOrganizationBot(botId: string, organizationId: string): Promise<BotRecord | null>;
  updateBot(
    botId: string,
    organizationId: string,
    data: {
      defaultJourneyId?: string | null;
      isActive?: boolean;
      botName?: string;
    },
    performedBy?: string
  ): Promise<BotRecord | null>;
  deleteBot(botId: string, organizationId: string, performedBy?: string): Promise<boolean>;
  reregisterWebhook(
    botId: string,
    organizationId: string,
    webhookBaseUrl: string,
    performedBy?: string
  ): Promise<boolean>;

  // Clients
  findOrCreateChannelUser(info: ChannelUserInfo): Promise<string>;
  getClientById(clientId: string): Promise<ClientRecord | null>;
  deleteChannelUser(userId: string): Promise<boolean>;
  getChannelUserVars(organizationId: string, userId: string): Promise<Record<string, unknown>>;
  updateChannelUserVars(organizationId: string, userId: string, operations: VariableOperation[]): Promise<void>;

  // Sessions
  getChannelBot(channelId: string): Promise<BotRecord | null>;
  getBotByToken(botToken: string): Promise<BotRecord | null>;
  getChannelOrganizationId(channelId: string): Promise<string | null>;
  findActiveSession(clientId: string, channelId: string): Promise<ChannelSessionRecord | null>;
  createSession(
    clientId: string,
    channelId: string,
    journeyId: string,
    startNodeId: string,
    organizationId: string,
    initialContext?: Record<string, unknown>
  ): Promise<ChannelSessionRecord>;
  updateSession(
    sessionId: string,
    data: {
      currentNodeId?: string;
      status?: ChannelSessionStatus;
      completedAt?: Date;
    }
  ): Promise<void>;
  getSessionById(sessionId: string): Promise<ChannelSessionRecord | null>;
  deleteSession(sessionId: string): Promise<boolean>;

  // Journeys (for session setup)
  getJourneyConfig(journeyId: string): Promise<JourneyConfig | null>;
  getJourneyOrganizationId(journeyId: string): Promise<string | null>;
  getJourneyDefaultPipelineId(journeyId: string): Promise<string | null>;
  getJourneyMindstateConfig(journeyId: string): Promise<JourneyMindstateConfig | null>;
  getJourneyName(journeyId: string): Promise<string | null>;
  getJourneyStatus(journeyId: string): Promise<JourneyStatus | null>;

  // Interactions
  saveInteraction(params: SaveInteractionParams): Promise<string>;

  // Session queries
  getSessionsByJourneyId(journeyId: string, filters?: SessionFilters): Promise<SessionListItem[]>;
  getSessionWithInteractions(sessionId: string): Promise<SessionWithInteractions | null>;
  getActiveSessionsForJourney(journeyId: string): Promise<string[]>;
  getPausedSessionsForJourney(journeyId: string): Promise<string[]>;
  getActiveSessionCountForJourney(journeyId: string): Promise<number>;
  bulkUpdateSessionStatus(
    sessionIds: string[],
    status: "active" | "paused" | "completed" | "dropped"
  ): Promise<number>;
  resetJourneySessions(journeyId: string): Promise<number>;

  // Sent messages
  saveSentMessages(params: SaveSentMessagesParams): Promise<void>;
  getLastMessageForSession(sessionId: string): Promise<SentMessage | null>;
  getMessagesForSession(sessionId: string): Promise<SentMessage[]>;
}
