/**
 * Agent Config Shared Components
 *
 * Reusable UI components for agent configuration.
 * Used by both journey agent editor and workflow agent config.
 *
 * @module features/nodes/journey/editors/sections/agent-config
 */

// Types
export * from "./types";

// Components
export { BuiltInToolsSection, type BuiltInToolsSectionProps } from "./built-in-tools-section";
export { ConversationHistorySection, type ConversationHistorySectionProps } from "./conversation-history-section";
export { LLMConfigSection, type LLMConfigSectionProps } from "./llm-config-section";
export { MemorySection, type MemorySectionProps } from "./memory-section";
export {
  ExternalToolItem,
  ExternalToolCategorySection,
  EXTERNAL_TOOL_CATEGORY_CONFIG,
  type ExternalToolItemProps,
  type ExternalToolCategorySectionProps,
} from "./external-tool-item";
