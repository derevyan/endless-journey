/**
 * Schema Index - Barrel export for all database schema
 *
 * This file re-exports all tables and relations from domain files.
 * Maintains API compatibility with the original single-file schema.
 */

// =============================================================================
// HELPER EXPORTS
// =============================================================================

export { timestamps, softDeleteColumn, orgIdColumn } from "./helpers";

// =============================================================================
// ENUM EXPORTS
// =============================================================================

export {
  // Journey & session status
  journeyStatusEnum,
  sessionStatusEnum,
  sessionModeEnum,
  // Platform & messaging
  platformEnum,
  messageTypeEnum,
  messageStatusEnum,
  mediaTypeEnum,
  // Organization & CRM
  memberRoleEnum,
  invitationStatusEnum,
  crmFieldTypeEnum,
  // Workflow & agents
  workflowStatusEnum,
  mindstateStatusEnum,
  approvalStatusEnum,
  timeoutActionEnum,
  promptTypeEnum,
  // Automation & triggers
  triggerTypeEnum,
  tagActionEnum,
  variableScopeEnum,
  timerStatusEnum,
  // Events & error handling
  failedEventStatusEnum,
  transferTriggerEnum,
} from "./enums";

// =============================================================================
// TABLE EXPORTS
// =============================================================================

// Auth tables
export { user, session, account, verification } from "./auth";

// Organization tables
export { organization } from "./organization";
export { member, invitation } from "./organization-membership";

// Journey tables
export {
  journeys,
  journeyVersions,
  journeyVersionsRelations,
  journeyMedia,
} from "./journey";

// Channel tables
export { messagingChannels, telegramFileCache } from "./channels";

// Note: journeyDefaultPipelines was inlined into journeys.defaultPipelineId column

// Journey transfer tables
export { journeyTransfers } from "./journey-transfers";

// Session tables
export { clients, journeySessions, interactions, sentMessages, nodeOutputs } from "./session";

// Conversation document store tables
export { conversations } from "./conversations";

// Variables table
export { variables } from "./variables";

// Tags tables
export { tagDefinitions, clientTags } from "./tags";

// Automation tables
export { automationTriggers, automationWebhooks, durableTimers } from "./automation";

// CRM tables
export {
  crmPipelines,
  crmPipelineStages,
  crmClientStages,
  crmStageHistory,
  crmCustomFieldDefinitions,
  crmClientFieldValues,
  crmDirectMessages,
} from "./crm";

// Mindstate tables
export { mindstateDefinitions, mindstateDefinitionVersions, clientMindstates, mindstateAnalysisLog } from "./mindstate";

// Simulator tables
export { testPersonas } from "./simulator";

// Events tables
export { events, failedEvents } from "./events";

// Memory tables
export { agentMemories } from "./memory";

// Usage tracking tables
export { llmUsageEvents } from "./usage";

// Agent workflow tables
export { agentWorkflows, agentDefinitions, workflowVersions, workflowApprovals } from "./agents";

// Prompt repository tables
export { prompts, promptVersions } from "./prompts";

// =============================================================================
// RELATIONS EXPORTS
// =============================================================================

export {
  // Auth relations
  userRelations,
  sessionRelations,
  accountRelations,
  // Organization relations
  organizationRelations,
  memberRelations,
  invitationRelations,
  // Journey relations
  journeyRelations,
  messagingChannelsRelations,
  telegramFileCacheRelations,
  journeyMediaRelations,
  journeyTransfersRelations,
  // Session relations
  clientsRelations,
  journeySessionsRelations,
  interactionsRelations,
  sentMessagesRelations,
  nodeOutputsRelations,
  // Tags relations
  tagDefinitionsRelations,
  clientTagsRelations,
  // Automation relations
  automationTriggersRelations,
  automationWebhooksRelations,
  durableTimersRelations,
  // CRM relations
  crmPipelinesRelations,
  crmPipelineStagesRelations,
  crmClientStagesRelations,
  crmStageHistoryRelations,
  crmCustomFieldDefinitionsRelations,
  crmClientFieldValuesRelations,
  crmDirectMessagesRelations,
  // Mindstate relations
  mindstateDefinitionsRelations,
  clientMindstatesRelations,
  mindstateAnalysisLogRelations,
  // Simulator relations
  testPersonasRelations,
  // Events relations
  eventsRelations,
  failedEventsRelations,
  // Memory relations
  agentMemoriesRelations,
  // Usage tracking relations
  llmUsageEventsRelations,
  // Variables relations
  variablesRelations,
} from "./relations";

// Agent workflow relations
export {
  agentWorkflowsRelations,
  agentDefinitionsRelations,
  workflowVersionsRelations,
  workflowApprovalsRelations,
} from "./relations";
