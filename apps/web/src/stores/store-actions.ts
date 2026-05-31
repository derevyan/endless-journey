/**
 * Cross-Store Actions
 *
 * Purpose: Provides unified actions that coordinate between multiple stores
 *
 * This layer reduces direct coupling between stores by centralizing
 * operations that need to update multiple stores simultaneously.
 */

import { createLogger } from "@journey/logger";
import type { ButtonConfig, PluginData } from "@journey/schemas";
import { NodeTypes, isFollowUpPluginData, parsePluginId, getNodePlugins } from "@journey/schemas";
import type { QueryClient } from "@tanstack/react-query";
import { notify } from "@/shared/lib/ui/notify";

import { customJourneyActions } from "@/features/journey/builder/store";
import { builderActions } from "@/features/mindstate/stores";
import { simulatorActions } from "@/features/journey/simulator/store";
import { saveManagerActions, setSaveManagerQueryClient } from "./save-manager-store";
import { formatDurationVerbose } from "@/features/nodes/journey/logic/wait";
import type { EdgeType, JourneyConfig, JourneyEdge, JourneyNode, JourneyNodeWithMetadata, NodeType } from "@/features/nodes/journey/react-flow-types";
// JourneyNode["data"] is used for type assertions when updating plugin nodes
import { EdgeTypeEnum } from "@/features/nodes/journey/react-flow-types";
import { ManagedEdgeId } from "@/features/nodes/journey/utils/edge-identity";
import {
  PluginButtonEdgeId,
  PluginExitEdgeId,
} from "@/features/nodes/journey/utils/plugin-edge-identity";
import { PLUGIN_EDGE_STYLES } from "@/features/nodes/journey/config/node-theme";
import { journeyNodesActions, journeyNodesStore } from "./journey-nodes-store";
import { uiActions, uiStore } from "./ui-store";
import { userActions } from "./user-store";
import { versionActions } from "./version-store";

// =============================================================================
// EMBEDDED PLUGIN HELPERS
// =============================================================================

// parsePluginId is imported from @journey/schemas

/**
 * Find embedded plugin data by synthetic plugin ID
 * Returns the plugin data if found, or null if not
 */
function findEmbeddedPlugin(pluginId: string): PluginData | null {
  const parsed = parsePluginId(pluginId);
  if (!parsed) return null;

  const { parentNodeId, pluginIndex } = parsed;
  const node = journeyNodesStore.state.nodes.find((n) => n.id === parentNodeId);
  if (!node) return null;

  const plugins = getNodePlugins(node.data);
  return plugins[pluginIndex] ?? null;
}

/**
 * Set query client for cache invalidation in SaveManager
 */
export function setQueryClient(client: QueryClient) {
  setSaveManagerQueryClient(client);
}

const log = createLogger("store-actions");

/**
 * Set journey data and sync editor UI state.
 *
 * @param data - The journey configuration to load
 * @param markAsClean - When true, marks the journey as having no pending changes
 *                      (clean state - typically when loading from server).
 *                      When false, marks the journey as having unsaved changes
 *                      (dirty state - typically when applying local modifications).
 *                      Defaults to true.
 */
export function setJourneyData(data: JourneyConfig, markAsClean = true) {
  journeyNodesActions.setCurrentData(data, markAsClean);
  uiActions.setPendingChanges(!markAsClean);
  if (markAsClean) {
    uiActions.clearSelection();
  }
}

/**
 * Update a node and sync timer edge labels when node timer changes
 * Note: Selection clearing and pending changes are handled via event bus subscriptions
 */
export function updateNodeWithSync(nodeId: string, updates: Partial<JourneyNode>) {
  journeyNodesActions.updateNode(nodeId, updates);

  // If the node has a timer update, sync connected timer edges' labels
  if (updates.data && "timer" in updates.data) {
    const timer = updates.data.timer as { seconds: number } | undefined;
    const edges = journeyNodesStore.state.edges;

    // Find all timer edges from this node
    const timerEdges = edges.filter((edge) => edge.source === nodeId && edge.edgeType === EdgeTypeEnum.TIMER);

    // Update each timer edge's label to match the new timer value
    for (const edge of timerEdges) {
      const newLabel = timer?.seconds ? formatDurationVerbose(timer.seconds) : undefined;
      if (newLabel !== edge.label) {
        journeyNodesActions.updateEdge(edge.id, { label: newLabel });
      }
    }
  }
}

