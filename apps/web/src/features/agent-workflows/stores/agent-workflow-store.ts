/**
 * Agent Workflow Store
 *
 * TanStack Store for managing agent workflow canvas state.
 *
 * @module features/agent-workflows/stores/agent-workflow-store
 */

import { Store } from "@tanstack/react-store";
import type { Node, Edge, Connection, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowConfiguration,
  WorkflowSettings,
  WorkflowStatus,
} from "@journey/schemas";
import { llmConfig } from "@journey/schemas";

import {
  getLayoutedElementsGeneric,
  DEFAULT_WORKFLOW_LAYOUT_OPTIONS,
  type LayoutOptions,
  type InternalLayoutOptions,
} from "@/shared/lib/ui/layout";
import { storeEventBus } from "@/stores/store-event-bus";

import { getDefaultNodeData, generateNodeName } from "@/features/nodes/workflow/lib/node-factory";
import type { NodeDimensions } from "@/features/nodes/workflow/lib/node-dimensions";

import { getLayoutedElements } from "../lib/layout";
import { ensureLlmProvider, ensureWorkflowNodeType } from "../lib/type-guards";

// =============================================================================
// TYPES
// =============================================================================

/** Node as represented in React Flow (with position) */
export type WorkflowCanvasNode = Node<WorkflowNode["data"], WorkflowNodeType>;

/** Edge as represented in React Flow */
export type WorkflowCanvasEdge = Edge<{ label?: string }>;

/** Clipboard data for copy/paste */
export interface WorkflowClipboard {
  nodeData: WorkflowNode["data"];
  nodeType: WorkflowNodeType;
  copiedAt: number;
}

/** UI settings for the workflow editor (includes metadata + API settings) */
export interface WorkflowUISettings {
  // Metadata (stored in workflow root)
  name: string;
  description: string;
  status: WorkflowStatus;
  // Default LLM settings (stored in workflow.settings.defaultLlm)
  defaultProvider: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  // Execution settings (stored in workflow.settings.execution)
  timeoutSeconds: number;
}

/** Editor mode for agent workflow builder */
export type AgentWorkflowMode = "edit" | "simulator";

export interface AgentWorkflowState {
  /** Current editor mode */
  mode: AgentWorkflowMode;

  /** Current workflow key */
  workflowKey: string | null;

  /** Currently active node in simulator (for visual indication) */
  simulatorCurrentNodeId: string | null;

  /** Nodes that have been executed in simulator (for path highlighting) */
  simulatorVisitedNodeIds: string[];

  /** Edges that have been traversed in simulator (for path highlighting) */
  simulatorVisitedEdgeIds: string[];

  /** Nodes on the canvas */
  nodes: WorkflowCanvasNode[];

  /** Edges connecting nodes */
  edges: WorkflowCanvasEdge[];

  /** Original nodes from last save (for reset/discard) */
  originalNodes: WorkflowCanvasNode[];

  /** Original edges from last save (for reset/discard) */
  originalEdges: WorkflowCanvasEdge[];

  /** Original API settings from last save (for reset/discard) */
  originalSettings: WorkflowSettings | null;

  /** Currently selected node ID */
  selectedNodeId: string | null;

  /** Currently selected edge ID */
  selectedEdgeId: string | null;

  /** Whether there are unsaved changes */
  isDirty: boolean;

  /** Whether the workflow is valid */
  isValid: boolean;

  /** Validation errors */
  validationErrors: Array<{ path: string; message: string }>;

  /** Undo/redo history */
  history: {
    past: Array<{ nodes: WorkflowCanvasNode[]; edges: WorkflowCanvasEdge[] }>;
    future: Array<{ nodes: WorkflowCanvasNode[]; edges: WorkflowCanvasEdge[] }>;
  };

  /** Clipboard for copy/paste operations */
  clipboard: WorkflowClipboard | null;

  /** Snapshot of state before layout preview (for cancel/restore) */
  layoutPreviewSnapshot: { nodes: WorkflowCanvasNode[]; edges: WorkflowCanvasEdge[] } | null;

  /** Last applied layout settings (for remembering user preferences) */
  layoutSettings: LayoutOptions | null;

  /** UI settings for the settings dialog */
  settings: WorkflowUISettings;

