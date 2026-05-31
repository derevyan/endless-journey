import type { DbClient } from "@journey/db";
import type {
  BotRecord,
  ChannelSessionRecord,
  ChannelSessionStatus,
  ChannelUserInfo,
  ClientRecord,
  IApiChannelService,
  IApiJourneyService,
  IApiTagService,
  IApiVariableService,
  JourneyConfig,
  JourneyMindstateConfig,
  JourneyStatus,
  SaveInteractionParams,
  SaveSentMessagesParams,
  SentMessage,
  SessionFilters,
  SessionListItem,
  SessionWithInteractions,
  VariableOperation,
} from "@journey/schemas";

import type { IEventPublisher } from "../../../services/interfaces";
import {
  createBot,
  deleteBot,
  getOrganizationBot,
  getOrganizationBots,
  reregisterWebhook,
  updateBot,
} from "./bot-service";
import {
  deleteChannelUser,
  findOrCreateChannelUser,
  getChannelUserVars,
  getClientById,
  updateChannelUserVars,
} from "./client-service";
import {
  createSession,
  deleteSession,
  findActiveSession,
  getBotByToken,
  getChannelBot,
  getChannelOrganizationId,
  getJourneyConfig,
  getJourneyDefaultPipelineId,
  getJourneyMindstateConfig,
  getJourneyName,
  getJourneyOrganizationId,
  getJourneyStatus,
  getSessionById,
  saveInteraction,
  updateSession,
} from "./session-service";
import {
  bulkUpdateSessionStatus,
  getActiveSessionCountForJourney,
  getActiveSessionsForJourney,
  getPausedSessionsForJourney,
  getSessionWithInteractions,
  getSessionsByJourneyId,
  resetJourneySessions,
} from "./session-query-service";
import { getLastMessageForSession, getMessagesForSession, saveSentMessages } from "./sent-messages-service";
import type { ChannelServiceContext } from "./service-context";

export class ApiChannelService implements IApiChannelService {
  /**
   * Organization ID for scoping operations.
   *
   * Note: Nullable for system-level operations (createSystemServices).
   * System services are used by background jobs and webhooks that need to
   * look up journey/channel data before the organization context is known.
   * Methods that require organization scoping must validate this is non-null.
   */
  public readonly organizationId: string | null;
  private readonly ctx: ChannelServiceContext;

  constructor(
    db: DbClient,
    organizationId: string | null,
    publisher: IEventPublisher,
    variableService: IApiVariableService,
    tagService: IApiTagService,
    journeyService: IApiJourneyService
  ) {
    this.organizationId = organizationId;
    this.ctx = {
      db,
      organizationId,
      publisher,
      variableService,
      tagService,
      journeyService,
    };
  }

  // =========================================================================
  // Bots
  // =========================================================================

  async createBot(
    organizationId: string,
    userId: string,
    botToken: string,
    webhookBaseUrl: string
  ): Promise<BotRecord | { error: string }> {
    return createBot(this.ctx, organizationId, userId, botToken, webhookBaseUrl);
  }

  async getOrganizationBots(organizationId: string): Promise<BotRecord[]> {
    return getOrganizationBots(this.ctx, organizationId);
  }

  async getOrganizationBot(botId: string, organizationId: string): Promise<BotRecord | null> {
    return getOrganizationBot(this.ctx, botId, organizationId);
  }

  async updateBot(
    botId: string,
    organizationId: string,
    data: {
      defaultJourneyId?: string | null;
      isActive?: boolean;
      botName?: string;
    },
    performedBy?: string
  ): Promise<BotRecord | null> {
    return updateBot(this.ctx, botId, organizationId, data, performedBy);
  }

  async deleteBot(botId: string, organizationId: string, performedBy?: string): Promise<boolean> {
    return deleteBot(this.ctx, botId, organizationId, performedBy);
  }

  async reregisterWebhook(
    botId: string,
    organizationId: string,
    webhookBaseUrl: string,
    performedBy?: string
  ): Promise<boolean> {
    return reregisterWebhook(this.ctx, botId, organizationId, webhookBaseUrl, performedBy);
  }

  // =========================================================================
  // Clients
  // =========================================================================

  async findOrCreateChannelUser(info: ChannelUserInfo): Promise<string> {
    return findOrCreateChannelUser(this.ctx, info);
  }

  async getClientById(clientId: string): Promise<ClientRecord | null> {
    return getClientById(this.ctx, clientId);
  }

  async deleteChannelUser(userId: string): Promise<boolean> {
    return deleteChannelUser(this.ctx, userId);
  }

  async getChannelUserVars(organizationId: string, userId: string): Promise<Record<string, unknown>> {
    return getChannelUserVars(this.ctx, organizationId, userId);
  }