/**
 * Delete a node
 * Note: Selection clearing and pending changes are handled via event bus subscriptions
 */
export function deleteNodeWithSync(nodeId: string) {
  journeyNodesActions.deleteNode(nodeId);
}

/**
 * Update an edge
 * Note: Selection clearing and pending changes are handled via event bus subscriptions
 */
export function updateEdgeWithSync(edgeId: string, updates: Partial<JourneyEdge>) {
  journeyNodesActions.updateEdge(edgeId, updates);
}

/**
 * Clear a button's targetNodeId without deleting its managed edge.
 *
 * Note: This is distinct from the cleanup in journey-nodes-store.deleteNode().
 * - deleteNode() clears ALL references TO a deleted node (comprehensive cleanup)
 * - This function clears ONE specific button's reference when ITS managed edge is deleted
 *
 * @internal Used when the managed edge is being deleted separately
 */
function clearButtonTargetNodeOnly(nodeId: string, buttonId: string): void {
  const node = journeyNodesStore.state.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  if (!("buttons" in node.data) || !Array.isArray(node.data.buttons)) return;

  const buttons = node.data.buttons as ButtonConfig[];
  const updatedButtons = buttons.map((btn) =>
    btn.id === buttonId ? { ...btn, targetNodeId: undefined } : btn
  );

  journeyNodesActions.updateNode(nodeId, {
    data: { ...node.data, buttons: updatedButtons },
  });
}

/**
 * Delete an edge (handles stored edges and managed edges)
 * Note: Selection clearing and pending changes are handled via event bus subscriptions
 *
 * Edge types:
 * - managed-btn::{nodeId}::{buttonId}: Managed edge from button
 * - plugin::{parentId}::{pluginId}: Plugin attachment edge
 * - plugin-btn::{pluginId}::{stepIdx}::{buttonId}: Plugin button edge
 * - plugin-exit::{pluginId}: Plugin exit path edge
 * - Other: Regular stored edges
 */
export function deleteEdgeWithSync(edgeId: string) {
  // Handle managed button edges (stored, but need to clear button targetNodeId)
  if (ManagedEdgeId.is(edgeId)) {
    const parsed = ManagedEdgeId.parse(edgeId);

    if (parsed) {
      const { nodeId, buttonId } = parsed;
      // Clear the button's targetNodeId (without re-deleting the edge)
      clearButtonTargetNodeOnly(nodeId, buttonId);
    } else {
      log.warn({ edgeId }, "storeActions:deleteEdgeWithSync:malformedManagedEdgeId");
    }
    // Delete the managed edge from store
    journeyNodesActions.deleteEdge(edgeId);
    return;
  }

  // Handle plugin button edges
  if (PluginButtonEdgeId.is(edgeId)) {
    const parsed = PluginButtonEdgeId.parse(edgeId);

    if (parsed) {
      const { pluginId, stepIdx, buttonId } = parsed;
      // Clear the button's targetNodeId (without re-deleting the edge)
      clearPluginButtonTargetOnly(pluginId, stepIdx, buttonId);
    } else {
      log.warn({ edgeId }, "storeActions:deleteEdgeWithSync:malformedPluginButtonEdgeId");
    }
    // Delete the managed edge from store
    journeyNodesActions.deleteEdge(edgeId);
    return;
  }

  // Handle plugin exit edges
  if (PluginExitEdgeId.is(edgeId)) {
    const parsed = PluginExitEdgeId.parse(edgeId);

    if (parsed) {
      const { pluginId } = parsed;
      // Clear the exit path (without re-deleting the edge)
      clearPluginExitPathOnly(pluginId);
    } else {
      log.warn({ edgeId }, "storeActions:deleteEdgeWithSync:malformedPluginExitEdgeId");
    }
    // Delete the managed edge from store
    journeyNodesActions.deleteEdge(edgeId);
    return;
  }

  // Regular stored edge - delete from store
  journeyNodesActions.deleteEdge(edgeId);
}

/**
 * Save current journey as a new version.
 * Delegates to SaveManager for centralized save state management with:
 * - Concurrent save prevention
 * - Editor flush before save
 * - Retry logic with exponential backoff
 * - Error recovery queue
 *
 * @param notes - Optional save notes
 * @returns The saved version data or null on failure
 */
