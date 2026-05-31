/**
 * MindState Builder Store (TanStack Store)
 *
 * Manages mindstate definition editing state with event bus integration.
 * Migrated from Zustand to TanStack Store for consistency with app architecture.
 */

import { Store } from "@tanstack/react-store";

import { createLogger } from "@journey/logger";
import type { MindstateDefinition, StateParameter, MainAgent, SystemAgent, StateChange, AgentInsight } from "@journey/schemas";
import type { BuilderStoreState, PreviewMessage, BuilderUIState, PreviewState, DefinitionHistoryEntry } from "../lib/types";
import {
  DEFAULT_MAIN_AGENT,
  DEFAULT_SYSTEM_AGENTS,
  DEFAULT_PARAMETERS,
  DEFAULT_CATEGORIES,
  generateId,
} from "../lib/defaults";
import { storeEventBus } from "@/stores/store-event-bus";

const log = createLogger("builder-store");

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Apply state changes to parameters
 * @internal Reserved for future use when preview mode is fully implemented
 */
function _applyStateChanges(
  parameters: StateParameter[],
  changes: StateChange[]
): StateParameter[] {
  if (!changes.length) return parameters;

  return parameters.map((param) => {
    const change = changes.find((c) => c.parameterId === param.id);
    if (!change) return param;

    return {
      ...param,
      currentValue: change.newValue,
      history: [
        ...param.history,
        {
          value: change.newValue,
          timestamp: Date.now(),
          reasoning: change.reasoning,
        },
      ],
    };
  });
}

/**
 * Create a new empty definition
 */