  async updateChannelUserVars(
    organizationId: string,
    userId: string,
    operations: VariableOperation[]
  ): Promise<void> {
    return updateChannelUserVars(this.ctx, organizationId, userId, operations);
  }

  // =========================================================================
  // Sessions
  // =========================================================================

  async getChannelBot(channelId: string): Promise<BotRecord | null> {
    return getChannelBot(this.ctx, channelId);
  }

  async getBotByToken(botToken: string): Promise<BotRecord | null> {
    return getBotByToken(this.ctx, botToken);
  }

  async getChannelOrganizationId(channelId: string): Promise<string | null> {
    return getChannelOrganizationId(this.ctx, channelId);
  }

  async findActiveSession(clientId: string, channelId: string): Promise<ChannelSessionRecord | null> {
    return findActiveSession(this.ctx, clientId, channelId);
  }

  async createSession(
    clientId: string,
    channelId: string,
    journeyId: string,
    startNodeId: string,
    organizationId: string,
    initialContext?: Record<string, unknown>
  ): Promise<ChannelSessionRecord> {
    return createSession(this.ctx, clientId, channelId, journeyId, startNodeId, organizationId, initialContext);
  }

  async updateSession(
    sessionId: string,
    data: {
      currentNodeId?: string;
      status?: ChannelSessionStatus;
      completedAt?: Date;
    }
  ): Promise<void> {
    return updateSession(this.ctx, sessionId, data);
  }

  async getSessionById(sessionId: string): Promise<ChannelSessionRecord | null> {
    return getSessionById(this.ctx, sessionId);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return deleteSession(this.ctx, sessionId);
  }

  // =========================================================================
  // Journeys (for session setup)
  // =========================================================================

  async getJourneyConfig(journeyId: string): Promise<JourneyConfig | null> {
    return getJourneyConfig(this.ctx, journeyId);
  }

  async getJourneyOrganizationId(journeyId: string): Promise<string | null> {
    return getJourneyOrganizationId(this.ctx, journeyId);
  }

  async getJourneyDefaultPipelineId(journeyId: string): Promise<string | null> {
    return getJourneyDefaultPipelineId(this.ctx, journeyId);
  }

  async getJourneyMindstateConfig(journeyId: string): Promise<JourneyMindstateConfig | null> {
    return getJourneyMindstateConfig(this.ctx, journeyId);
  }

  async getJourneyName(journeyId: string): Promise<string | null> {
    return getJourneyName(this.ctx, journeyId);
  }

  async getJourneyStatus(journeyId: string): Promise<JourneyStatus | null> {
    return getJourneyStatus(this.ctx, journeyId);
  }

  // =========================================================================
  // Interactions
  // =========================================================================

  async saveInteraction(params: SaveInteractionParams): Promise<string> {
    return saveInteraction(this.ctx, params);
  }

  // =========================================================================
  // Session queries
  // =========================================================================

  async getSessionsByJourneyId(journeyId: string, filters?: SessionFilters): Promise<SessionListItem[]> {
    return getSessionsByJourneyId(this.ctx, journeyId, filters);
  }

  async getSessionWithInteractions(sessionId: string): Promise<SessionWithInteractions | null> {
    return getSessionWithInteractions(this.ctx, sessionId);
  }

  async getActiveSessionsForJourney(journeyId: string): Promise<string[]> {
    return getActiveSessionsForJourney(this.ctx, journeyId);
  }

  async getPausedSessionsForJourney(journeyId: string): Promise<string[]> {
    return getPausedSessionsForJourney(this.ctx, journeyId);
  }

  async getActiveSessionCountForJourney(journeyId: string): Promise<number> {
    return getActiveSessionCountForJourney(this.ctx, journeyId);
  }

  async bulkUpdateSessionStatus(
    sessionIds: string[],
    status: "active" | "paused" | "completed" | "dropped"
  ): Promise<number> {
    return bulkUpdateSessionStatus(this.ctx, sessionIds, status);
  }

  async resetJourneySessions(journeyId: string): Promise<number> {
    return resetJourneySessions(this.ctx, journeyId);
  }

  // =========================================================================
  // Sent messages
  // =========================================================================

  async saveSentMessages(params: SaveSentMessagesParams): Promise<void> {
    return saveSentMessages(this.ctx, params);
  }

  async getLastMessageForSession(sessionId: string): Promise<SentMessage | null> {
    return getLastMessageForSession(this.ctx, sessionId);
  }

  async getMessagesForSession(sessionId: string): Promise<SentMessage[]> {
    return getMessagesForSession(this.ctx, sessionId);
  }
}