export async function saveVersion(notes?: string) {
  const result = await saveManagerActions.saveVersion(notes);
  return result.success ? result : null;
}

/**
 * Load a version and update all related stores (API-only)
 * Coordinates between version-store, journey-nodes-store, and editor-ui-store
 */
export async function loadVersion(versionId: string): Promise<boolean> {
  const versionData = await versionActions.getVersionData(versionId);
  if (!versionData) {
    log.warn({ versionId }, "storeActions:loadVersion:notFound");
    notify.error("Version not found", { description: "Could not load the requested version." });
    return false;
  }

  setJourneyData(versionData.data, true);
  return true;
}

/**
 * Discard changes and restore original data
 */
export function discardChanges() {
  journeyNodesActions.discardChanges();
  uiActions.setPendingChanges(false);
  uiActions.clearSelection();
}

/**
 * Add a node
 * Note: Pending changes are handled via event bus subscriptions
 */
export function addNodeWithSync(type: NodeType, position?: { x: number; y: number }): JourneyNodeWithMetadata {
  return journeyNodesActions.addNode(type, position);
}

/**
 * Add an edge
 * Note: Pending changes are handled via event bus subscriptions
 */
export function addEdgeWithSync(source: string, target: string, label?: string, edgeType?: EdgeType, sourceHandle?: string): JourneyEdge {
  return journeyNodesActions.addEdge(source, target, label, edgeType, sourceHandle);
}

// =============================================================================
// NODE COPY/PASTE/DUPLICATE
// =============================================================================

const PASTE_OFFSET = { x: 50, y: 50 };

/** Options for copy/paste operations */
interface ClipboardOptions {
  /** Suppress toast notifications (for internal use) */
  silent?: boolean;
}

/**
 * Copy the selected node to clipboard
 * @param options - Optional settings (silent mode for internal use)
 * @returns true if node was copied, false if copy failed (no selection, start node, etc.)
 */
export function copySelectedNode(options?: ClipboardOptions): boolean {
  const selectedNodeId = uiStore.state.selectedNodeId;
  if (!selectedNodeId) {
    if (!options?.silent) notify.warning("No node selected");
    return false;
  }

  const nodes = journeyNodesStore.state.nodes;
  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) {
    if (!options?.silent) notify.error("Selected node not found");
    return false;
  }

  // Start nodes cannot be copied (only one allowed per journey)
  if (node.data.type === NodeTypes.START) {
    if (!options?.silent) notify.warning("Start node cannot be copied");
    return false;
  }

  uiActions.copyNodeToClipboard(node);
  if (!options?.silent) notify.success("Node copied to clipboard");
  return true;
}

/**
 * Paste node from clipboard
 * @param options - Optional settings (silent mode for internal use)
 * @returns the new node or null if paste failed
 */
export function pasteNode(options?: ClipboardOptions): JourneyNodeWithMetadata | null {
  const clipboard = uiStore.state.clipboard;
  if (!clipboard) {
    if (!options?.silent) notify.warning("Clipboard is empty");
    return null;
  }

  // Get position based on currently selected node or use default
  const selectedNodeId = uiStore.state.selectedNodeId;
  const nodes = journeyNodesStore.state.nodes;
  const sourceNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  // Calculate paste position: offset from selected node or default position
  const position = sourceNode
    ? { x: sourceNode.position.x + PASTE_OFFSET.x, y: sourceNode.position.y + PASTE_OFFSET.y }
    : { x: 200, y: 200 };

  // Create new node with the copied type (type is in nodeData.type)
  const newNode = journeyNodesActions.addNode(clipboard.nodeData.type as NodeType, position);

  // Clone and clean the node data to avoid orphaned references
  // Type assertion is safe because cleanNodeDataForPaste preserves the data structure
  const cleanedData = cleanNodeDataForPaste(structuredClone(clipboard.nodeData)) as typeof clipboard.nodeData;

  // Update the new node with the cleaned data (preserving new ID and metadata)
  journeyNodesActions.updateNode(newNode.id, {
    data: cleanedData,
  });

  // Select the new node
  const updatedNode = journeyNodesStore.state.nodes.find((n) => n.id === newNode.id);
  if (updatedNode) {
    uiActions.setSelectedNode(updatedNode);
  }

  if (!options?.silent) notify.success("Node pasted");
  return newNode;
}