function createEmptyDefinition(
  key: string,
  name: string,
  description: string = "",
  orgId: string = ""
): MindstateDefinition {
  return {
    id: crypto.randomUUID(),
    organizationId: orgId,
    key,
    name,
    description,
    mainAgentConfig: { ...DEFAULT_MAIN_AGENT },
    defaultAgents: DEFAULT_SYSTEM_AGENTS.map((a) => ({ ...a })),
    defaultParameters: DEFAULT_PARAMETERS.map((p) => ({ ...p, history: [] })),
    analysisMode: "automatic",
    categories: [...DEFAULT_CATEGORIES],
    status: "draft",
  };
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialUIState: BuilderUIState = {
  activeTab: "preview",
  selectedAgentId: null,
  selectedParameterId: null,
  isSettingsOpen: false,
  isAgentModalOpen: false,
  isParameterModalOpen: false,
  editingAgentIsMain: false,
  agentJustSaved: false,
  paramJustSaved: false,
};

const initialPreviewState: PreviewState = {
  messages: [],
  parameters: [],
  insights: [],
  isProcessing: false,
  processingStatus: "",
  activeUpdates: new Set(),
};

const initialState: BuilderStoreState = {
  definition: null,
  originalDefinition: null,
  isDirty: false,
  isLoading: false,
  isSaving: false,
  preview: { ...initialPreviewState },
  ui: { ...initialUIState },
  undoStack: [],
  redoStack: [],
};

// =============================================================================
// UNDO/REDO CONFIGURATION
// =============================================================================

const MAX_UNDO_HISTORY = 30;

/**
 * Push current definition to undo stack before making changes
 * Clears redo stack since we're starting a new action branch
 */
function pushToUndoStack(): void {
  const state = builderStore.state;
  if (!state.definition) return;

  const historyEntry: DefinitionHistoryEntry = {
    definition: structuredClone(state.definition),
    timestamp: Date.now(),
  };

  builderStore.setState((s) => ({
    ...s,
    undoStack: [...s.undoStack.slice(-MAX_UNDO_HISTORY + 1), historyEntry],
    redoStack: [], // Clear redo on new action
  }));
}

// =============================================================================
// HMR-SAFE STORE CREATION
// =============================================================================

declare global {
   
  var __builderStore: Store<BuilderStoreState> | undefined;
}

function getOrCreateStore(): Store<BuilderStoreState> {
  if (typeof globalThis.__builderStore !== "undefined") {
    return globalThis.__builderStore;
  }
  const store = new Store<BuilderStoreState>(initialState);
  if (import.meta.env.DEV) {
    globalThis.__builderStore = store;
  }
  return store;
}

export const builderStore = getOrCreateStore();

// =============================================================================
// ACTIONS
// =============================================================================

export const builderActions = {
  // Definition management
  setDefinition: (definition: MindstateDefinition) => {
    builderStore.setState((s) => ({
      ...s,
      definition,
      originalDefinition: structuredClone(definition),
      isDirty: false,
      undoStack: [],
      redoStack: [],
      preview: {
        ...initialPreviewState,
        parameters: definition.defaultParameters.map((p) => ({ ...p })),
      },
    }));
    storeEventBus.emit({ type: "mindstate:definition:loaded", payload: { definitionId: definition.id } });
  },

  resetDefinition: () => {
    const state = builderStore.state;
    if (state.originalDefinition) {
      const definition = structuredClone(state.originalDefinition);
      builderStore.setState((s) => ({
        ...s,
        definition,
        isDirty: false,
        preview: {
          ...s.preview,
          parameters: definition.defaultParameters.map((p: StateParameter) => ({ ...p })),
        },
      }));
    }
  },

  createNewDefinition: (key: string, name: string, description?: string) => {
    const definition = createEmptyDefinition(key, name, description);
    builderStore.setState((s) => ({
      ...s,
      definition,
      originalDefinition: null,
      isDirty: true,
      undoStack: [],
      redoStack: [],
      preview: {
        ...initialPreviewState,
        parameters: definition.defaultParameters.map((p) => ({ ...p })),
      },
    }));
  },

  // Main agent
  updateMainAgent: (updates: Partial<MindstateDefinition["mainAgentConfig"]>) => {
    const state = builderStore.state;
    if (state.definition) {
      pushToUndoStack();
      builderStore.setState((s) => ({
        ...s,
        definition: s.definition ? {
          ...s.definition,
          mainAgentConfig: {
            ...s.definition.mainAgentConfig,
            ...updates,
          },
        } : null,
        isDirty: true,
      }));
      storeEventBus.emit({ type: "mindstate:definition:updated", payload: { definitionId: state.definition.id, field: "mainAgent" } });
    }
  },

  // System agents
  addSystemAgent: (agent: MindstateDefinition["defaultAgents"][number]) => {
    const state = builderStore.state;
    if (state.definition) {
      pushToUndoStack();
      builderStore.setState((s) => ({
        ...s,
        definition: s.definition ? {
          ...s.definition,
          defaultAgents: [...s.definition.defaultAgents, agent],
        } : null,
        isDirty: true,
      }));
      storeEventBus.emit({ type: "mindstate:definition:updated", payload: { definitionId: state.definition.id, field: "systemAgents" } });
      storeEventBus.emit({ type: "mindstate:agent:added", payload: { agentId: agent.id } });
    }
  },

  updateSystemAgent: (id: string, updates: Partial<MindstateDefinition["defaultAgents"][number]>) => {
    const state = builderStore.state;
    if (state.definition) {
      pushToUndoStack();
      builderStore.setState((s) => ({
        ...s,
        definition: s.definition ? {
          ...s.definition,
          defaultAgents: s.definition.defaultAgents.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        } : null,
        isDirty: true,
      }));
      storeEventBus.emit({ type: "mindstate:definition:updated", payload: { definitionId: state.definition.id, field: "systemAgents" } });
      // Emit granular event with first changed field
      const changedField = Object.keys(updates)[0] || "unknown";
      storeEventBus.emit({ type: "mindstate:agent:updated", payload: { agentId: id, field: changedField } });
    }
  },

  deleteSystemAgent: (id: string) => {
    const state = builderStore.state;
    if (state.definition) {
      // Don't allow deleting general_agent
      if (id === "general_agent") return;

      // Find parameters that will be reassigned
      const reassignedParams = state.definition.defaultParameters.filter(
        (p) => p.responsibleAgentId === id
      );

      pushToUndoStack();
      builderStore.setState((s) => ({
        ...s,
        definition: s.definition ? {
          ...s.definition,
          defaultAgents: s.definition.defaultAgents.filter((a) => a.id !== id),
          defaultParameters: s.definition.defaultParameters.map((p) =>
            p.responsibleAgentId === id ? { ...p, responsibleAgentId: "general_agent" } : p
          ),
        } : null,
        isDirty: true,
      }));
      storeEventBus.emit({ type: "mindstate:definition:updated", payload: { definitionId: state.definition.id, field: "systemAgents" } });
      storeEventBus.emit({ type: "mindstate:agent:deleted", payload: { agentId: id } });

      // Emit assignment changed for each reassigned parameter
      for (const param of reassignedParams) {
        storeEventBus.emit({
          type: "mindstate:assignment:changed",
          payload: { parameterId: param.id, fromAgentId: id, toAgentId: "general_agent" },
        });
      }
    }
  },

  // Parameters
  addParameter: (param: StateParameter) => {
    const state = builderStore.state;
    if (state.definition) {
      pushToUndoStack();
      builderStore.setState((s) => ({
        ...s,
        definition: s.definition ? {
          ...s.definition,
          defaultParameters: [...s.definition.defaultParameters, param],
        } : null,
        preview: {
          ...s.preview,
          parameters: [...s.preview.parameters, { ...param }],
        },
        isDirty: true,
      }));
      storeEventBus.emit({ type: "mindstate:definition:updated", payload: { definitionId: state.definition.id, field: "parameters" } });
      storeEventBus.emit({ type: "mindstate:parameter:added", payload: { parameterId: param.id } });
    }
  },

  updateParameter: (id: string, updates: Partial<StateParameter>) => {
    const state = builderStore.state;
    if (state.definition) {
      // Check if assignment is changing
      const currentParam = state.definition.defaultParameters.find((p) => p.id === id);
      const oldAgentId = currentParam?.responsibleAgentId ?? null;
      const newAgentId = updates.responsibleAgentId !== undefined ? updates.responsibleAgentId : oldAgentId;
      const isAssignmentChanging = "responsibleAgentId" in updates && oldAgentId !== newAgentId;

      pushToUndoStack();
      builderStore.setState((s) => ({
        ...s,
        definition: s.definition ? {
          ...s.definition,
          defaultParameters: s.definition.defaultParameters.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        } : null,
        preview: {
          ...s.preview,
          parameters: s.preview.parameters.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        },
        isDirty: true,
      }));
      storeEventBus.emit({ type: "mindstate:definition:updated", payload: { definitionId: state.definition.id, field: "parameters" } });

      // Emit granular event with first changed field
      const changedField = Object.keys(updates)[0] || "unknown";
      storeEventBus.emit({ type: "mindstate:parameter:updated", payload: { parameterId: id, field: changedField } });

      // Emit assignment changed if responsibleAgentId changed
      if (isAssignmentChanging) {
        storeEventBus.emit({
          type: "mindstate:assignment:changed",
          payload: { parameterId: id, fromAgentId: oldAgentId, toAgentId: newAgentId },
        });
      }
    }
  },

  deleteParameter: (id: string) => {
    const state = builderStore.state;
    if (state.definition) {
      pushToUndoStack();
      builderStore.setState((s) => ({
        ...s,
        definition: s.definition ? {
          ...s.definition,
          defaultParameters: s.definition.defaultParameters.filter((p) => p.id !== id),
        } : null,
        preview: {
          ...s.preview,
          parameters: s.preview.parameters.filter((p) => p.id !== id),
        },
        isDirty: true,
      }));
      storeEventBus.emit({ type: "mindstate:definition:updated", payload: { definitionId: state.definition.id, field: "parameters" } });
      storeEventBus.emit({ type: "mindstate:parameter:deleted", payload: { parameterId: id } });
    }
  },

  // Categories
  addCategory: (name: string) => {
    const state = builderStore.state;
    if (state.definition && !state.definition.categories.includes(name)) {
      pushToUndoStack();
      builderStore.setState((s) => ({
        ...s,
        definition: s.definition ? {
          ...s.definition,
          categories: [...s.definition.categories, name],
        } : null,
        isDirty: true,
      }));
    }
  },

  removeCategory: (name: string) => {
    const state = builderStore.state;
    if (state.definition) {
      // Check if any parameters use this category
      const hasParams = state.definition.defaultParameters.some((p) => p.category === name);
      if (hasParams) return; // Don't remove if in use

      pushToUndoStack();
      builderStore.setState((s) => ({
        ...s,
        definition: s.definition ? {
          ...s.definition,
          categories: s.definition.categories.filter((c) => c !== name),
        } : null,
        isDirty: true,
      }));
    }
  },

  // Preview - Add user message
  addPreviewMessage: (message: PreviewMessage) => {
    builderStore.setState((s) => ({
      ...s,
      preview: {
        ...s.preview,
        messages: [...s.preview.messages, message],
      },
    }));
  },

  // Preview - Remove last message (for error rollback)
  removeLastPreviewMessage: () => {
    builderStore.setState((s) => ({
      ...s,
      preview: {
        ...s.preview,
        messages: s.preview.messages.slice(0, -1),
      },
    }));
  },

  // Preview - Apply analysis results
  applyPreviewResults: (result: {
    response: string;
    insights: AgentInsight[];
    stateChanges: StateChange[];
    updatedState: StateParameter[];
  }) => {
    const finalState = builderStore.state;

    // Create assistant message with insights
    const assistantMessage: PreviewMessage = {
      id: generateId("msg"),
      role: "assistant",
      content: result.response,
      timestamp: Date.now(),
      insights: result.insights,
      stateChanges: result.stateChanges,
    };

    // Set active updates for highlighting (2-second flash)
    const changedIds = new Set(result.stateChanges.map((change) => change.parameterId));

    builderStore.setState((s) => ({
      ...s,
      preview: {
        ...s.preview,
        messages: [...s.preview.messages, assistantMessage],
        parameters: result.updatedState,
        insights: [...s.preview.insights, ...result.insights],
        isProcessing: false,
        processingStatus: "",
        activeUpdates: changedIds,
      },
    }));

    // Clear highlights after 2 seconds
    setTimeout(() => {
      builderStore.setState((s) => ({
        ...s,
        preview: {
          ...s.preview,
          activeUpdates: new Set(),
        },
      }));
    }, 2000);

    storeEventBus.emit({
      type: "mindstate:preview:analyzed",
      payload: { messageCount: finalState.preview.messages.length + 2, insightsCount: result.insights.length },
    });

    log.info(
      {
        changesCount: result.stateChanges.length,
        insightsCount: result.insights.length,
      },
      "builderStore:applyPreviewResults:success"
    );
  },

  // Preview - Set processing state
  setPreviewProcessing: (isProcessing: boolean, status?: string) => {
    builderStore.setState((s) => ({
      ...s,
      preview: {
        ...s.preview,
        isProcessing,
        processingStatus: status || "",
      },
    }));
  },

  resetPreview: () => {
    const state = builderStore.state;
    if (state.definition) {
      builderStore.setState((s) => ({
        ...s,
        preview: {
          messages: [],
          parameters: s.definition?.defaultParameters.map((p) => ({ ...p })) ?? [],
          insights: [],
          isProcessing: false,
          processingStatus: "",
          activeUpdates: new Set(),
        },
      }));
      storeEventBus.emit({ type: "mindstate:preview:reset", payload: {} });
    }
  },

  setProcessingStatus: (status: string) => {
    builderStore.setState((s) => ({
      ...s,
      preview: {
        ...s.preview,
        processingStatus: status,
      },
    }));
  },

  // UI state
  setActiveTab: (tab: BuilderUIState["activeTab"]) => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        activeTab: tab,
      },
    }));
  },

  openAgentModal: (agentId: string | null, isMain: boolean) => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        // Close parameter modal when opening agent modal
        isParameterModalOpen: false,
        selectedParameterId: null,
        // Open agent modal
        selectedAgentId: agentId,
        editingAgentIsMain: isMain,
        isAgentModalOpen: true,
      },
    }));
  },

  closeAgentModal: () => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        isAgentModalOpen: false,
        selectedAgentId: null,
        editingAgentIsMain: false,
      },
    }));
  },

  openParameterModal: (parameterId: string | null) => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        // Close agent modal when opening parameter modal
        isAgentModalOpen: false,
        selectedAgentId: null,
        editingAgentIsMain: false,
        // Open parameter modal
        selectedParameterId: parameterId,
        isParameterModalOpen: true,
      },
    }));
  },

  closeParameterModal: () => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        isParameterModalOpen: false,
        selectedParameterId: null,
      },
    }));
  },

  openSettings: () => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        isSettingsOpen: true,
      },
    }));
  },

  closeSettings: () => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        isSettingsOpen: false,
      },
    }));
  },

  // Save tracking (prevents duplicate saves on modal close)
  markAgentSaved: () => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        agentJustSaved: true,
      },
    }));
  },

  markParameterSaved: () => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        paramJustSaved: true,
      },
    }));
  },

  clearAgentSaveFlag: () => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        agentJustSaved: false,
      },
    }));
  },

  clearParameterSaveFlag: () => {
    builderStore.setState((s) => ({
      ...s,
      ui: {
        ...s.ui,
        paramJustSaved: false,
      },
    }));
  },

  // Persistence
  setLoading: (loading: boolean) => {
    builderStore.setState((s) => ({ ...s, isLoading: loading }));
  },

  setSaving: (saving: boolean) => {
    builderStore.setState((s) => ({ ...s, isSaving: saving }));
  },

  markClean: () => {
    builderStore.setState((s) => ({
      ...s,
      isDirty: false,
      originalDefinition: s.definition ? structuredClone(s.definition) : null,
    }));
    if (builderStore.state.definition) {
      storeEventBus.emit({ type: "mindstate:definition:saved", payload: { definitionId: builderStore.state.definition.id } });
    }
  },

  // Undo/Redo
  undo: (): boolean => {
    const state = builderStore.state;
    if (state.undoStack.length === 0) return false;

    const previousEntry = state.undoStack[state.undoStack.length - 1];
    const currentEntry: DefinitionHistoryEntry = {
      definition: structuredClone(state.definition!),
      timestamp: Date.now(),
    };

    builderStore.setState((s) => ({
      ...s,
      definition: previousEntry.definition,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, currentEntry],
      isDirty: true,
      preview: {
        ...s.preview,
        parameters: previousEntry.definition.defaultParameters.map((p) => ({ ...p })),
      },
    }));

    return true;
  },

  redo: (): boolean => {
    const state = builderStore.state;
    if (state.redoStack.length === 0) return false;

    const nextEntry = state.redoStack[state.redoStack.length - 1];
    const currentEntry: DefinitionHistoryEntry = {
      definition: structuredClone(state.definition!),
      timestamp: Date.now(),
    };

    builderStore.setState((s) => ({
      ...s,
      definition: nextEntry.definition,
      undoStack: [...s.undoStack, currentEntry],
      redoStack: s.redoStack.slice(0, -1),
      isDirty: true,
      preview: {
        ...s.preview,
        parameters: nextEntry.definition.defaultParameters.map((p) => ({ ...p })),
      },
    }));

    return true;
  },

  canUndo: (): boolean => builderStore.state.undoStack.length > 0,
  canRedo: (): boolean => builderStore.state.redoStack.length > 0,

  /**
   * Reset store to initial state (used on logout/user change)
   */
  reset: () => {
    builderStore.setState(() => initialState);
    storeEventBus.emit({ type: "mindstate:builder:reset", payload: {} });
  },
};

