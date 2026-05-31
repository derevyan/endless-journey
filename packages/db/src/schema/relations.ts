/**
 * Relations Schema - All Drizzle ORM relations
 *
 * Centralizes all relations to avoid circular dependencies.
 * Each table's relations are defined here after all tables are imported.
 */

import { relations } from "drizzle-orm";

// Import all tables from domain files
import { user, session, account } from "./auth";
import { organization } from "./organization";
import { member, invitation } from "./organization-membership";
import { journeys, journeyVersions, journeyMedia } from "./journey";
import { messagingChannels, telegramFileCache } from "./channels";
import { journeyTransfers } from "./journey-transfers";
import { clients, journeySessions, interactions, sentMessages, nodeOutputs } from "./session";
import { tagDefinitions, clientTags } from "./tags";
import { automationTriggers, automationWebhooks, durableTimers } from "./automation";
import {
  crmPipelines,
  crmPipelineStages,
  crmClientStages,
  crmStageHistory,
  crmCustomFieldDefinitions,
  crmClientFieldValues,
  crmDirectMessages,
} from "./crm";
import { mindstateDefinitions, clientMindstates, mindstateAnalysisLog } from "./mindstate";
import { testPersonas } from "./simulator";
import { events, failedEvents } from "./events";
import { agentMemories } from "./memory";
import { llmUsageEvents } from "./usage";
import { variables } from "./variables";
import { agentWorkflows, agentDefinitions, workflowVersions, workflowApprovals } from "./agents";

// =============================================================================
// AUTH RELATIONS
// =============================================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(member),
  channels: many(messagingChannels),
  createdJourneys: many(journeys),
  uploadedMedia: many(journeyMedia),
  sentInvitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  activeOrganization: one(organization, {
    fields: [session.activeOrganizationId],
    references: [organization.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// =============================================================================
// ORGANIZATION RELATIONS
// =============================================================================

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  journeys: many(journeys),
  channels: many(messagingChannels),
  tagDefinitions: many(tagDefinitions),
  mindstateDefinitions: many(mindstateDefinitions),
}));