/**
 * Clean node data for paste to avoid orphaned references
 * Clears button/follow-up references that point to other nodes since
 * the duplicated node won't have corresponding edges.
 */
function cleanNodeDataForPaste(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...data };

  // Clear regular button references (no managed edge for this new node)
  if ("buttons" in cleaned && Array.isArray(cleaned.buttons)) {
    cleaned.buttons = (cleaned.buttons as ButtonConfig[]).map((btn) => ({
      ...btn,
      targetNodeId: undefined,
      edgeId: undefined,
    }));
  }

  return cleaned;
}

/**
 * Quick duplicate: copy and paste in one step
 * Shows a single "Node duplicated" toast instead of two separate toasts.
 * @returns the new node or null if duplication failed
 */
export function duplicateSelectedNode(): JourneyNodeWithMetadata | null {
  // Use silent mode to suppress individual copy/paste toasts
  if (!copySelectedNode({ silent: true })) {
    return null;
  }
  const newNode = pasteNode({ silent: true });
  if (newNode) {
    notify.success("Node duplicated");
  }
  return newNode;
}

/**
 * Undo with UI state coordination
 * Note: Undo/redo restore full state snapshots, so we need manual pending changes tracking
 * Selection is preserved if the selected node/edge still exists after undo
 */
export function undoWithSync(): boolean {
  const result = journeyNodesActions.undo();
  if (result) {
    uiActions.setPendingChanges(true);
    // Only clear selection if the selected node/edge no longer exists
    clearSelectionIfInvalid();
  }
  return result;
}

/**
 * Redo with UI state coordination
 * Note: Undo/redo restore full state snapshots, so we need manual pending changes tracking
 * Selection is preserved if the selected node/edge still exists after redo
 */
export function redoWithSync(): boolean {
  const result = journeyNodesActions.redo();
  if (result) {
    uiActions.setPendingChanges(true);
    // Only clear selection if the selected node/edge no longer exists
    clearSelectionIfInvalid();
  }
  return result;
}

/**
 * Clear selection only if the currently selected node/edge no longer exists
 * Used after undo/redo to preserve node editor state when possible
 */
function clearSelectionIfInvalid(): void {
  const { selectedNodeId, selectedEdgeId } = uiStore.state;
  const { nodes, edges } = journeyNodesStore.state;

  // Check if selected node still exists
  if (selectedNodeId && !nodes.some((n) => n.id === selectedNodeId)) {
    uiActions.clearSelection();
    return;
  }

  // Check if selected edge still exists
  if (selectedEdgeId && !edges.some((e) => e.id === selectedEdgeId)) {
    uiActions.clearSelection();
  }
}

/**
 * Create a new custom journey with initial data
 */
export function createCustomJourney(id: string, name: string, description: string, initialData: JourneyConfig) {
  customJourneyActions.addJourney(id, {
    journey: {
      ...initialData,
      name,
      description,
    },
  });

  // Set as current journey
  setJourneyData(initialData, true);
}

/**
 * Delete a custom journey and clean up related state
 */
export function deleteCustomJourney(journeyId: string) {
  customJourneyActions.deleteJourney(journeyId);
  // Note: Navigation to another journey should be handled by the component
}

/**
 * Reset all stores to their initial state
 * Used when user logs out or switches accounts to prevent data leakage
 */
export function resetAllStores() {
  log.info({}, "storeActions:resetAllStores");

  // Reset all stores to initial state
  uiActions.reset();
  journeyNodesActions.reset();
  simulatorActions.reset();
  versionActions.reset();
  userActions.reset();
  builderActions.reset();

  // Note: customJourneyStore persists to localStorage and is user-independent (local drafts)
  // We don't reset it as it's browser-local, not user-specific
}

// =============================================================================
// BUTTON-EDGE LINKAGE
// =============================================================================

/**
 * Known system handles that are NOT button handles
 */
const SYSTEM_HANDLES = new Set(["timer", "error", "output"]);

/**
 * Check if a sourceHandle is a button handle (not a system handle)
 */
export function isButtonHandle(sourceHandle: string | undefined): boolean {
  if (!sourceHandle) return false;
  return !SYSTEM_HANDLES.has(sourceHandle);
}


/**
 * Set or clear a regular button's target node
 * This method updates the button's targetNodeId AND syncs a managed edge.
 * Managed edges are stored in the journey, visible to the engine, but protected in the UI.
 */
