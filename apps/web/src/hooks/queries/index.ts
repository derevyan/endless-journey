/**
 * Query Hooks Index
 *
 * Re-exports TanStack Query hooks for convenient imports.
 *
 * Shared query hooks (tags, variables, channels, journeys) live here.
 * These hooks are feature-agnostic and can be used anywhere.
 */
export {
  useChannels,
  useCreateChannel,
  useDeleteChannel,
  useUpdateChannel,
  useRefreshChannelWebhook,
  type Channel,
} from "./use-channels";
export { useMediaGallery, useCheckMediaUsage, useDeleteMedia } from "./use-media-gallery";
export {
  useTags,
  useAddTag,
  useUpdateTag,
  useRemoveTag,
  type GlobalTag,
} from "./use-tags";
export { useUpload } from "./use-upload";
export {
  useGlobalVariables,
  useSetGlobalVariable,
  useDeleteGlobalVariable,
  useJourneyVariables,
  useSetJourneyVariable,
  useDeleteJourneyVariable,
  type GlobalVariable,
  type JourneyVariable,
} from "./use-variables";
export {
  useEvents,
  useEventStats,
  useEventTypes,
  useCrmActivityLog,
  type EventsQueryOptions,
  type EventsResponse,
  type EventStatsResponse,
  type EventTypesResponse,
  type CrmActivityQueryOptions,
  type CrmActivityResponse,
  type EventTypeInfo,
  type CrmActivity,
} from "./use-events";
export { useActiveSessionsCount } from "./use-active-sessions-count";
export { useUserActivity } from "./use-user-activity";
export { useJourneyListManifest } from "./use-journey-list-manifest";
export { useJourneyConfig } from "./use-journey-config";
export {
  useModels,
  useModelsByProvider,
  useModel,
  type ModelRegistryEntry,
} from "./use-models";