  /** Whether settings dialog is open */
  settingsDialogOpen: boolean;

  /** Whether auto-layout panel is open */
  autoLayoutPanelOpen: boolean;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: AgentWorkflowState = {
  mode: "edit",
  workflowKey: null,
  simulatorCurrentNodeId: null,
  simulatorVisitedNodeIds: [],
  simulatorVisitedEdgeIds: [],
  nodes: [],
  edges: [],
  originalNodes: [],
  originalEdges: [],
  originalSettings: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  isDirty: false,
  isValid: true,
  validationErrors: [],
  history: {
    past: [],
    future: [],
  },
  clipboard: null,
  layoutPreviewSnapshot: null,
  layoutSettings: null,
  settings: {
    name: "",
    description: "",
    status: "draft",
    defaultProvider: "openai",
    defaultModel: llmConfig.agent.model.id,
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    timeoutSeconds: 300,
  },
  settingsDialogOpen: false,
  autoLayoutPanelOpen: false,
};

// =============================================================================
// STORE
// =============================================================================

// HMR Protection: Preserve store instance across hot module reloads.
// Without this, React components remain subscribed to old instances, breaking reactivity.

declare global {
   
  var __agentWorkflowStore: Store<AgentWorkflowState> | undefined;
}

function getOrCreateStore(): Store<AgentWorkflowState> {
  if (typeof globalThis.__agentWorkflowStore !== "undefined") {
    return globalThis.__agentWorkflowStore;
  }
  const store = new Store<AgentWorkflowState>(initialState);
  if (import.meta.env.DEV) {
    globalThis.__agentWorkflowStore = store;
  }
  return store;
}

export const agentWorkflowStore = getOrCreateStore();

// =============================================================================
// AUTO-SAVE HELPERS
// =============================================================================

async function flushActiveEditor(): Promise<boolean> {
  if (storeEventBus.getListenerCount("saveManager:flushActive") === 0) {
    return true;
  }

  return await new Promise((resolve) => {
    storeEventBus.emit({
      type: "saveManager:flushActive",
      payload: { onComplete: resolve },
    });
  });
}

/**
 * Clear selection with auto-save support.
 * Flushes the active editor before clearing selection.
 */
export async function clearSelectionWithAutoSave(): Promise<boolean> {
  const success = await flushActiveEditor();
  if (!success) {
    return false;
  }

  agentWorkflowActions.clearSelection();
  return true;
}

/**
 * Select a node with auto-save support.
 * Flushes the active editor before switching selection.
 */
export async function selectNodeWithAutoSave(nodeId: string): Promise<boolean> {
  const success = await flushActiveEditor();
  if (!success) {
    return false;
  }

  agentWorkflowActions.selectNode(nodeId);
  return true;
}

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Convert WorkflowNode[] from API to React Flow nodes
 */
function toCanvasNodes(nodes: WorkflowNode[]): WorkflowCanvasNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
    selected: false,
  }));
}

/**
 * Convert WorkflowEdge[] from API to React Flow edges
 */
function toCanvasEdges(edges: WorkflowEdge[]): WorkflowCanvasEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    data: { label: edge.label },
  }));
}

/**
 * Convert React Flow nodes back to WorkflowNode[]
 */
export function fromCanvasNodes(nodes: WorkflowCanvasNode[]): WorkflowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: ensureWorkflowNodeType(node.type),
    position: node.position,
    data: node.data,
  }));
}

/**
 * Convert React Flow edges back to WorkflowEdge[]
 */
export function fromCanvasEdges(edges: WorkflowCanvasEdge[]): WorkflowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    label: edge.data?.label,
  }));
}

/**
 * Convert API WorkflowSettings to UI settings format
 */
function settingsFromApi(
  name: string,
  description: string,
  status: WorkflowStatus,
  settings: WorkflowSettings | null
): WorkflowUISettings {
  return {
    name,
    description,
    status,
    defaultProvider: settings?.defaultLlm?.provider ?? "openai",
    defaultModel: settings?.defaultLlm?.model ?? llmConfig.agent.model.id,
    defaultTemperature: settings?.defaultLlm?.temperature ?? 0.7,
    defaultMaxTokens: settings?.defaultLlm?.maxTokens ?? 2048,
    timeoutSeconds: settings?.execution?.timeoutSeconds ?? 300,
  };
}