export function setButtonTargetNode(nodeId: string, buttonId: string, targetNodeId: string | undefined): void {
  const node = journeyNodesStore.state.nodes.find((n) => n.id === nodeId);
  if (!node) {
    log.warn({ nodeId, buttonId, targetNodeId }, "storeActions:setButtonTargetNode:nodeNotFound");
    return;
  }

  // Check if node has buttons
  if (!("buttons" in node.data) || !Array.isArray(node.data.buttons)) {
    log.warn({ nodeId, buttonId, targetNodeId }, "storeActions:setButtonTargetNode:noButtons");
    return;
  }

  const buttons = node.data.buttons as ButtonConfig[];
  const buttonIndex = buttons.findIndex((btn) => btn.id === buttonId);

  let updatedButtons: ButtonConfig[];

  if (buttonIndex === -1) {
    // Button is new (only exists in form state, not yet saved to store)
    // Add it to the store with the targetNodeId so the managed edge can be created
    log.info({ nodeId, buttonId, targetNodeId }, "storeActions:setButtonTargetNode:addingNewButton");
    updatedButtons = [...buttons, { id: buttonId, text: "", targetNodeId }];
  } else {
    // Button exists - update its targetNodeId
    updatedButtons = buttons.map((btn) =>
      btn.id === buttonId ? { ...btn, targetNodeId } : btn
    );
  }

  journeyNodesActions.updateNode(nodeId, {
    data: { ...node.data, buttons: updatedButtons },
  });

  // Sync managed edge
  const managedEdgeId = ManagedEdgeId.create(nodeId, buttonId);
  const existingEdge = journeyNodesStore.state.edges.find((e) => e.id === managedEdgeId);

  if (targetNodeId) {
    // Create or update managed edge
    if (existingEdge) {
      journeyNodesActions.updateEdge(managedEdgeId, { target: targetNodeId });
      log.info({ nodeId, buttonId, targetNodeId, edgeId: managedEdgeId }, "storeActions:setButtonTargetNode:edgeUpdated");
    } else {
      journeyNodesActions.addManagedEdge(nodeId, targetNodeId, buttonId, {
        customId: managedEdgeId,
        managed: true,
        managedBy: `button-${buttonId}`,
      });
      log.info({ nodeId, buttonId, targetNodeId, edgeId: managedEdgeId }, "storeActions:setButtonTargetNode:edgeCreated");
    }
  } else {
    // Remove managed edge when target cleared
    if (existingEdge) {
      journeyNodesActions.deleteEdge(managedEdgeId);
      log.info({ nodeId, buttonId, edgeId: managedEdgeId }, "storeActions:setButtonTargetNode:edgeDeleted");
    }
  }

  log.info({ nodeId, buttonId, targetNodeId }, "storeActions:setButtonTargetNode:success");
}

// =============================================================================
// PLUGIN MANAGED EDGE HELPERS (Internal)
// =============================================================================

/**
 * Clear a plugin follow-up button's targetNodeId without deleting its managed edge.
 *
 * Note: This is distinct from the cleanup in journey-nodes-store.deleteNode().
 * - deleteNode() clears ALL references TO a deleted node (comprehensive cleanup)
 * - This function clears ONE specific plugin button when ITS managed edge is deleted
 *
 * @internal Used when the managed edge is being deleted separately
 */
function clearPluginButtonTargetOnly(pluginId: string, stepIdx: number, buttonId: string): void {
  // Find embedded plugin data
  const pluginData = findEmbeddedPlugin(pluginId);
  if (!pluginData || !isFollowUpPluginData(pluginData)) return;

  if (!pluginData.steps?.[stepIdx]?.buttons) return;

  // Clear the button's targetNodeId
  const updatedSteps = [...pluginData.steps];
  updatedSteps[stepIdx] = {
    ...updatedSteps[stepIdx],
    buttons: updatedSteps[stepIdx].buttons!.map((btn) =>
      btn.id === buttonId ? { ...btn, targetNodeId: "" } : btn
    ),
  };

  // Update plugin data in node.data.plugins
  journeyNodesActions.updatePlugin(pluginId, { steps: updatedSteps });
}

