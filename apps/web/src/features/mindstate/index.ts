/**
 * MindState Feature
 *
 * Unified feature for viewing and building MindState definitions.
 * Combines viewer components for read-only display and builder
 * components for definition authoring.
 */

// ============================================================================
// COMMON COMPONENTS (Shared between builder and viewer)
// ============================================================================
export { StateCard, InsightBadge } from "./components/common";
export { MindstateDefinitionSelector } from "./components/mindstate-definition-selector";

// ============================================================================
// VIEWER COMPONENTS (Read-only display)
// ============================================================================
export { MindstatePanel } from "./components/viewer";
export { StateGrid as ViewerStateGrid } from "./components/viewer";

// ============================================================================
// BUILDER COMPONENTS (Definition authoring)
// ============================================================================
export { BuilderLayout } from "./components/builder";
export {
  BuilderSidebar,
  BuilderPreview,
  BuilderDashboard,
  MainAgentCard,
  SystemAgentList,
  ParameterList,
  MessageBubble,
  ProcessingIndicator,
  CommandMenu,
  StateGrid as BuilderStateGrid,
  AgentModal,
  ParameterModal,
  SettingsModal,
  DynamicIcon,
  getAvailableIcons,
} from "./components/builder";

// ============================================================================
// QUERY HOOKS (keys centralized in @/shared/lib/query-keys.ts)
// ============================================================================
export {
  useClientMindstates,
  useMindstateDefinitions,
  useMindstateDefinition,
  useAnalyzeMindstate,
  useMindstateHistory,
  useMindstateDefinitionDialogNavigation,
} from "./hooks";

// ============================================================================
// STORE
// ============================================================================
export { builderStore, builderActions, builderSelectors } from "./stores";

// ============================================================================
// UTILITIES & TYPES
// ============================================================================
export * from "./lib";
