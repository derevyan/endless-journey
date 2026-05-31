/**
 * Agent Workflow Header Store
 *
 * TanStack Store for agent workflow-specific controls in the dashboard header.
 * This allows the Agent Workflow Builder to inject its controls into the global header.
 *
 * Follows the same pattern as journeyHeaderStore for consistency.
 *
 * NOTE: Like journeyHeaderStore, reactive state (isDirty, canUndo, canRedo) is NOT stored here.
 * Instead, the header component reads directly from agentWorkflowStore for proper reactivity.
 * This store only contains metadata and callbacks.
 *
 * @module features/dashboard/store/agent-workflow-header-store
 */

import { Store } from "@tanstack/react-store";

import type { AgentWorkflowMode } from "@/features/agent-workflows/stores/agent-workflow-store";
import type { LayoutOptions } from "@/shared/lib/ui/layout";

export interface AgentWorkflowHeaderState {
  // Workflow info
  workflowKey: string | null;
  workflowName: string | null;
  workflowStatus: string | null;

  // Mode state
  mode: AgentWorkflowMode;
  onModeChange: ((mode: AgentWorkflowMode) => void) | null;

  // Callbacks
  onWorkflowSelect: ((workflowKey: string) => void) | null;
  onSave: (() => void) | null;
  onDiscard: (() => void) | null;
  onUndo: (() => void) | null;
  onRedo: (() => void) | null;
  onHistoryClick: (() => void) | null;
  onSettings: (() => void) | null;
  onAutoLayout: ((options: LayoutOptions) => void) | null;

  // Is the workflow page active?
  isActive: boolean;
}

const initialState: AgentWorkflowHeaderState = {
  workflowKey: null,
  workflowName: null,
  workflowStatus: null,
  mode: "edit",
  onModeChange: null,
  onWorkflowSelect: null,
  onSave: null,
  onDiscard: null,
  onUndo: null,
  onRedo: null,
  onHistoryClick: null,
  onSettings: null,
  onAutoLayout: null,
  isActive: false,
};

// HMR Safety - Singleton pattern prevents stale subscriptions during hot reload
declare global {
  var __agentWorkflowHeaderStore: ReturnType<typeof createStore> | undefined;
}

function createStore() {
  return new Store<AgentWorkflowHeaderState>(initialState);
}

function getOrCreateStore() {
  if (globalThis.__agentWorkflowHeaderStore) {
    return globalThis.__agentWorkflowHeaderStore;
  }
  const store = createStore();
  if (import.meta.env.DEV) {
    globalThis.__agentWorkflowHeaderStore = store;
  }
  return store;
}

export const agentWorkflowHeaderStore = getOrCreateStore();

// Actions to update the store
export const agentWorkflowHeaderActions = {
  setControls: (controls: Partial<AgentWorkflowHeaderState>) => {
    agentWorkflowHeaderStore.setState((state) => ({
      ...state,
      ...controls,
      isActive: true,
    }));
  },

  clearControls: () => {
    agentWorkflowHeaderStore.setState(() => initialState);
  },
};