/**
 * Clear a plugin exit path without deleting its managed edge.
 *
 * Note: This is distinct from the cleanup in journey-nodes-store.deleteNode().
 * - deleteNode() clears ALL references TO a deleted node (comprehensive cleanup)
 * - This function clears the exit path when ITS managed edge is deleted
 *
 * @internal Used when the managed edge is being deleted separately
 */
function clearPluginExitPathOnly(pluginId: string): void {
  // Find embedded plugin data
  const pluginData = findEmbeddedPlugin(pluginId);
  if (!pluginData || !isFollowUpPluginData(pluginData)) return;

  // Clear exit path using updatePlugin
  journeyNodesActions.updatePlugin(pluginId, { exitPath: undefined });
}

// =============================================================================
// PLUGIN FOLLOW-UP MANAGED EDGE ACTIONS
// =============================================================================

/**
 * Set or clear a plugin follow-up button's target node
 * This method updates the button's targetNodeId AND syncs a managed edge.
 * Managed edges are stored in the journey, visible to the engine, but protected in the UI.
 *
 * @param pluginId - Synthetic plugin ID ({parentNodeId}-plugin-{index})
 * @param stepIdx - The step index within the follow-up sequence
 * @param buttonId - The button ID within the step
 * @param targetNodeId - The target node ID (or undefined to clear)
 */
export function setPluginFollowUpButtonTargetNode(
  pluginId: string,
  stepIdx: number,
  buttonId: string,
  targetNodeId: string | undefined
): void {
  // Find embedded plugin data
  const pluginData = findEmbeddedPlugin(pluginId);
  if (!pluginData) {
    log.warn({ pluginId, stepIdx, buttonId, targetNodeId }, "storeActions:setPluginFollowUpButtonTargetNode:pluginNotFound");
    return;
  }

  if (!isFollowUpPluginData(pluginData)) {
    log.warn({ pluginId, stepIdx, buttonId, targetNodeId }, "storeActions:setPluginFollowUpButtonTargetNode:notFollowUpPlugin");
    return;
  }

  if (!pluginData.steps?.[stepIdx]) {
    log.warn({ pluginId, stepIdx, buttonId, targetNodeId }, "storeActions:setPluginFollowUpButtonTargetNode:stepNotFound");
    return;
  }

  const step = pluginData.steps[stepIdx];
  const buttonIndex = step.buttons?.findIndex((btn) => btn.id === buttonId) ?? -1;
  if (buttonIndex === -1) {
    log.warn({ pluginId, stepIdx, buttonId, targetNodeId }, "storeActions:setPluginFollowUpButtonTargetNode:buttonNotFound");
    return;
  }

  // Get parent node ID from synthetic plugin ID for edge source
  const parsed = parsePluginId(pluginId);
  if (!parsed) {
    log.warn({ pluginId, stepIdx, buttonId, targetNodeId }, "storeActions:setPluginFollowUpButtonTargetNode:invalidPluginId");
    return;
  }
  const { parentNodeId } = parsed;

  // Update the button's targetNodeId
  const updatedSteps = [...pluginData.steps];
  updatedSteps[stepIdx] = {
    ...step,
    buttons: step.buttons!.map((btn) =>
      btn.id === buttonId ? { ...btn, targetNodeId: targetNodeId || "" } : btn
    ),
  };

  // Update plugin data in node.data.plugins
  journeyNodesActions.updatePlugin(pluginId, { steps: updatedSteps });

  // Sync managed edge (edge source is the parent node since plugins are embedded)
  const managedEdgeId = PluginButtonEdgeId.create(pluginId, stepIdx, buttonId);
  const existingEdge = journeyNodesStore.state.edges.find((e) => e.id === managedEdgeId);
  const buttonText = step.buttons![buttonIndex].text;

  if (targetNodeId) {
    // Create or update managed edge (source is parent node, not plugin node)
    const sourceHandle = PluginButtonEdgeId.getSourceHandle(stepIdx, buttonId);
    if (existingEdge) {
      journeyNodesActions.updateEdge(managedEdgeId, { target: targetNodeId, sourceHandle });
      log.info({ pluginId, parentNodeId, stepIdx, buttonId, targetNodeId, edgeId: managedEdgeId, sourceHandle }, "storeActions:setPluginFollowUpButtonTargetNode:edgeUpdated");
    } else {
      journeyNodesActions.addManagedEdge(parentNodeId, targetNodeId, sourceHandle, {
        customId: managedEdgeId,
        managed: true,
        managedBy: `plugin-btn-${stepIdx}-${buttonId}`,
        label: `Step ${stepIdx + 1}: ${buttonText}`,
        style: PLUGIN_EDGE_STYLES.button,
      });
      log.info({ pluginId, parentNodeId, stepIdx, buttonId, targetNodeId, edgeId: managedEdgeId, sourceHandle }, "storeActions:setPluginFollowUpButtonTargetNode:edgeCreated");
    }
  } else {
    // Remove managed edge when target cleared
    if (existingEdge) {
      journeyNodesActions.deleteEdge(managedEdgeId);
      log.info({ pluginId, stepIdx, buttonId, edgeId: managedEdgeId }, "storeActions:setPluginFollowUpButtonTargetNode:edgeDeleted");
    }
  }

  log.info({ pluginId, stepIdx, buttonId, targetNodeId }, "storeActions:setPluginFollowUpButtonTargetNode:success");
}