/**
 * Convert UI settings to API WorkflowSettings format
 */
export function settingsToApi(uiSettings: WorkflowUISettings): WorkflowSettings {
  return {
    defaultLlm: {
      // Uses canonical LLMProvider values (openai, anthropic, google-genai, groq)
      provider: ensureLlmProvider(uiSettings.defaultProvider, llmConfig.agent.model.provider),
      model: uiSettings.defaultModel,
      temperature: uiSettings.defaultTemperature,
      maxTokens: uiSettings.defaultMaxTokens,
    },
    execution: {
      timeoutSeconds: uiSettings.timeoutSeconds,
      maxIterations: 50, // Default value
    },
  };
}

/**
 * Build WorkflowConfiguration from current canvas state
 */
export function getConfiguration(): WorkflowConfiguration {
  const { nodes, edges } = agentWorkflowStore.state;
  return {
    nodes: fromCanvasNodes(nodes),
    edges: fromCanvasEdges(edges),
  };
}

export const agentWorkflowActions = {
  /**
   * Set editor mode (edit/simulator)
   */
  setMode(mode: AgentWorkflowMode) {
    agentWorkflowStore.setState((state) => ({
      ...state,
      mode,
      // Clear simulator state when switching to edit mode
      simulatorCurrentNodeId: mode === "edit" ? null : state.simulatorCurrentNodeId,
      simulatorVisitedNodeIds: mode === "edit" ? [] : state.simulatorVisitedNodeIds,
      simulatorVisitedEdgeIds: mode === "edit" ? [] : state.simulatorVisitedEdgeIds,
    }));
  },

  /**
   * Set the currently active node in simulator (for visual indication)
   */
  setSimulatorCurrentNode(nodeId: string | null) {
    agentWorkflowStore.setState((state) => ({
      ...state,
      simulatorCurrentNodeId: nodeId,
    }));
  },

  /**
   * Add a node to the visited list (for path highlighting)
   */
  addSimulatorVisitedNode(nodeId: string) {
    agentWorkflowStore.setState((state) => ({
      ...state,
      simulatorVisitedNodeIds: state.simulatorVisitedNodeIds.includes(nodeId)
        ? state.simulatorVisitedNodeIds
        : [...state.simulatorVisitedNodeIds, nodeId],
    }));
  },

  /**
   * Add an edge to the visited list (for path highlighting)
   */
  addSimulatorVisitedEdge(edgeId: string) {
    agentWorkflowStore.setState((state) => ({
      ...state,
      simulatorVisitedEdgeIds: state.simulatorVisitedEdgeIds.includes(edgeId)
        ? state.simulatorVisitedEdgeIds
        : [...state.simulatorVisitedEdgeIds, edgeId],
    }));
  },

  /**
   * Clear all visited nodes and edges (reset path highlighting)
   */
  clearSimulatorVisitedNodes() {
    agentWorkflowStore.setState((state) => ({
      ...state,
      simulatorVisitedNodeIds: [],
      simulatorVisitedEdgeIds: [],
      simulatorCurrentNodeId: null,
    }));
  },

  /**
   * Initialize the store with workflow data from API
   */
  initialize(
    workflowKey: string,
    name: string,
    description: string,
    status: WorkflowStatus,
    configuration: WorkflowConfiguration,
    settings: WorkflowSettings | null
  ) {
    const canvasNodes = toCanvasNodes(configuration.nodes);
    const canvasEdges = toCanvasEdges(configuration.edges);
    const uiSettings = settingsFromApi(name, description, status, settings);

    agentWorkflowStore.setState((state) => ({
      ...state,
      workflowKey,
      nodes: canvasNodes,
      edges: canvasEdges,
      // Store originals for reset/discard functionality
      originalNodes: structuredClone(canvasNodes),
      originalEdges: structuredClone(canvasEdges),
      originalSettings: settings ? structuredClone(settings) : null,
      settings: uiSettings,
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: false,
      isValid: true,
      validationErrors: [],
      history: { past: [], future: [] },
    }));
  },

  /**
   * Reset the store to initial state
   */
  reset() {
    agentWorkflowStore.setState(() => initialState);
  },

  /**
   * Save current state to history for undo
   */
  _saveToHistory() {
    const { nodes, edges, history } = agentWorkflowStore.state;
    agentWorkflowStore.setState((state) => ({
      ...state,
      history: {
        past: [...history.past.slice(-49), { nodes, edges }],
        future: [],
      },
    }));
  },

  /**
   * Apply node changes from React Flow
   */
  applyNodeChanges(changes: NodeChange<WorkflowCanvasNode>[], applyChanges: typeof applyNodeChanges) {
    const { nodes } = agentWorkflowStore.state;

    // Filter out remove changes for start node (can't delete start)
    const filteredChanges = changes.filter((change) => {
      if (change.type === "remove") {
        const node = nodes.find((n) => n.id === change.id);
        return node?.type !== "start";
      }
      return true;
    });

    const newNodes = applyChanges(filteredChanges, nodes) as WorkflowCanvasNode[];

    // Only mark dirty for changes that actually modify the graph
    // (not dimensions/select which are React Flow internal state)
    const hasMutatingChange = filteredChanges.some(
      (c) => c.type === "add" || c.type === "remove" || c.type === "position"
    );

    agentWorkflowStore.setState((state) => ({
      ...state,
      nodes: newNodes,
      isDirty: hasMutatingChange ? true : state.isDirty,
    }));
  },

  /**
   * Apply edge changes from React Flow
   */
  applyEdgeChanges(changes: EdgeChange[], applyChanges: typeof applyEdgeChanges) {
    const { edges } = agentWorkflowStore.state;
    const newEdges = applyChanges(changes, edges);

    agentWorkflowStore.setState((state) => ({
      ...state,
      edges: newEdges,
      isDirty: true,
    }));
  },

  /**
   * Add a new node at the specified position
   */
  addNode(type: WorkflowNodeType, position: { x: number; y: number }) {
    this._saveToHistory();

    const { nodes } = agentWorkflowStore.state;
    const id = `${type}-${Date.now()}`;
    const name = generateNodeName(type, nodes);
    const data = getDefaultNodeData(type);

    // Add the generated name to node data
    (data as Record<string, unknown>).name = name;

    const newNode: WorkflowCanvasNode = {
      id,
      type,
      position,
      data,
      selected: false,
    };

    agentWorkflowStore.setState((state) => ({
      ...state,
      nodes: [...state.nodes, newNode],
      selectedNodeId: id,
      isDirty: true,
    }));

    return id;
  },

  /**
   * Update a node's data
   */
  updateNodeData(nodeId: string, data: Partial<WorkflowNode["data"]>) {
    this._saveToHistory();

    agentWorkflowStore.setState((state) => ({
      ...state,
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
      isDirty: true,
    }));
  },

  /**
   * Delete a node
   */
  deleteNode(nodeId: string) {
    const { nodes } = agentWorkflowStore.state;
    const node = nodes.find((n) => n.id === nodeId);

    // Don't allow deleting start node
    if (node?.type === "start") return;

    this._saveToHistory();

    agentWorkflowStore.setState((state) => ({
      ...state,
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    }));
  },

  /**
   * Add a connection (edge) between nodes
   */
  addEdge(connection: Connection) {
    if (!connection.source || !connection.target) return;

    this._saveToHistory();

    const id = `e-${connection.source}-${connection.target}-${Date.now()}`;
    const newEdge: WorkflowCanvasEdge = {
      id,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
    };

    agentWorkflowStore.setState((state) => ({
      ...state,
      edges: [...state.edges, newEdge],
      isDirty: true,
    }));
  },

  /**
   * Delete an edge
   */
  deleteEdge(edgeId: string) {
    this._saveToHistory();

    agentWorkflowStore.setState((state) => ({
      ...state,
      edges: state.edges.filter((e) => e.id !== edgeId),
      selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
      isDirty: true,
    }));
  },

  /**
   * Select a node
   */
  selectNode(nodeId: string | null) {
    agentWorkflowStore.setState((state) => ({
      ...state,
      selectedNodeId: nodeId,
      selectedEdgeId: null,
    }));
  },

  /**
   * Select an edge
   */
  selectEdge(edgeId: string | null) {
    agentWorkflowStore.setState((state) => ({
      ...state,
      selectedEdgeId: edgeId,
      selectedNodeId: null,
    }));
  },

  /**
   * Clear selection
   */
  clearSelection() {
    agentWorkflowStore.setState((state) => ({
      ...state,
      selectedNodeId: null,
      selectedEdgeId: null,
    }));
  },

  /**
   * Undo last action
   */
  undo() {
    const { history, nodes, edges } = agentWorkflowStore.state;
    if (history.past.length === 0) return;

    const previous = history.past[history.past.length - 1];

    agentWorkflowStore.setState((state) => ({
      ...state,
      nodes: previous.nodes,
      edges: previous.edges,
      history: {
        past: history.past.slice(0, -1),
        future: [{ nodes, edges }, ...history.future],
      },
      isDirty: true,
    }));
  },

  /**
   * Redo last undone action
   */
  redo() {
    const { history, nodes, edges } = agentWorkflowStore.state;
    if (history.future.length === 0) return;

    const next = history.future[0];

    agentWorkflowStore.setState((state) => ({
      ...state,
      nodes: next.nodes,
      edges: next.edges,
      history: {
        past: [...history.past, { nodes, edges }],
        future: history.future.slice(1),
      },
      isDirty: true,
    }));
  },

  /**
   * Mark as saved (clear dirty flag)
   */
  markSaved() {
    agentWorkflowStore.setState((state) => ({
      ...state,
      isDirty: false,
    }));
  },

  /**
   * Update baseline snapshots to current state.
   * Called after successful save to ensure discardChanges reverts to
   * the last saved state, not the initial load state.
   *
   * This fixes the bug where users lose saved changes when clicking "Discard"
   * after making additional changes post-save.
   */
  updateBaseline() {
    agentWorkflowStore.setState((state) => ({
      ...state,
      originalNodes: structuredClone(state.nodes),
      originalEdges: structuredClone(state.edges),
      originalSettings: settingsToApi(state.settings),
    }));
  },

  /**
   * Commit a successful save: update baseline AND clear dirty flag.
   * Use this after successful API save instead of just markSaved().
   */
  commitSave() {
    this.updateBaseline();
    this.markSaved();
  },

  /**
   * Mark workflow as dirty when a form has pending changes.
   * This enables the Save button before the form is committed to store.
   * Called by form onChange listeners to provide immediate feedback.
   */
  markFormDirty() {
    agentWorkflowStore.setState((state) => ({
      ...state,
      isDirty: true,
    }));
  },

  /**
   * Set validation result
   */
  setValidation(isValid: boolean, errors: Array<{ path: string; message: string }>) {
    agentWorkflowStore.setState((state) => ({
      ...state,
      isValid,
      validationErrors: errors,
    }));
  },

  /**
   * Copy selected node to clipboard
   * Returns true if copied, false if nothing to copy or start node
   */
  copyNodeToClipboard(): boolean {
    const { selectedNodeId, nodes } = agentWorkflowStore.state;
    if (!selectedNodeId) return false;

    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node || node.type === "start") return false; // Can't copy start node

    agentWorkflowStore.setState((s) => ({
      ...s,
      clipboard: {
        nodeData: structuredClone(node.data),
        nodeType: ensureWorkflowNodeType(node.type),
        copiedAt: Date.now(),
      },
    }));
    return true;
  },

  /**
   * Paste node from clipboard
   * Returns the new node ID, or null if nothing to paste
   */
  pasteNode(): string | null {
    const { clipboard, selectedNodeId, nodes } = agentWorkflowStore.state;
    if (!clipboard) return null;

    // Position: offset from selected node or default
    const sourceNode = nodes.find((n) => n.id === selectedNodeId);
    const position = sourceNode
      ? { x: sourceNode.position.x + 50, y: sourceNode.position.y + 50 }
      : { x: 200, y: 200 };

    this._saveToHistory();

    const id = `${clipboard.nodeType}-${Date.now()}`;
    const newNode: WorkflowCanvasNode = {
      id,
      type: clipboard.nodeType,
      position,
      data: structuredClone(clipboard.nodeData),
      selected: false,
    };

    agentWorkflowStore.setState((s) => ({
      ...s,
      nodes: [...s.nodes, newNode],
      selectedNodeId: id,
      isDirty: true,
    }));

    return id;
  },

  /**
   * Duplicate selected node (copy + paste in one action)
   * Returns the new node ID, or null if nothing to duplicate
   */
  duplicateNode(): string | null {
    const copied = this.copyNodeToClipboard();
    if (!copied) return null;
    return this.pasteNode();
  },

  /**
   * Discard all changes and reset to last saved state
   */
  discardChanges() {
    const { originalNodes, originalEdges, originalSettings, settings } = agentWorkflowStore.state;
    // Restore UI settings from original API settings
    // Note: name, description, status are kept as-is (should store originals for full restore)
    const restoredSettings = settingsFromApi(
      settings.name,
      settings.description,
      settings.status,
      originalSettings
    );

    agentWorkflowStore.setState((s) => ({
      ...s,
      nodes: structuredClone(originalNodes),
      edges: structuredClone(originalEdges),
      settings: restoredSettings,
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: false,
      history: { past: [], future: [] },
    }));
  },

  /**
   * Called when node drag starts - captures state for undo
   */
  startNodeDrag() {
    this._saveToHistory();
  },

  /**
   * Called when node drag ends - no-op (state captured at start)
   */
  endNodeDrag() {
    // Intentionally empty - state was captured at drag start
  },

  /**
   * Update node positions without saving to history
   * Used during drag operations (state captured at drag start)
   */
  updateNodePositions(updates: Map<string, { x: number; y: number }>) {
    agentWorkflowStore.setState((state) => ({
      ...state,
      nodes: state.nodes.map((node) => {
        const newPos = updates.get(node.id);
        return newPos ? { ...node, position: newPos } : node;
      }),
      isDirty: true,
    }));
  },

  /**
   * Open settings dialog
   */
  openSettingsDialog() {
    agentWorkflowStore.setState((s) => ({ ...s, settingsDialogOpen: true }));
  },

  /**
   * Close settings dialog
   */
  closeSettingsDialog() {
    agentWorkflowStore.setState((s) => ({ ...s, settingsDialogOpen: false }));
  },

  /**
   * Toggle auto-layout panel visibility
   */
  toggleAutoLayoutPanel() {
    agentWorkflowStore.setState((s) => ({ ...s, autoLayoutPanelOpen: !s.autoLayoutPanelOpen }));
  },

  /**
   * Close auto-layout panel
   */
  closeAutoLayoutPanel() {
    agentWorkflowStore.setState((s) => ({ ...s, autoLayoutPanelOpen: false }));
  },

  /**
   * Update workflow UI settings
   */
  updateSettings(updates: Partial<WorkflowUISettings>) {
    agentWorkflowStore.setState((s) => ({
      ...s,
      settings: { ...s.settings, ...updates },
      isDirty: true,
    }));
  },

  /**
   * Apply auto-layout to nodes using dagre algorithm
   */
  applyAutoLayout(options: LayoutOptions = {}) {
    this._saveToHistory();

    const { nodes, edges } = agentWorkflowStore.state;

    // Merge with workflow-specific defaults (compact node dimensions)
    const layoutOptions: InternalLayoutOptions = {
      ...DEFAULT_WORKFLOW_LAYOUT_OPTIONS,
      ...options,
    };

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElementsGeneric(
      nodes,
      edges,
      layoutOptions
    );

    agentWorkflowStore.setState((s) => ({
      ...s,
      nodes: layoutedNodes,
      edges: layoutedEdges,
      isDirty: true,
    }));
  },

  // ===========================================================================
  // LAYOUT PREVIEW ACTIONS (live preview in dialog)
  // ===========================================================================

  /**
   * Start layout preview mode - saves current state for potential restore
   */
  startLayoutPreview() {
    const { nodes, edges } = agentWorkflowStore.state;
    agentWorkflowStore.setState((s) => ({
      ...s,
      layoutPreviewSnapshot: {
        nodes: structuredClone(nodes),
        edges: structuredClone(edges),
      },
    }));
  },

  /**
   * Preview layout changes without saving to history (sync Dagre version)
   * Called on every slider/direction change for live preview
   */
  previewLayout(options: LayoutOptions = {}) {
    const { layoutPreviewSnapshot } = agentWorkflowStore.state;
    if (!layoutPreviewSnapshot) return;

    // Always apply layout from the original snapshot, not current state
    // This prevents cumulative layout drift
    const layoutOptions: InternalLayoutOptions = {
      ...DEFAULT_WORKFLOW_LAYOUT_OPTIONS,
      ...options,
    };

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElementsGeneric(
      layoutPreviewSnapshot.nodes,
      layoutPreviewSnapshot.edges,
      layoutOptions
    );

    agentWorkflowStore.setState((s) => ({
      ...s,
      nodes: layoutedNodes,
      edges: layoutedEdges,
    }));
  },

  /**
   * Preview layout changes using async ELK algorithm.
   * Provides superior layout quality with orthogonal edge routing.
   * Called with debouncing from the canvas for smooth preview.
   *
   * @param options - Layout options (direction, spacing, alignment)
   * @param nodeDimensions - Optional map of node IDs to measured dimensions
   */
  async previewLayoutAsync(
    options: LayoutOptions = {},
    nodeDimensions?: Map<string, NodeDimensions>
  ) {
    const { layoutPreviewSnapshot } = agentWorkflowStore.state;
    if (!layoutPreviewSnapshot) return;

    // Use ELK with proper node dimensions
    const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
      layoutPreviewSnapshot.nodes,
      layoutPreviewSnapshot.edges,
      { ...DEFAULT_WORKFLOW_LAYOUT_OPTIONS, ...options },
      nodeDimensions
    );

    agentWorkflowStore.setState((s) => ({
      ...s,
      nodes: layoutedNodes,
      edges: layoutedEdges,
    }));
  },

  /**
   * Cancel layout preview - restores original state from snapshot
   */
  cancelLayoutPreview() {
    const { layoutPreviewSnapshot } = agentWorkflowStore.state;
    if (!layoutPreviewSnapshot) return;

    agentWorkflowStore.setState((s) => ({
      ...s,
      nodes: layoutPreviewSnapshot.nodes,
      edges: layoutPreviewSnapshot.edges,
      layoutPreviewSnapshot: null,
    }));
  },

  /**
   * Commit layout preview - saves snapshot to history and clears preview state
   * This allows undo to restore to pre-layout state
   * @param options - Layout options to save for next dialog open
   */
  commitLayoutPreview(options?: LayoutOptions) {
    const { layoutPreviewSnapshot, history } = agentWorkflowStore.state;
    if (!layoutPreviewSnapshot) return;

    // Save the ORIGINAL state (snapshot) to history, so undo restores to before preview
    agentWorkflowStore.setState((s) => ({
      ...s,
      history: {
        past: [...history.past.slice(-49), layoutPreviewSnapshot],
        future: [],
      },
      layoutPreviewSnapshot: null,
      layoutSettings: options ?? s.layoutSettings, // Remember the applied settings
      isDirty: true,
    }));
  },

  /**
   * Commit layout preview with ELK - applies async ELK layout and commits
   * Uses measured node dimensions for accurate layout calculations.
   * @param options - Layout options
   * @param nodeDimensions - Map of node IDs to measured dimensions
   */
  async commitLayoutPreviewAsync(
    options: LayoutOptions = {},
    nodeDimensions?: Map<string, NodeDimensions>
  ) {
    const { layoutPreviewSnapshot, history } = agentWorkflowStore.state;
    if (!layoutPreviewSnapshot) return;

    // Apply ELK layout to get final positions
    const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
      layoutPreviewSnapshot.nodes,
      layoutPreviewSnapshot.edges,
      { ...DEFAULT_WORKFLOW_LAYOUT_OPTIONS, ...options },
      nodeDimensions
    );

    // Save the ORIGINAL state (snapshot) to history, so undo restores to before layout
    // Re-snapshot the NEW state so subsequent applies work from new positions
    agentWorkflowStore.setState((s) => ({
      ...s,
      nodes: layoutedNodes,
      edges: layoutedEdges,
      history: {
        past: [...history.past.slice(-49), layoutPreviewSnapshot],
        future: [],
      },
      layoutPreviewSnapshot: { nodes: layoutedNodes, edges: layoutedEdges },
      layoutSettings: options,
      isDirty: true,
    }));
  },
};

// =============================================================================
// HELPERS
// =============================================================================

// Re-export node factory for convenience
export {
  getDefaultNodeData,
  createNode,
  generateNodeId,
  createNodeWithId,
} from "@/features/nodes/workflow/lib/node-factory";
