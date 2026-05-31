/**
 * Journey Nodes Store
 *
 * Purpose: Manages journey nodes and edges data with CRUD operations
 *
 * Responsibilities:
 * - Store current journey's nodes/edges in memory
 * - Node/edge CRUD operations (add, update, delete)
 * - ID generation for new nodes/edges
 * - Default node data creation
 *
 * Boundaries:
 * - Does NOT manage UI state (see editor-ui-store)
 * - Does NOT manage version history (see version-store)
 * - Focuses on data operations only
 */
import { createNode } from "@/features/nodes/journey/config/defaults";
import { EDGE_CONNECTION_STYLES } from "@/features/nodes/journey/config/node-theme";
import type { EdgeType, JourneyConfig, JourneyEdge, JourneyNode, JourneyNodeWithMetadata, NodeType } from "@/features/nodes/journey/react-flow-types";
import { EdgeTypeEnum } from "@/features/nodes/journey/react-flow-types";
import { createEdge, type ManagedEdgeOptions } from "@/features/nodes/journey/utils/edge-factory";
import { getLayoutedElements, getLayoutedElementsSync } from "@/features/journey/builder/lib/layout";
import type { NodeDimensions } from "@/features/journey/builder/lib/node-dimensions";
import { generatePluginEdges } from "@/features/nodes/journey/plugins/utils/generate-plugin-edges";
import type { LayoutOptions } from "@/shared/lib/ui/layout";
import type {
  ButtonConfig,
  FollowUpPluginData,
  PluginNode,
  PluginType,
} from "@journey/schemas";
import { parsePluginId, getNodePlugins, pluginCompatibilityRegistry } from "@journey/schemas";
import { Store } from "@tanstack/react-store";
import { storeEventBus } from "./store-event-bus";
import { pluginRegistry } from "@/features/nodes/journey/plugins";
import { buildPluginNode } from "@/features/nodes/journey/plugins/utils/derive-plugin-nodes";

interface HistoryEntry {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
}

export interface JourneyNodesStoreState {
  journeyId: string | null;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  // Original data for discard/restore functionality
  originalNodes: JourneyNode[];
  originalEdges: JourneyEdge[];
  // Undo history
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  // Layout preview state
  layoutPreviewSnapshot: { nodes: JourneyNode[]; edges: JourneyEdge[] } | null;
  layoutSettings: LayoutOptions | null;
  // Auto layout panel visibility
  autoLayoutPanelOpen: boolean;
}

const MAX_UNDO_HISTORY = 50;

const initialState: JourneyNodesStoreState = {
  journeyId: null,
  nodes: [],
  edges: [],
  originalNodes: [],
  originalEdges: [],
  undoStack: [],
  redoStack: [],
  layoutPreviewSnapshot: null,
  layoutSettings: null,
  autoLayoutPanelOpen: false,
};

// =============================================================================
// HMR-SAFE STORE CREATION
// =============================================================================
// During development, hot module replacement creates new store instances.
// Without this pattern, React components would remain subscribed to old
// instances, breaking reactivity.

declare global {
   
  var __journeyNodesStore: Store<JourneyNodesStoreState> | undefined;
}

function getOrCreateStore(): Store<JourneyNodesStoreState> {
  if (typeof globalThis.__journeyNodesStore !== "undefined") {
    return globalThis.__journeyNodesStore;
  }
  const store = new Store(initialState);
  if (import.meta.env.DEV) {
    globalThis.__journeyNodesStore = store;
  }
  return store;
}

export const journeyNodesStore = getOrCreateStore();

// Helper to push current state to undo stack
const pushToUndoStack = () => {
  const state = journeyNodesStore.state;
  const historyEntry: HistoryEntry = {
    nodes: structuredClone(state.nodes),
    edges: structuredClone(state.edges),
  };

  journeyNodesStore.setState((s) => ({
    ...s,
    undoStack: [...s.undoStack.slice(-MAX_UNDO_HISTORY + 1), historyEntry],
    redoStack: [], // Clear redo stack on new action
  }));
};