// =============================================================================
// SELECTORS
// =============================================================================

export const builderSelectors = {
  definition: (state: BuilderStoreState) => state.definition,
  mainAgent: (state: BuilderStoreState) => state.definition?.mainAgentConfig,
  systemAgents: (state: BuilderStoreState) => state.definition?.defaultAgents ?? [],
  parameters: (state: BuilderStoreState) => state.definition?.defaultParameters ?? [],
  categories: (state: BuilderStoreState) => state.definition?.categories ?? [],
  previewMessages: (state: BuilderStoreState) => state.preview.messages,
  previewParameters: (state: BuilderStoreState) => state.preview.parameters,
  previewInsights: (state: BuilderStoreState) => state.preview.insights,
  isProcessing: (state: BuilderStoreState) => state.preview.isProcessing,
  isDirty: (state: BuilderStoreState) => state.isDirty,
  isLoading: (state: BuilderStoreState) => state.isLoading,
  isSaving: (state: BuilderStoreState) => state.isSaving,

  // Get agent by ID
  getAgentById: (state: BuilderStoreState, id: string): MainAgent | SystemAgent | undefined => {
    if (state.definition?.mainAgentConfig.id === id) {
      return state.definition.mainAgentConfig;
    }
    return state.definition?.defaultAgents.find((a) => a.id === id);
  },

  // Get parameter by ID
  getParameterById: (state: BuilderStoreState, id: string): StateParameter | undefined => {
    return state.definition?.defaultParameters.find((p) => p.id === id);
  },

  // Get parameters grouped by category
  parametersByCategory: (state: BuilderStoreState): Record<string, StateParameter[]> => {
    const params = state.definition?.defaultParameters ?? [];
    return params.reduce(
      (acc, param) => {
        const category = param.category || "Uncategorized";
        if (!acc[category]) acc[category] = [];
        acc[category].push(param);
        return acc;
      },
      {} as Record<string, StateParameter[]>
    );
  },
};

// =============================================================================
// EVENT BUS SUBSCRIPTIONS (with cleanup for HMR)
// =============================================================================

/**
 * Store subscription cleanup functions for HMR and testing.
 */
const builderStoreCleanupFunctions: (() => void)[] = [];

/**
 * Setup store event subscriptions.
 */
function setupBuilderStoreSubscriptions(): void {
  // Clear any existing subscriptions first (HMR safety)
  cleanupBuilderStoreSubscriptions();

  // Reset builder store on user logout
  builderStoreCleanupFunctions.push(
    storeEventBus.on("user:loggedOut", () => {
      builderActions.reset();
    })
  );
}

/**
 * Cleanup builder store subscriptions.
 * Called during HMR disposal and can be used in tests.
 */
export function cleanupBuilderStoreSubscriptions(): void {
  builderStoreCleanupFunctions.forEach((fn) => fn());
  builderStoreCleanupFunctions.length = 0;
}

// Initialize subscriptions
setupBuilderStoreSubscriptions();

// HMR cleanup: Dispose subscriptions before module is replaced
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupBuilderStoreSubscriptions();
  });
}
