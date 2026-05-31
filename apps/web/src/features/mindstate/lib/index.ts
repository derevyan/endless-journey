/**
 * MindState Feature Utilities
 *
 * Re-exports mindstate-related utilities and configurations.
 *
 * NOTE: Core types (StateParameter, AgentInsight, MindstateDefinition, etc.)
 * should be imported directly from @journey/schemas for consistency.
 */

// API utilities from shared (includes API client and types)
export * from "@/shared/lib/api/mindstate";

// Builder utilities
export * from "./colors";
export * from "./defaults";

// Builder-specific types
export type {
  PreviewMessage,
  BuilderUIState,
  PreviewState,
  BuilderStoreState,
  BuilderStoreActions,
  BuilderStore,
  AgentFormData,
  ParameterFormData,
} from "./types";