/**
 * Set or clear a plugin follow-up's exit path
 * This method updates the exitPath.nodeId AND syncs a managed edge.
 * Managed edges are stored in the journey, visible to the engine, but protected in the UI.
 *
 * @param pluginId - Synthetic plugin ID ({parentNodeId}-plugin-{index})
 * @param targetNodeId - The target node ID (or undefined to clear)
 */
export function setPluginFollowUpExitPath(pluginId: string, targetNodeId: string | undefined): void {
  // Find embedded plugin data
  const pluginData = findEmbeddedPlugin(pluginId);
  if (!pluginData) {
    log.warn({ pluginId, targetNodeId }, "storeActions:setPluginFollowUpExitPath:pluginNotFound");
    return;
  }

  if (!isFollowUpPluginData(pluginData)) {
    log.warn({ pluginId, targetNodeId }, "storeActions:setPluginFollowUpExitPath:notFollowUpPlugin");
    return;
  }

  // Get parent node ID from synthetic plugin ID for edge source
  const parsed = parsePluginId(pluginId);
  if (!parsed) {
    log.warn({ pluginId, targetNodeId }, "storeActions:setPluginFollowUpExitPath:invalidPluginId");
    return;
  }
  const { parentNodeId } = parsed;

  // Update the exit path in node.data.plugins
  if (targetNodeId) {
    journeyNodesActions.updatePlugin(pluginId, { exitPath: { nodeId: targetNodeId } });
  } else {
    journeyNodesActions.updatePlugin(pluginId, { exitPath: undefined });
  }

  // Sync managed edge (edge source is the parent node since plugins are embedded)
  const managedEdgeId = PluginExitEdgeId.create(pluginId);
  const existingEdge = journeyNodesStore.state.edges.find((e) => e.id === managedEdgeId);

  if (targetNodeId) {
    // Create or update managed edge (source is parent node, not plugin node)
    const sourceHandle = PluginExitEdgeId.getSourceHandle();
    if (existingEdge) {
      journeyNodesActions.updateEdge(managedEdgeId, { target: targetNodeId, sourceHandle });
      log.info({ pluginId, parentNodeId, targetNodeId, edgeId: managedEdgeId, sourceHandle }, "storeActions:setPluginFollowUpExitPath:edgeUpdated");
    } else {
      journeyNodesActions.addManagedEdge(parentNodeId, targetNodeId, sourceHandle, {
        customId: managedEdgeId,
        managed: true,
        managedBy: "plugin-exit",
        label: "Exit Path",
        edgeType: EdgeTypeEnum.EXIT,
        style: PLUGIN_EDGE_STYLES.exit,
      });
      log.info({ pluginId, targetNodeId, edgeId: managedEdgeId, sourceHandle }, "storeActions:setPluginFollowUpExitPath:edgeCreated");
    }
  } else {
    // Remove managed edge when exit path cleared
    if (existingEdge) {
      journeyNodesActions.deleteEdge(managedEdgeId);
      log.info({ pluginId, edgeId: managedEdgeId }, "storeActions:setPluginFollowUpExitPath:edgeDeleted");
    }
  }

  log.info({ pluginId, targetNodeId }, "storeActions:setPluginFollowUpExitPath:success");
}

// Re-export individual store actions for direct use when cross-store coordination isn't needed
export { builderActions, customJourneyActions, journeyNodesActions, simulatorActions, uiActions, userActions, versionActions };
