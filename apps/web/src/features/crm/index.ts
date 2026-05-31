/**
 * CRM Feature
 *
 * Customer Relationship Management system with pipeline kanban,
 * client profiles, messaging, and custom field management.
 */

// Main components
export { ClientTagsEditor } from "./components/client-tags-editor";
// CrmNode moved to @/nodes/components/crm-node
export { CrmSettingsDialog } from "./components/crm-settings-dialog";
export { CrmSettingsMenu } from "./components/crm-settings-menu";

// Client detail submodule
export {
  ClientDetailSheet,
  ConversationPanel,
  MessageThread,
  ProfileHeader,
  ProfilePanel,
  ProfileStats,
} from "./components/client-detail";

// Messaging submodule
export { MessageComposer, MessageHistory } from "./components/messaging";

// Pipeline submodule
export {
  ActiveFiltersBadges,
  ClientCard,
  CrmFilterToolbar,
  PipelineKanban,
  StageFormDialog,
} from "./components/pipeline";

// Re-export types
export type { CrmFilters as CrmFiltersType, StageFormData } from "./components/pipeline";

// Query hooks
export {
  useAddClientTag,
  useCrmClient,
  useCrmClientMessages,
  useCrmClients,
  useCrmClientTimeline,
  useCreateCrmField,
  useCreateCrmPipeline,
  useCreateCrmStage,
  useCrmFields,
  useCrmPipeline,
  useCrmPipelines,
  useCrmStages,
  useDeleteCrmField,
  useDeleteCrmPipeline,
  useDeleteCrmStage,
  useRemoveClientTag,
  useSendCrmMessage,
  useSetDefaultPipeline,
  useUpdateClientFields,
  useUpdateClientStage,
  useCrmPipeline as useUpdateCrmPipeline,
  useUpdateCrmField,
  useUpdateCrmStage,
  useReorderCrmPipelines,
  useReorderCrmStages,
} from "./hooks";

// Types
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
} from "./hooks";

// API utilities
export * from "@/shared/lib/api/crm";
