/**
 * Builder-specific Types
 *
 * Types used exclusively within the mindstate builder feature.
 */

import type { MindstateDefinition, StateParameter, AgentInsight, StateChange } from "@journey/schemas";

/**
 * Message in the preview chat
 */
export interface PreviewMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** Insights generated for this message (assistant messages only) */
  insights?: AgentInsight[];
  /** State changes from this message (assistant messages only) */
  stateChanges?: StateChange[];
}

/**
 * Builder UI state
 */
export interface BuilderUIState {
  activeTab: "preview" | "state" | "insights";
  selectedAgentId: string | null;
  selectedParameterId: string | null;
  isSettingsOpen: boolean;
  isAgentModalOpen: boolean;
  isParameterModalOpen: boolean;
  editingAgentIsMain: boolean;
  agentJustSaved: boolean;
  paramJustSaved: boolean;
}

/**
 * Preview state for testing mindstate analysis
 */
export interface PreviewState {
  messages: PreviewMessage[];
  parameters: StateParameter[];
  insights: AgentInsight[];
  isProcessing: boolean;
  processingStatus: string;
  activeUpdates: Set<string>;
}

/**
 * History entry for undo/redo
 */
export interface DefinitionHistoryEntry {
  definition: MindstateDefinition;
  timestamp: number;
}

/**
 * Complete builder store state
 */
export interface BuilderStoreState {
  // Definition being edited
  definition: MindstateDefinition | null;
  originalDefinition: MindstateDefinition | null;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;

  // Preview state
  preview: PreviewState;

  // UI state
  ui: BuilderUIState;

  // Undo/redo history
  undoStack: DefinitionHistoryEntry[];
  redoStack: DefinitionHistoryEntry[];
}

/**
 * Builder store actions
 */
export interface BuilderStoreActions {
  // Definition management
  setDefinition: (definition: MindstateDefinition) => void;
  resetDefinition: () => void;
  createNewDefinition: (key: string, name: string, description?: string) => void;

  // Main agent
  updateMainAgent: (updates: Partial<MindstateDefinition["mainAgentConfig"]>) => void;

  // System agents
  addSystemAgent: (agent: MindstateDefinition["defaultAgents"][number]) => void;
  updateSystemAgent: (id: string, updates: Partial<MindstateDefinition["defaultAgents"][number]>) => void;
  deleteSystemAgent: (id: string) => void;

  // Parameters
  addParameter: (param: StateParameter) => void;
  updateParameter: (id: string, updates: Partial<StateParameter>) => void;
  deleteParameter: (id: string) => void;

  // Categories
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;

  // Preview
  sendPreviewMessage: (text: string) => Promise<void>;
  resetPreview: () => void;
  setProcessingStatus: (status: string) => void;

  // UI state
  setActiveTab: (tab: BuilderUIState["activeTab"]) => void;
  openAgentModal: (agentId: string | null, isMain: boolean) => void;
  closeAgentModal: () => void;
  openParameterModal: (parameterId: string | null) => void;
  closeParameterModal: () => void;
  openSettings: () => void;
  closeSettings: () => void;

  // Persistence
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  markClean: () => void;
}

/**
 * Complete builder store type
 */
export type BuilderStore = BuilderStoreState & BuilderStoreActions;

/**
 * Agent form data for the modal
 */
export interface AgentFormData {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  systemPrompt: string;
  llmModel: string;
  llmTemperature: number;
}

/**
 * Parameter form data for the modal
 */
export interface ParameterFormData {
  id: string;
  name: string;
  category: string;
  description: string;
  scaleType: "NUMERIC" | "CATEGORICAL" | "BOOLEAN";
  min: number;
  max: number;
  options: string;
  currentValue: string;
  responsibleAgentId: string;
  semanticDirection: "low_is_good" | "high_is_good" | "";
  phrasesRaise: string;
  phrasesLower: string;
  observations: string;
}
