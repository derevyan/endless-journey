/**
 * API Client
 *
 * Centralized export for all API operations.
 *
 * @module lib/api
 */

// Re-export all types
export type {
  Channel,
  GlobalTag,
  GlobalVariable,
  JourneyConfigRecord,
  JourneyMeta,
  JourneyVariable,
  MediaItem,
  SessionDetail,
  SessionFilters,
  SessionListItem,
  SessionUser,
  TelegramUser,
  TelegramUserFilters,
  TelegramUserSession,
  UploadConfig,
  UploadResponse,
  UserTag,
  Variable,
} from "./types";
export type { UserActivityEntry, UserActivityEventType } from "@journey/schemas";

// Export domain-specific APIs for targeted imports
export { channelsApi } from "./channels";
export {
  crmApi,
  crmClientsApi,
  crmClientTagsApi,
  crmFieldsApi,
  crmMessagesApi,
  crmPipelinesApi,
  crmStagesApi,
  type ActivityEntry,
  type ClientFilters,
  type CreateFieldInput,
  type CreatePipelineInput,
  type CreateStageInput,
  type CrmClient,
  type CrmClientProfile,
  type CustomFieldDefinition,
  type DirectMessage,
  type Pipeline,
  type PipelineStage,
  type PipelineStageWithCount,
  type PipelineWithStageCount,
  type SendMessageInput,
  type UpdateFieldInput,
  type UpdatePipelineInput,
  type UpdateStageInput,
} from "./crm";
export {
  eventsApi,
  type CrmActivity,
  type CrmActivityQueryOptions,
  type CrmActivityResponse,
  type EventsQueryOptions,
  type EventsResponse,
  type EventStatsResponse,
  type EventTypeInfo,
  type EventTypesResponse,
  type LlmUsageEvent,
  type LlmUsageQueryOptions,
  type LlmUsageResponse,
  type LlmUsageStatsResponse,
} from "./events";
export { journeysApi } from "./journeys";
export { mediaApi } from "./media";
export {
  mindstateApi,
  mindstateDefinitionsApi,
  mindstateClientsApi,
  type AnalysisResult,
  type AnalysisLogEntry,
  type CreateDefinitionInput,
  type UpdateDefinitionInput,
} from "./mindstate";
export { sessionsApi } from "./sessions";
export { tagsApi } from "./tags";
export { usersApi } from "./users";
export { variablesApi } from "./variables";
export { versionsApi } from "./versions";
export { mindstateVersionsApi } from "./mindstate-versions";
export {
  transcribeAudio,
  streamSpeech,
  generateSpeech,
  type TranscriptionResult,
  type TTSStreamCallbacks,
  type TTSOptions,
} from "./audio";
export {
  promptsApi,
  promptVersionsApi,
  promptCompileApi,
  type PromptResponse,
  type PromptListResponse,
  type PromptVersionResponse,
  type PromptFilters,
  type CreatePromptInput,
  type UpdatePromptInput,
  type CreateVersionInput,
  type UpdateLabelsInput,
  type CompiledPrompt,
  type CompilePromptInput,
} from "./prompts";

// Import domain APIs for combined export
import { channelsApi } from "./channels";
import { crmApi } from "./crm";
import { eventsApi } from "./events";
import { journeysApi } from "./journeys";
import { mediaApi } from "./media";
import { mindstateApi } from "./mindstate";
import { mindstateVersionsApi } from "./mindstate-versions";
import { sessionsApi } from "./sessions";
import { tagsApi } from "./tags";
import { usersApi } from "./users";
import { variablesApi } from "./variables";
import { versionsApi } from "./versions";

/**
 * Combined API client
 *
 * Usage:
 *   import { apiClient } from "@/shared/lib/api";
 *   await apiClient.getJourneys();
 */
export const apiClient = {
  // Journeys
  ...journeysApi,
  // Channels
  ...channelsApi,
  // CRM
  crm: crmApi,
  // Events
  ...eventsApi,
  // Mindstates
  mindstate: mindstateApi,
  mindstateVersions: mindstateVersionsApi,
  // Sessions
  ...sessionsApi,
  // Users
  ...usersApi,
  // Media
  ...mediaApi,
  // Variables
  ...variablesApi,
  // Tags
  ...tagsApi,
  // Versions
  ...versionsApi,
};