export const memberRelations = relations(member, ({ one }) => ({
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

// =============================================================================
// JOURNEY RELATIONS
// =============================================================================

export const journeyRelations = relations(journeys, ({ one, many }) => ({
  organization: one(organization, {
    fields: [journeys.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [journeys.createdBy],
    references: [user.id],
  }),
  defaultPipeline: one(crmPipelines, {
    fields: [journeys.defaultPipelineId],
    references: [crmPipelines.id],
  }),
  channels: many(messagingChannels),
  journeySessions: many(journeySessions),
  media: many(journeyMedia),
  // Note: tagDefinitions removed - tags are org-scoped, not journey-scoped (no FK path exists)
}));

export const messagingChannelsRelations = relations(messagingChannels, ({ one, many }) => ({
  organization: one(organization, {
    fields: [messagingChannels.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [messagingChannels.userId],
    references: [user.id],
  }),
  defaultJourney: one(journeys, {
    fields: [messagingChannels.defaultJourneyId],
    references: [journeys.id],
  }),
  journeySessions: many(journeySessions),
  fileCache: many(telegramFileCache),
}));

export const telegramFileCacheRelations = relations(telegramFileCache, ({ one }) => ({
  channel: one(messagingChannels, {
    fields: [telegramFileCache.channelId],
    references: [messagingChannels.id],
  }),
  media: one(journeyMedia, {
    fields: [telegramFileCache.mediaId],
    references: [journeyMedia.id],
  }),
}));

export const journeyMediaRelations = relations(journeyMedia, ({ one, many }) => ({
  fileCacheEntries: many(telegramFileCache),
  journey: one(journeys, {
    fields: [journeyMedia.journeyId],
    references: [journeys.id],
  }),
  uploader: one(user, {
    fields: [journeyMedia.uploadedBy],
    references: [user.id],
  }),
}));

// =============================================================================
// SESSION RELATIONS
// =============================================================================

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organization, {
    fields: [clients.organizationId],
    references: [organization.id],
  }),
  sessions: many(journeySessions),
  tags: many(clientTags),
  mindstates: many(clientMindstates),
  testPersonas: many(testPersonas),
}));

export const journeySessionsRelations = relations(journeySessions, ({ one, many }) => ({
  client: one(clients, {
    fields: [journeySessions.clientId],
    references: [clients.id],
  }),
  channel: one(messagingChannels, {
    fields: [journeySessions.channelId],
    references: [messagingChannels.id],
  }),
  journey: one(journeys, {
    fields: [journeySessions.journeyId],
    references: [journeys.id],
  }),
  organization: one(organization, {
    fields: [journeySessions.organizationId],
    references: [organization.id],
  }),
  interactions: many(interactions),
  durableTimers: many(durableTimers),
  sentMessages: many(sentMessages),
  nodeOutputs: many(nodeOutputs),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  session: one(journeySessions, {
    fields: [interactions.sessionId],
    references: [journeySessions.id],
  }),
}));

export const sentMessagesRelations = relations(sentMessages, ({ one }) => ({
  session: one(journeySessions, {
    fields: [sentMessages.sessionId],
    references: [journeySessions.id],
  }),
}));

export const nodeOutputsRelations = relations(nodeOutputs, ({ one }) => ({
  session: one(journeySessions, {
    fields: [nodeOutputs.sessionId],
    references: [journeySessions.id],
  }),
}));

export const journeyTransfersRelations = relations(journeyTransfers, ({ one }) => ({
  organization: one(organization, {
    fields: [journeyTransfers.organizationId],
    references: [organization.id],
  }),
  client: one(clients, {
    fields: [journeyTransfers.clientId],
    references: [clients.id],
  }),
  fromJourney: one(journeys, {
    fields: [journeyTransfers.fromJourneyId],
    references: [journeys.id],
    relationName: "transfersFrom",
  }),
  toJourney: one(journeys, {
    fields: [journeyTransfers.toJourneyId],
    references: [journeys.id],
    relationName: "transfersTo",
  }),
  fromSession: one(journeySessions, {
    fields: [journeyTransfers.fromSessionId],
    references: [journeySessions.id],
    relationName: "transfersFromSession",
  }),
  toSession: one(journeySessions, {
    fields: [journeyTransfers.toSessionId],
    references: [journeySessions.id],
    relationName: "transfersToSession",
  }),
}));

// =============================================================================
// TAGS RELATIONS
// =============================================================================

export const tagDefinitionsRelations = relations(tagDefinitions, ({ one, many }) => ({
  organization: one(organization, {
    fields: [tagDefinitions.organizationId],
    references: [organization.id],
  }),
  clientAssignments: many(clientTags),
}));

export const clientTagsRelations = relations(clientTags, ({ one }) => ({
  client: one(clients, {
    fields: [clientTags.clientId],
    references: [clients.id],
  }),
  tag: one(tagDefinitions, {
    fields: [clientTags.tagId],
    references: [tagDefinitions.id],
  }),
}));

// =============================================================================
// AUTOMATION RELATIONS
// =============================================================================

export const automationTriggersRelations = relations(automationTriggers, ({ one, many }) => ({
  journey: one(journeys, {
    fields: [automationTriggers.journeyId],
    references: [journeys.id],
  }),
  organization: one(organization, {
    fields: [automationTriggers.organizationId],
    references: [organization.id],
  }),
  sourceJourney: one(journeys, {
    fields: [automationTriggers.sourceJourneyId],
    references: [journeys.id],
  }),
  tag: one(tagDefinitions, {
    fields: [automationTriggers.tagId],
    references: [tagDefinitions.id],
  }),
  variable: one(variables, {
    fields: [automationTriggers.variableId],
    references: [variables.id],
  }),
  webhook: one(automationWebhooks),
}));

export const automationWebhooksRelations = relations(automationWebhooks, ({ one }) => ({
  trigger: one(automationTriggers, {
    fields: [automationWebhooks.triggerId],
    references: [automationTriggers.id],
  }),
}));

export const durableTimersRelations = relations(durableTimers, ({ one }) => ({
  session: one(journeySessions, {
    fields: [durableTimers.sessionId],
    references: [journeySessions.id],
  }),
  channel: one(messagingChannels, {
    fields: [durableTimers.channelId],
    references: [messagingChannels.id],
  }),
}));

// =============================================================================
// CRM RELATIONS
// =============================================================================

export const crmPipelinesRelations = relations(crmPipelines, ({ one, many }) => ({
  organization: one(organization, {
    fields: [crmPipelines.organizationId],
    references: [organization.id],
  }),
  stages: many(crmPipelineStages),
}));

export const crmPipelineStagesRelations = relations(crmPipelineStages, ({ one, many }) => ({
  pipeline: one(crmPipelines, {
    fields: [crmPipelineStages.pipelineId],
    references: [crmPipelines.id],
  }),
  organization: one(organization, {
    fields: [crmPipelineStages.organizationId],
    references: [organization.id],
  }),
  clientStages: many(crmClientStages),
  historyTo: many(crmStageHistory, { relationName: "toStage" }),
}));

export const crmClientStagesRelations = relations(crmClientStages, ({ one }) => ({
  client: one(clients, {
    fields: [crmClientStages.clientId],
    references: [clients.id],
  }),
  organization: one(organization, {
    fields: [crmClientStages.organizationId],
    references: [organization.id],
  }),
  stage: one(crmPipelineStages, {
    fields: [crmClientStages.stageId],
    references: [crmPipelineStages.id],
  }),
  assignedByUser: one(user, {
    fields: [crmClientStages.assignedBy],
    references: [user.id],
  }),
}));

export const crmStageHistoryRelations = relations(crmStageHistory, ({ one }) => ({
  client: one(clients, {
    fields: [crmStageHistory.clientId],
    references: [clients.id],
  }),
  organization: one(organization, {
    fields: [crmStageHistory.organizationId],
    references: [organization.id],
  }),
  fromStage: one(crmPipelineStages, {
    fields: [crmStageHistory.fromStageId],
    references: [crmPipelineStages.id],
    relationName: "fromStage",
  }),
  toStage: one(crmPipelineStages, {
    fields: [crmStageHistory.toStageId],
    references: [crmPipelineStages.id],
    relationName: "toStage",
  }),
  changedByUser: one(user, {
    fields: [crmStageHistory.changedBy],
    references: [user.id],
  }),
}));

export const crmCustomFieldDefinitionsRelations = relations(crmCustomFieldDefinitions, ({ one, many }) => ({
  organization: one(organization, {
    fields: [crmCustomFieldDefinitions.organizationId],
    references: [organization.id],
  }),
  values: many(crmClientFieldValues),
}));

export const crmClientFieldValuesRelations = relations(crmClientFieldValues, ({ one }) => ({
  client: one(clients, {
    fields: [crmClientFieldValues.clientId],
    references: [clients.id],
  }),
  field: one(crmCustomFieldDefinitions, {
    fields: [crmClientFieldValues.fieldId],
    references: [crmCustomFieldDefinitions.id],
  }),
  updatedByUser: one(user, {
    fields: [crmClientFieldValues.updatedBy],
    references: [user.id],
  }),
}));

export const crmDirectMessagesRelations = relations(crmDirectMessages, ({ one }) => ({
  client: one(clients, {
    fields: [crmDirectMessages.clientId],
    references: [clients.id],
  }),
  organization: one(organization, {
    fields: [crmDirectMessages.organizationId],
    references: [organization.id],
  }),
  channel: one(messagingChannels, {
    fields: [crmDirectMessages.channelId],
    references: [messagingChannels.id],
  }),
  sentByUser: one(user, {
    fields: [crmDirectMessages.sentBy],
    references: [user.id],
  }),
}));


// =============================================================================
// MINDSTATE RELATIONS
// =============================================================================

export const mindstateDefinitionsRelations = relations(mindstateDefinitions, ({ one, many }) => ({
  organization: one(organization, {
    fields: [mindstateDefinitions.organizationId],
    references: [organization.id],
  }),
  clientMindstates: many(clientMindstates),
}));

export const clientMindstatesRelations = relations(clientMindstates, ({ one, many }) => ({
  client: one(clients, {
    fields: [clientMindstates.clientId],
    references: [clients.id],
  }),
  definition: one(mindstateDefinitions, {
    fields: [clientMindstates.definitionId],
    references: [mindstateDefinitions.id],
  }),
  analysisLogs: many(mindstateAnalysisLog),
}));

export const mindstateAnalysisLogRelations = relations(mindstateAnalysisLog, ({ one }) => ({
  clientMindstate: one(clientMindstates, {
    fields: [mindstateAnalysisLog.clientMindstateId],
    references: [clientMindstates.id],
  }),
  session: one(journeySessions, {
    fields: [mindstateAnalysisLog.sessionId],
    references: [journeySessions.id],
  }),
}));

// =============================================================================
// SIMULATOR RELATIONS
// =============================================================================

export const testPersonasRelations = relations(testPersonas, ({ one }) => ({
  organization: one(organization, {
    fields: [testPersonas.organizationId],
    references: [organization.id],
  }),
  client: one(clients, {
    fields: [testPersonas.clientId],
    references: [clients.id],
  }),
}));

// =============================================================================
// EVENTS RELATIONS
// =============================================================================

export const eventsRelations = relations(events, ({ one }) => ({
  session: one(journeySessions, {
    fields: [events.sessionId],
    references: [journeySessions.id],
  }),
  client: one(clients, {
    fields: [events.clientId],
    references: [clients.id],
  }),
  journey: one(journeys, {
    fields: [events.journeyId],
    references: [journeys.id],
  }),
  organization: one(organization, {
    fields: [events.organizationId],
    references: [organization.id],
  }),
}));

export const failedEventsRelations = relations(failedEvents, ({ one }) => ({
  session: one(journeySessions, {
    fields: [failedEvents.sessionId],
    references: [journeySessions.id],
  }),
  journey: one(journeys, {
    fields: [failedEvents.journeyId],
    references: [journeys.id],
  }),
  organization: one(organization, {
    fields: [failedEvents.organizationId],
    references: [organization.id],
  }),
}));

// =============================================================================
// MEMORY RELATIONS
// =============================================================================

export const agentMemoriesRelations = relations(agentMemories, ({ one }) => ({
  client: one(clients, {
    fields: [agentMemories.clientId],
    references: [clients.id],
  }),
  organization: one(organization, {
    fields: [agentMemories.organizationId],
    references: [organization.id],
  }),
  journey: one(journeys, {
    fields: [agentMemories.journeyId],
    references: [journeys.id],
  }),
}));

// =============================================================================
// USAGE TRACKING RELATIONS
// =============================================================================

export const llmUsageEventsRelations = relations(llmUsageEvents, ({ one }) => ({
  organization: one(organization, {
    fields: [llmUsageEvents.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [llmUsageEvents.userId],
    references: [user.id],
  }),
  journey: one(journeys, {
    fields: [llmUsageEvents.journeyId],
    references: [journeys.id],
  }),
  session: one(journeySessions, {
    fields: [llmUsageEvents.journeySessionId],
    references: [journeySessions.id],
  }),
  client: one(clients, {
    fields: [llmUsageEvents.clientId],
    references: [clients.id],
  }),
}));

// =============================================================================
// VARIABLES RELATIONS
// =============================================================================

export const variablesRelations = relations(variables, ({ one }) => ({
  organization: one(organization, {
    fields: [variables.organizationId],
    references: [organization.id],
  }),
}));

// =============================================================================
// AGENT WORKFLOW RELATIONS
// =============================================================================

export const agentWorkflowsRelations = relations(agentWorkflows, ({ one, many }) => ({
  versions: many(workflowVersions),
  organization: one(organization, {
    fields: [agentWorkflows.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [agentWorkflows.createdBy],
    references: [user.id],
    relationName: "workflowCreator",
  }),
  updater: one(user, {
    fields: [agentWorkflows.updatedBy],
    references: [user.id],
    relationName: "workflowUpdater",
  }),
}));

export const agentDefinitionsRelations = relations(agentDefinitions, ({ one }) => ({
  organization: one(organization, {
    fields: [agentDefinitions.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [agentDefinitions.createdBy],
    references: [user.id],
    relationName: "definitionCreator",
  }),
  updater: one(user, {
    fields: [agentDefinitions.updatedBy],
    references: [user.id],
    relationName: "definitionUpdater",
  }),
}));

export const workflowVersionsRelations = relations(workflowVersions, ({ one }) => ({
  workflow: one(agentWorkflows, {
    fields: [workflowVersions.workflowId],
    references: [agentWorkflows.id],
  }),
  creator: one(user, {
    fields: [workflowVersions.createdBy],
    references: [user.id],
    relationName: "versionCreator",
  }),
}));

export const workflowApprovalsRelations = relations(workflowApprovals, ({ one }) => ({
  workflow: one(agentWorkflows, {
    fields: [workflowApprovals.workflowId],
    references: [agentWorkflows.id],
  }),
  organization: one(organization, {
    fields: [workflowApprovals.organizationId],
    references: [organization.id],
  }),
  responder: one(user, {
    fields: [workflowApprovals.respondedBy],
    references: [user.id],
    relationName: "approvalResponder",
  }),
}));
