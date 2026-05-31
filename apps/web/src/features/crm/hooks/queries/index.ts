/**
 * CRM Query Hooks
 *
 * Re-exports all CRM query hooks for convenient importing.
 *
 * @module hooks/queries/crm
 */

// Pipeline hooks
export {
  useCrmPipelines,
  useCrmPipeline,
  useCreateCrmPipeline,
  useUpdateCrmPipeline,
  useDeleteCrmPipeline,
  useReorderCrmPipelines,
  useSetDefaultPipeline,
} from "./use-pipelines";

// Stage hooks
export {
  useCrmStages,
  useCreateCrmStage,
  useUpdateCrmStage,
  useDeleteCrmStage,
  useReorderCrmStages,
} from "./use-stages";

// Field hooks
export {
  useCrmFields,
  useCreateCrmField,
  useUpdateCrmField,
  useDeleteCrmField,
} from "./use-fields";

// Client hooks (includes tags)
export {
  useCrmClients,
  useCrmClient,
  useUpdateClientStage,
  useUpdateClientFields,
  useCrmClientTimeline,
  useAddClientTag,
  useRemoveClientTag,
} from "./use-clients";

// Messaging hooks
export {
  useCrmClientMessages,
  useSendCrmMessage,
} from "./use-messaging";

// Re-export types for convenience
export type {
  ClientFilters,
  CreateFieldInput,
  CreatePipelineInput,
  CreateStageInput,
  CrmClient,
  CrmClientProfile,
  CustomFieldDefinition,
  DirectMessage,
  Pipeline,
  PipelineStage,
  PipelineWithStageCount,
  SendMessageInput,
  UpdateFieldInput,
  UpdatePipelineInput,
  UpdateStageInput,
} from "@/shared/lib/api";