// Actions
export const journeyNodesActions = {
  setJourneyId: (id: string | null) => {
    journeyNodesStore.setState((state) => ({
      ...state,
      journeyId: id,
    }));
  },

  setNodes: (nodes: JourneyNode[]) => {
    journeyNodesStore.setState((state) => ({
      ...state,
      nodes,
    }));
  },

  setEdges: (edges: JourneyEdge[]) => {
    journeyNodesStore.setState((state) => ({
      ...state,
      edges,
    }));
  },

  /**
   * Set current journey data (nodes and edges).
   * Plugins are embedded in node.data.plugins - no separate migration needed.
   *
   * @param data - Journey configuration
   * @param _markAsClean - Unused in store, but kept for API consistency with store-actions.
   *                       The store-actions layer handles pendingChanges state.
   */
  setCurrentData: (data: JourneyConfig, _markAsClean = true) => {
    const journeyId = journeyNodesStore.state.journeyId;
    const nodes = data.nodes as JourneyNode[];
    const jsonEdges = data.edges as JourneyEdge[];

    // Normalize edges: ensure all have explicit sourceHandle
    // Edges without sourceHandle default to "output" (bottom center handle)
    // This prevents React Flow issues when nodes have multiple source handles
    const normalizedJsonEdges = jsonEdges.map((edge) => ({
      ...edge,
      sourceHandle: edge.sourceHandle ?? "output",
    }));

    // Generate plugin edges from embedded node.data.plugins[]
    // Plugin edges (button targets, exit paths) are not stored in JSON but derived from plugin data
    const pluginEdges = generatePluginEdges(nodes);
    const edges = [...normalizedJsonEdges, ...pluginEdges];

    journeyNodesStore.setState((state) => ({
      ...state,
      nodes,
      edges,
      // Store original data for discard/restore functionality
      originalNodes: nodes,
      originalEdges: edges,
      // Clear undo/redo stacks when loading new data
      undoStack: [],
      redoStack: [],
    }));

    storeEventBus.emit({ type: "web:journey:loaded", payload: { journeyId: journeyId || "", data: { nodes: nodes as JourneyNodeWithMetadata[], edges } } });
  },

  discardChanges: () => {
    const state = journeyNodesStore.state;
    journeyNodesStore.setState((s) => ({
      ...s,
      nodes: state.originalNodes,
      edges: state.originalEdges,
      undoStack: [],
      redoStack: [],
    }));
    // Note: setPendingChanges and clearSelection should be handled by orchestration layer (store-actions.ts)
  },

  /**
   * Update baseline snapshots to current state.
   * Called after successful save to ensure discardChanges reverts to
   * the last saved state, not the initial load state.
   *
   * This fixes the bug where users lose saved changes when clicking "Discard"
   * after making additional changes post-save.
   */
  updateBaseline: () => {
    journeyNodesStore.setState((s) => ({
      ...s,
      originalNodes: structuredClone(s.nodes),
      originalEdges: structuredClone(s.edges),
    }));
    storeEventBus.emit({ type: "journey:baselineUpdated", payload: {} });
  },

  addNode: (type: NodeType, position?: { x: number; y: number }): JourneyNodeWithMetadata => {
    pushToUndoStack();
    const state = journeyNodesStore.state;
    const newNode = createNode(type, state.nodes, position);

    journeyNodesStore.setState((s) => ({
      ...s,
      nodes: [...s.nodes, newNode],
    }));

    storeEventBus.emit({ type: "web:node:added", payload: { node: newNode } });

    return newNode;
  },

  updateNode: (nodeId: string, updates: Partial<JourneyNode>) => {
    pushToUndoStack();
    journeyNodesStore.setState((state) => {
      const updatedNodes = state.nodes.map((node) => {
        if (node.id === nodeId) {
          const updated = { ...node, ...updates } as JourneyNodeWithMetadata;
          if (updates.data) {
            // Merge data and remove undefined fields (for field removal)
            const mergedData = { ...node.data, ...updates.data };
            // Remove any fields set to undefined (explicit field removal)
            Object.keys(mergedData).forEach((key) => {
              if (mergedData[key] === undefined) {
                delete mergedData[key];
              }
            });
            updated.data = mergedData;
          }
          // Merge metadata: existing + updates + fresh timestamp
          const nodeWithMeta = node as JourneyNodeWithMetadata;
          const updatesWithMeta = updates as Partial<JourneyNodeWithMetadata>;
          if (updatesWithMeta.metadata || nodeWithMeta.metadata) {
            updated.metadata = {
              ...nodeWithMeta.metadata,
              ...updatesWithMeta.metadata,
              updatedAt: new Date().toISOString(),
            };
          }
          return updated;
        }
        return node;
      });

      return {
        ...state,
        nodes: updatedNodes,
      };
    });

    storeEventBus.emit({ type: "node:updated", payload: { nodeId, updates: updates as Record<string, unknown> } });
  },

  deleteNode: (nodeId: string) => {
    pushToUndoStack();

    journeyNodesStore.setState((state) => {
      const updatedNodes = state.nodes.filter((n) => n.id !== nodeId);
      const updatedEdges = state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

      // Clean up orphaned button references in remaining nodes
      // When a node is deleted, any buttons in other nodes that target it need to be cleared
      const cleanedNodes = updatedNodes.map((node) => {
        let nodeData = node.data;
        let modified = false;

        // Clean up regular button references
        if ("buttons" in nodeData && Array.isArray(nodeData.buttons)) {
          const buttons = nodeData.buttons as ButtonConfig[];
          const hasOrphanedRef = buttons.some((btn) => btn.targetNodeId === nodeId);

          if (hasOrphanedRef) {
            const cleanedButtons = buttons.map((btn) => {
              if (btn.targetNodeId === nodeId) {
                return { ...btn, targetNodeId: undefined };
              }
              return btn;
            });
            nodeData = { ...nodeData, buttons: cleanedButtons };
            modified = true;
          }
        }

        // Clean up plugin node references (for follow-up plugins)
        // Check if nodeData has pluginType property and is a follow-up plugin
        // Note: We check pluginType directly here since nodeData is JourneyNode["data"], not PluginData
        if ("pluginType" in nodeData && (nodeData as unknown as { pluginType: string }).pluginType === "followup") {
          const pluginData = nodeData as unknown as FollowUpPluginData;
          let pluginModified = false;
          let cleanedPlugin = { ...pluginData };

          // Clean exitPath if it references the deleted node
          if (pluginData.exitPath?.nodeId === nodeId) {
            const { exitPath: _exitPath, ...rest } = cleanedPlugin;
            cleanedPlugin = rest as FollowUpPluginData;
            pluginModified = true;
          }

          // Clean step button targetNodeIds
          if (pluginData.steps && pluginData.steps.length > 0) {
            const cleanedSteps = pluginData.steps.map((step) => {
              if (!step.buttons || step.buttons.length === 0) {
                return step;
              }

              const hasOrphanedButtonRef = step.buttons.some((btn) => btn.targetNodeId === nodeId);
              if (!hasOrphanedButtonRef) {
                return step;
              }

              pluginModified = true;
              return {
                ...step,
                buttons: step.buttons.map((btn) =>
                  btn.targetNodeId === nodeId ? { ...btn, targetNodeId: "" } : btn
                ),
              };
            });

            if (pluginModified) {
              cleanedPlugin = { ...cleanedPlugin, steps: cleanedSteps };
            }
          }

          if (pluginModified) {
            nodeData = cleanedPlugin as unknown as typeof nodeData;
            modified = true;
          }
        }

        return modified ? { ...node, data: nodeData } : node;
      });

      return {
        ...state,
        nodes: cleanedNodes,
        edges: updatedEdges,
      };
    });

    storeEventBus.emit({ type: "node:deleted", payload: { nodeId } });
  },

  addEdge: (source: string, target: string, label?: string, edgeType: EdgeType = EdgeTypeEnum.DEFAULT, sourceHandle?: string): JourneyEdge => {
    pushToUndoStack();
    const state = journeyNodesStore.state;
    const newEdge = createEdge(source, target, state.edges, label, edgeType, sourceHandle);

    journeyNodesStore.setState((s) => ({
      ...s,
      edges: [...s.edges, newEdge],
    }));

    storeEventBus.emit({ type: "web:edge:added", payload: { edge: newEdge } });

    return newEdge;
  },

  /**
   * Add a managed edge (auto-created from button/followup targets)
   * These edges are stored in the journey and visible to the engine,
   * but protected from manual editing in the UI.
   */
  addManagedEdge: (
    source: string,
    target: string,
    sourceHandle: string,
    options: ManagedEdgeOptions
  ): JourneyEdge => {
    pushToUndoStack();
    const state = journeyNodesStore.state;
    const newEdge = createEdge(source, target, state.edges, undefined, EdgeTypeEnum.DEFAULT, sourceHandle, options);

    journeyNodesStore.setState((s) => ({
      ...s,
      edges: [...s.edges, newEdge],
    }));

    storeEventBus.emit({ type: "web:edge:added", payload: { edge: newEdge } });

    return newEdge;
  },

  updateEdge: (edgeId: string, updates: Partial<JourneyEdge>) => {
    pushToUndoStack();
    journeyNodesStore.setState((state) => {
      const updatedEdges = state.edges.map((edge) => {
        if (edge.id === edgeId) {
          const updated = { ...edge, ...updates };
          // Update style if edgeType changed
          if (updates.edgeType && updates.edgeType !== edge.edgeType) {
            updated.style = EDGE_CONNECTION_STYLES[updates.edgeType];
            // Animation controlled by UI settings (edgeAnimations in ui-store)
            updated.animated = false;
          }
          return updated;
        }
        return edge;
      });

      return {
        ...state,
        edges: updatedEdges,
      };
    });

    storeEventBus.emit({ type: "edge:updated", payload: { edgeId, updates: updates as Record<string, unknown> } });
  },

  deleteEdge: (edgeId: string) => {
    pushToUndoStack();
    journeyNodesStore.setState((state) => ({
      ...state,
      edges: state.edges.filter((e) => e.id !== edgeId),
    }));

    storeEventBus.emit({ type: "edge:deleted", payload: { edgeId } });
  },

  /**
   * Start node drag - captures current state to undo stack ONCE before drag begins
   * Called when user starts dragging a node (onNodeDragStart)
   */
  startNodeDrag: () => {
    pushToUndoStack();
  },

  /**
   * End node drag - no-op, the state is already updated during drag
   * The undo stack was pushed at drag start, so we don't need to do anything here
   */
  endNodeDrag: () => {
    // Intentionally empty - undo state was captured at drag start
    // Position updates during drag don't create undo entries
  },

  /**
   * Update node positions WITHOUT pushing to undo stack
   * Used during drag operations to avoid creating undo entries for every frame
   * @param updates - Map of nodeId to new position
   */
  updateNodePositions: (updates: Map<string, { x: number; y: number }>) => {
    journeyNodesStore.setState((state) => {
      const updatedNodes = state.nodes.map((node) => {
        const newPosition = updates.get(node.id);
        if (newPosition) {
          return { ...node, position: newPosition };
        }
        return node;
      });

      return {
        ...state,
        nodes: updatedNodes,
      };
    });

    // Emit events for each updated node
    updates.forEach((position, nodeId) => {
      storeEventBus.emit({ type: "node:updated", payload: { nodeId, updates: { position } } });
    });
  },

  /**
   * Apply auto-layout to all nodes using ELK algorithm (async).
   * This is the preferred method when you have access to measured node dimensions.
   *
   * @param options - Layout options (direction, spacing)
   * @param nodeDimensions - Optional map of node IDs to measured dimensions
   */
  applyAutoLayout: async (options: LayoutOptions = {}, nodeDimensions?: Map<string, NodeDimensions>) => {
    pushToUndoStack();
    const state = journeyNodesStore.state;
    const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
      state.nodes,
      state.edges,
      options,
      nodeDimensions
    );

    journeyNodesStore.setState((s) => ({
      ...s,
      nodes: layoutedNodes,
      edges: layoutedEdges,
    }));

    storeEventBus.emit({ type: "journey:layoutApplied", payload: { options } });
  },

  /**
   * Apply auto-layout synchronously using Dagre algorithm.
   * Use this for fast preview during slider adjustments.
   *
   * @param options - Layout options (direction, spacing)
   */
  applyAutoLayoutSync: (options: LayoutOptions = {}) => {
    pushToUndoStack();
    const state = journeyNodesStore.state;
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElementsSync(state.nodes, state.edges, options);

    journeyNodesStore.setState((s) => ({
      ...s,
      nodes: layoutedNodes,
      edges: layoutedEdges,
    }));

    storeEventBus.emit({ type: "journey:layoutApplied", payload: { options } });
  },

  // ===========================================================================
  // LAYOUT PREVIEW ACTIONS (live preview in dialog)
  // ===========================================================================

  /**
   * Start layout preview mode - saves current state for potential restore
   */
  startLayoutPreview: () => {
    const { nodes, edges } = journeyNodesStore.state;
    journeyNodesStore.setState((s) => ({
      ...s,
      layoutPreviewSnapshot: {
        nodes: structuredClone(nodes),
        edges: structuredClone(edges),
      },
    }));
  },

  /**
   * Preview layout changes without saving to history (sync for fast slider response).
   * Called on every slider/direction change for live preview.
   * Uses Dagre for fast sync preview - final apply will use ELK for best quality.
   */
  previewLayout: (options: LayoutOptions = {}) => {
    const { layoutPreviewSnapshot } = journeyNodesStore.state;
    if (!layoutPreviewSnapshot) return;

    // Always apply layout from the original snapshot, not current state
    // This prevents cumulative layout drift
    // Uses sync Dagre for fast slider response
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElementsSync(
      layoutPreviewSnapshot.nodes,
      layoutPreviewSnapshot.edges,
      options
    );

    journeyNodesStore.setState((s) => ({
      ...s,
      nodes: layoutedNodes,
      edges: layoutedEdges,
    }));
  },

  /**
   * Preview layout with ELK (async, for final preview before apply).
   * Use this when you want the highest quality preview with measured dimensions.
   */
  previewLayoutAsync: async (options: LayoutOptions = {}, nodeDimensions?: Map<string, NodeDimensions>) => {
    const { layoutPreviewSnapshot } = journeyNodesStore.state;
    if (!layoutPreviewSnapshot) return;

    const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
      layoutPreviewSnapshot.nodes,
      layoutPreviewSnapshot.edges,
      options,
      nodeDimensions
    );

    journeyNodesStore.setState((s) => ({
      ...s,
      nodes: layoutedNodes,
      edges: layoutedEdges,
    }));
  },

  /**
   * Cancel layout preview - restores original state from snapshot
   */
  cancelLayoutPreview: () => {
    const { layoutPreviewSnapshot } = journeyNodesStore.state;
    if (!layoutPreviewSnapshot) return;

    journeyNodesStore.setState((s) => ({
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
  commitLayoutPreview: (options?: LayoutOptions) => {
    const { layoutPreviewSnapshot, undoStack } = journeyNodesStore.state;
    if (!layoutPreviewSnapshot) return;

    // Save the ORIGINAL state (snapshot) to history, so undo restores to before preview
    // Re-snapshot current state so subsequent applies work from new positions
    journeyNodesStore.setState((s) => ({
      ...s,
      undoStack: [...undoStack.slice(-MAX_UNDO_HISTORY + 1), layoutPreviewSnapshot],
      redoStack: [],
      layoutPreviewSnapshot: { nodes: s.nodes, edges: s.edges },
      layoutSettings: options ?? s.layoutSettings, // Remember the applied settings
    }));

    storeEventBus.emit({ type: "journey:layoutApplied", payload: { options: options ?? {} } });
  },

  /** Toggle auto layout panel visibility */
  toggleAutoLayoutPanel: () => {
    journeyNodesStore.setState((s) => ({
      ...s,
      autoLayoutPanelOpen: !s.autoLayoutPanelOpen,
    }));
  },

  /** Close auto layout panel */
  closeAutoLayoutPanel: () => {
    journeyNodesStore.setState((s) => ({
      ...s,
      autoLayoutPanelOpen: false,
    }));
  },

  /**
   * Add a plugin to a parent node (embedded in node.data.plugins)
   * @param parentNodeId - ID of the node to attach the plugin to
   * @param pluginType - Type of plugin to add (e.g., "followup")
   * @returns Synthetic PluginNode wrapper, or null if parent node not found
   */
  addPlugin: (parentNodeId: string, pluginType: PluginType): PluginNode | null => {
    pushToUndoStack();
    const state = journeyNodesStore.state;

    // Verify parent node exists
    const parentNode = state.nodes.find((n) => n.id === parentNodeId);
    if (!parentNode) return null;

    if (!pluginCompatibilityRegistry.isCompatible(pluginType, parentNode.data.type)) {
      return null;
    }

    // Get existing embedded plugins
    const existingPlugins = getNodePlugins(parentNode.data);
    const existingOfType = existingPlugins.filter((plugin) => plugin.pluginType === pluginType);

    // Check if this node already has a plugin of this type
    const existingIndex = existingPlugins.findIndex((plugin) => plugin.pluginType === pluginType);
    const maxInstances = pluginCompatibilityRegistry.getCompatibility(pluginType)?.maxInstancesPerNode ?? 0;

    if ((maxInstances === 1 || maxInstances === 0) && existingIndex >= 0) {
      // Return existing plugin as synthetic PluginNode
      return buildPluginNode(parentNode, existingIndex, existingPlugins[existingIndex]);
    }

    if (maxInstances > 0 && existingOfType.length >= maxInstances) {
      return null;
    }

    const descriptor = pluginRegistry.get(pluginType);
    if (!descriptor) {
      return null;
    }

    const pluginData = descriptor.createDefaultData();

    // Add plugin to node.data.plugins
    const newPluginIndex = existingPlugins.length;
    journeyNodesStore.setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) =>
        n.id === parentNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                plugins: [...existingPlugins, pluginData],
              },
            }
          : n
      ),
    }));

    // Create synthetic PluginNode for return value and event
    const syntheticPlugin = buildPluginNode(parentNode, newPluginIndex, pluginData);

    storeEventBus.emit({ type: "plugin:added", payload: { plugin: syntheticPlugin } });

    return syntheticPlugin;
  },

  /**
   * Update a plugin's data (embedded in node.data.plugins)
   * @param pluginId - Synthetic plugin ID ({parentNodeId}-plugin-{index})
   * @param updates - Partial updates to apply to plugin data
   */
  updatePlugin: (pluginId: string, updates: Partial<PluginNode["data"]>): void => {
    const parsed = parsePluginId(pluginId);
    if (!parsed) return;

    const { parentNodeId, pluginIndex } = parsed;

    pushToUndoStack();
    journeyNodesStore.setState((state) => ({
      ...state,
      nodes: state.nodes.map((n) => {
        if (n.id !== parentNodeId) return n;

        const plugins = getNodePlugins(n.data);
        if (pluginIndex >= plugins.length) return n;

        return {
          ...n,
          data: {
            ...n.data,
            plugins: plugins.map((p, i) => (i === pluginIndex ? { ...p, ...updates } : p)),
          },
        };
      }),
    }));
    storeEventBus.emit({ type: "plugin:updated", payload: { pluginId, updates } });
  },

  /**
   * Delete a plugin and clean up all associated edges
   * @param pluginId - Synthetic plugin ID ({parentNodeId}-plugin-{index})
   *
   * Plugin edges follow deterministic ID patterns:
   * - Connection: plugin::{parentId}::{pluginId}
   * - Button: plugin-btn::{pluginId}::{stepIdx}::{buttonId}
   * - Exit: plugin-exit::{pluginId}
   */
  deletePlugin: (pluginId: string): void => {
    const parsed = parsePluginId(pluginId);
    if (!parsed) return;

    const { parentNodeId, pluginIndex } = parsed;

    pushToUndoStack();

    journeyNodesStore.setState((state) => ({
      ...state,
      nodes: state.nodes.map((n) => {
        if (n.id !== parentNodeId) return n;

        const plugins = getNodePlugins(n.data);
        if (pluginIndex >= plugins.length) return n;

        return {
          ...n,
          data: {
            ...n.data,
            plugins: plugins.filter((_, i) => i !== pluginIndex),
          },
        };
      }),
      // Clean up ALL edges associated with this plugin
      edges: state.edges.filter((e) => {
        // Connection edge: plugin::{parentId}::{pluginId}
        if (e.id === `plugin::${parentNodeId}::${pluginId}`) return false;
        // Button edges: plugin-btn::{pluginId}::*
        if (e.id.startsWith(`plugin-btn::${pluginId}::`)) return false;
        // Exit edge: plugin-exit::{pluginId}
        if (e.id === `plugin-exit::${pluginId}`) return false;
        return true;
      }),
    }));
    storeEventBus.emit({ type: "plugin:deleted", payload: { pluginId } });
  },

  getCurrentData: (): JourneyConfig | null => {
    const state = journeyNodesStore.state;
    return {
      nodes: state.nodes.map((n) => {
        const nodeWithMeta = n as JourneyNodeWithMetadata;
        return {
          ...n,
          metadata: nodeWithMeta.metadata || {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: "1.0.0",
            status: "active",
          },
        } as JourneyNodeWithMetadata;
      }),
      edges: state.edges,
    };
  },

  // Undo/Redo
  undo: (): boolean => {
    const state = journeyNodesStore.state;
    if (state.undoStack.length === 0) return false;

    const previousState = state.undoStack[state.undoStack.length - 1];
    const currentState: HistoryEntry = {
      nodes: structuredClone(state.nodes),
      edges: structuredClone(state.edges),
    };

    journeyNodesStore.setState((s) => ({
      ...s,
      nodes: previousState.nodes,
      edges: previousState.edges,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, currentState],
    }));
    // Note: setPendingChanges and clearSelection should be handled by orchestration layer (store-actions.ts)
    return true;
  },

  redo: (): boolean => {
    const state = journeyNodesStore.state;
    if (state.redoStack.length === 0) return false;

    const nextState = state.redoStack[state.redoStack.length - 1];
    const currentState: HistoryEntry = {
      nodes: structuredClone(state.nodes),
      edges: structuredClone(state.edges),
    };

    journeyNodesStore.setState((s) => ({
      ...s,
      nodes: nextState.nodes,
      edges: nextState.edges,
      undoStack: [...s.undoStack, currentState],
      redoStack: s.redoStack.slice(0, -1),
    }));
    // Note: setPendingChanges and clearSelection should be handled by orchestration layer (store-actions.ts)
    return true;
  },

  canUndo: (): boolean => {
    return journeyNodesStore.state.undoStack.length > 0;
  },

  canRedo: (): boolean => {
    return journeyNodesStore.state.redoStack.length > 0;
  },

  /**
   * Reset store to initial state (used on logout/user change)
   */
  reset: () => {
    journeyNodesStore.setState(() => initialState);
    storeEventBus.emit({ type: "journey:reset", payload: {} });
  },
};

// =============================================================================
// EVENT BUS SUBSCRIPTIONS (with cleanup for HMR)
// =============================================================================

const journeyNodesCleanupFunctions: (() => void)[] = [];

function setupJourneyNodesSubscriptions(): void {
  // Clear any existing subscriptions first (HMR safety)
  cleanupJourneyNodesSubscriptions();

  // Update baseline when save completes (event-driven decoupling from save-manager)
  journeyNodesCleanupFunctions.push(
    storeEventBus.on("saveManager:saveCompleted", () => {
      journeyNodesActions.updateBaseline();
    })
  );
}

export function cleanupJourneyNodesSubscriptions(): void {
  journeyNodesCleanupFunctions.forEach((fn) => fn());
  journeyNodesCleanupFunctions.length = 0;
}

// Initialize subscriptions
setupJourneyNodesSubscriptions();

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupJourneyNodesSubscriptions();
  });
}
