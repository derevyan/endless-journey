/**
 * Save Manager Store
 *
 * Purpose: Single source of truth for all save-related state and operations.
 *
 * Responsibilities:
 * - Ownership-based auto-save handler tracking (prevents race conditions)
 * - Centralized dirty state tracking across all editors
 * - Save operation lifecycle management (idle → validating → saving → retrying → error)
 * - Error recovery with retry queue
 * - Coordination with other stores via event bus
 *
 * Boundaries:
 * - Does NOT manage journey data (see journey-nodes-store)
 * - Does NOT manage UI state beyond save-related (see ui-store)
 * - Coordinates with other stores via storeEventBus only
 *
 * @module stores/save-manager-store
 */

import { createLogger, serializeError } from "@journey/logger";
import { PluginEdgeId, type JourneyConfig as JourneyConfigSchema } from "@journey/schemas";
import { Store } from "@tanstack/react-store";
import { storeEventBus } from "./store-event-bus";
import { apiClient } from "@/shared/lib/api";
import { notify } from "@/shared/lib/ui/notify";
import { journeyNodesActions } from "./journey-nodes-store";
import { versionStore } from "./version-store";
import { journeyKeys } from "@/shared/lib/query-keys";
import type { QueryClient } from "@tanstack/react-query";

const log = createLogger("save-manager");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Auto-save handler type for editor panels.
 * Returns true if save was successful, false if validation failed.
 */
export type AutoSaveHandler = () => Promise<boolean>;

/**
 * Save operation status
 */
export type SaveOperationStatus = "idle" | "validating" | "saving" | "retrying" | "error";

/**
 * Result of a save operation
 */
export interface SaveResult {
  success: boolean;
  versionId?: string;
  error?: string;
  recoverable?: boolean;
}

/**
 * Item in the recovery queue for failed saves
 */
export interface SaveRecoveryItem {
  id: string;
  type: "node" | "edge" | "version";
  data: unknown;
  failedAt: number;
  retryCount: number;
  lastError?: string;
}

/**
 * Save Manager State
 */
export interface SaveManagerState {
  // Editor ownership tracking (only one active at a time)
  activeEditorId: string | null;
  activeEditorHandler: AutoSaveHandler | null;

  // Per-editor dirty tracking (nodeId/edgeId → isDirty)
  formDirtyMap: Record<string, boolean>;

  // Journey-level dirty (canvas changes, non-form changes)
  journeyDirty: boolean;

  // Save operation lifecycle
  saveOperation: {
    status: SaveOperationStatus;
    attemptCount: number;
    lastError: Error | null;
    lastAttemptAt: number | null;
  };

  // Recovery queue for failed saves
  recoveryQueue: SaveRecoveryItem[];
}

const initialState: SaveManagerState = {
  activeEditorId: null,
  activeEditorHandler: null,
  formDirtyMap: {},
  journeyDirty: false,
  saveOperation: {
    status: "idle",
    attemptCount: 0,
    lastError: null,
    lastAttemptAt: null,
  },
  recoveryQueue: [],
};

// =============================================================================
// STORE SINGLETON (HMR-safe)
// =============================================================================

declare global {
   
  var __saveManagerStore: Store<SaveManagerState> | undefined;
}

function getOrCreateStore(): Store<SaveManagerState> {
  if (typeof globalThis.__saveManagerStore !== "undefined") {
    return globalThis.__saveManagerStore;
  }
  const store = new Store(initialState);
  if (import.meta.env.DEV) {
    globalThis.__saveManagerStore = store;
  }
  return store;
}

export const saveManagerStore = getOrCreateStore();

// =============================================================================
// SELECTORS
// =============================================================================

export const saveManagerSelectors = {
  /** Check if any editor has unsaved changes */
  hasUnsavedChanges: (state: SaveManagerState): boolean => {
    if (state.journeyDirty) return true;
    return Object.values(state.formDirtyMap).some(Boolean);
  },

  /** Check if save is in progress */
  isSaving: (state: SaveManagerState): boolean => {
    return state.saveOperation.status !== "idle" && state.saveOperation.status !== "error";
  },

  /** Check if there are recoverable failed saves */
  hasRecoverableItems: (state: SaveManagerState): boolean => {
    return state.recoveryQueue.length > 0;
  },

  /** Get active editor ID if any */
  getActiveEditorId: (state: SaveManagerState): string | null => {
    return state.activeEditorId;
  },
};

// =============================================================================
// QUERY CLIENT REFERENCE
// =============================================================================

let queryClientRef: QueryClient | null = null;

export function setSaveManagerQueryClient(client: QueryClient) {
  queryClientRef = client;
}

function getQueryClient(): QueryClient | null {
  return queryClientRef;
}

// =============================================================================
// RETRY UTILITY
// =============================================================================

interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  onRetry?: (attempt: number) => void;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelay, onRetry } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        onRetry?.(attempt);
        // Exponential backoff: 1s, 2s, 4s...
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

// =============================================================================
// ACTIONS
// =============================================================================

export const saveManagerActions = {
  // ---------------------------------------------------------------------------
  // EDITOR LIFECYCLE
  // ---------------------------------------------------------------------------

  /**
   * Register an editor as the active auto-save handler.
   * Only one editor can be active at a time.
   *
   * @param editorId - Unique ID for this editor (e.g., nodeId, edgeId)
   * @param handler - Function to call for auto-save (should validate and save)
   */
  registerEditor: (editorId: string, handler: AutoSaveHandler) => {
    const currentState = saveManagerStore.state;

    // If there's already an active editor with a different ID, this is a race condition
    // The old handler should have been unregistered first
    if (currentState.activeEditorId && currentState.activeEditorId !== editorId) {
      log.warn(
        { oldEditorId: currentState.activeEditorId, newEditorId: editorId },
        "saveManager:registerEditor:replacingActiveEditor"
      );
    }

    saveManagerStore.setState((s) => ({
      ...s,
      activeEditorId: editorId,
      activeEditorHandler: handler,
    }));

    log.debug({ editorId }, "saveManager:registerEditor:success");

    storeEventBus.emit({
      type: "saveManager:editorRegistered",
      payload: { editorId },
    });
  },

  /**
   * Unregister an editor's auto-save handler.
   * Only unregisters if the editorId matches the active editor.
   *
   * @param editorId - The editor ID to unregister
   */
  unregisterEditor: (editorId: string) => {
    const currentState = saveManagerStore.state;

    // Only unregister if this is the active editor
    if (currentState.activeEditorId !== editorId) {
      log.debug(
        { editorId, activeEditorId: currentState.activeEditorId },
        "saveManager:unregisterEditor:notActiveEditor"
      );
      return;
    }

    saveManagerStore.setState((s) => ({
      ...s,
      activeEditorId: null,
      activeEditorHandler: null,
    }));

    log.debug({ editorId }, "saveManager:unregisterEditor:success");

    storeEventBus.emit({
      type: "saveManager:editorUnregistered",
      payload: { editorId },
    });
  },

  // ---------------------------------------------------------------------------
  // DIRTY STATE TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Set dirty state for a specific editor.
   * Called by form hooks when form.isDirty changes.
   */
  setFormDirty: (editorId: string, isDirty: boolean) => {
    const currentState = saveManagerStore.state;
    const wasDirty = currentState.formDirtyMap[editorId] || false;

    if (wasDirty === isDirty) return; // No change

    saveManagerStore.setState((s) => ({
      ...s,
      formDirtyMap: {
        ...s.formDirtyMap,
        [editorId]: isDirty,
      },
    }));

    // Notify UI store via event for pending changes indicator
    const newState = saveManagerStore.state;
    const hasAnyDirty = saveManagerSelectors.hasUnsavedChanges(newState);
    storeEventBus.emit({
      type: "saveManager:pendingChangesUpdated",
      payload: { hasAnyDirty },
    });

    storeEventBus.emit({
      type: "saveManager:formDirtyChanged",
      payload: { editorId, isDirty },
    });

    log.debug({ editorId, isDirty, hasAnyDirty }, "saveManager:setFormDirty");
  },

  /**
   * Set journey-level dirty state (canvas changes, non-form changes).
   */
  setJourneyDirty: (isDirty: boolean) => {
    saveManagerStore.setState((s) => ({
      ...s,
      journeyDirty: isDirty,
    }));

    // Notify UI store via event for pending changes indicator
    const newState = saveManagerStore.state;
    const hasAnyDirty = saveManagerSelectors.hasUnsavedChanges(newState);
    storeEventBus.emit({
      type: "saveManager:pendingChangesUpdated",
      payload: { hasAnyDirty },
    });

    log.debug({ isDirty, hasAnyDirty }, "saveManager:setJourneyDirty");
  },

  /**
   * Clear all dirty state. Called after successful save or discard.
   */
  clearAllDirty: () => {
    saveManagerStore.setState((s) => ({
      ...s,
      formDirtyMap: {},
      journeyDirty: false,
    }));

    // Notify UI store via event
    storeEventBus.emit({
      type: "saveManager:pendingChangesUpdated",
      payload: { hasAnyDirty: false },
    });

    log.debug({}, "saveManager:clearAllDirty");
  },

  /**
   * Clear dirty state for a specific editor.
   */
  clearFormDirty: (editorId: string) => {
    saveManagerStore.setState((s) => {
      const newMap = { ...s.formDirtyMap };
      delete newMap[editorId];
      return { ...s, formDirtyMap: newMap };
    });

    // Notify UI store via event
    const newState = saveManagerStore.state;
    const hasAnyDirty = saveManagerSelectors.hasUnsavedChanges(newState);
    storeEventBus.emit({
      type: "saveManager:pendingChangesUpdated",
      payload: { hasAnyDirty },
    });

    log.debug({ editorId }, "saveManager:clearFormDirty");
  },

  // ---------------------------------------------------------------------------
  // AUTO-SAVE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Flush the active editor's auto-save handler.
   * Returns true if no handler or handler succeeded, false if validation failed.
   *
   * Flushes the active editor handler with validation-aware results.
   */
  flushActiveEditor: async (): Promise<boolean> => {
    const { activeEditorId, activeEditorHandler } = saveManagerStore.state;

    if (!activeEditorHandler) {
      log.debug({}, "saveManager:flushActiveEditor:noHandler");
      return true; // No editor open, nothing to flush
    }

    if (!activeEditorId) {
      log.warn({}, "saveManager:flushActiveEditor:noEditorId");
      return true;
    }

    log.debug({ editorId: activeEditorId }, "saveManager:flushActiveEditor:start");

    try {
      const success = await activeEditorHandler();

      if (!success) {
        log.debug({ editorId: activeEditorId }, "saveManager:flushActiveEditor:validationFailed");
      } else {
        log.debug({ editorId: activeEditorId }, "saveManager:flushActiveEditor:success");
        // Clear dirty state for this editor after successful flush
        saveManagerActions.clearFormDirty(activeEditorId);
      }

      return success;
    } catch (error) {
      log.error(
        { editorId: activeEditorId, err: serializeError(error) },
        "saveManager:flushActiveEditor:error"
      );
      return false;
    }
  },

  /**
   * Check if there's a registered auto-save handler.
   */
  hasActiveEditor: (): boolean => {
    return saveManagerStore.state.activeEditorHandler !== null;
  },

  // ---------------------------------------------------------------------------
  // VERSION SAVE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Save current journey as a new version.
   * Coordinates between stores, handles retries, and manages error recovery.
   *
   * @param notes - Optional save notes
   * @returns SaveResult with success status and version ID
   */
  saveVersion: async (notes?: string): Promise<SaveResult> => {
    const state = saveManagerStore.state;

    // Prevent concurrent saves
    if (state.saveOperation.status !== "idle" && state.saveOperation.status !== "error") {
      log.warn({ currentStatus: state.saveOperation.status }, "saveManager:saveVersion:alreadySaving");
      notify.warning("Save in progress", { description: "Please wait for the current save to complete." });
      return { success: false, error: "Save already in progress" };
    }

    // Get journey data
    const currentData = journeyNodesActions.getCurrentData();
    if (!currentData) {
      return { success: false, error: "No journey data to save" };
    }

    const journeyUuid = versionStore.state.journeyUuid;
    const journeySlug = versionStore.state.journeySlug;

    if (!journeyUuid) {
      log.warn({ journeySlug }, "saveManager:saveVersion:noUuid");
      notify.error("Cannot save version", { description: "Journey not loaded from database." });
      return { success: false, error: "Journey not loaded from database" };
    }

    // Step 1: Flush active editor
    saveManagerStore.setState((s) => ({
      ...s,
      saveOperation: {
        ...s.saveOperation,
        status: "validating",
        attemptCount: 0,
        lastError: null,
        lastAttemptAt: Date.now(),
      },
    }));

    const flushSuccess = await saveManagerActions.flushActiveEditor();
    if (!flushSuccess) {
      saveManagerStore.setState((s) => ({
        ...s,
        saveOperation: { ...s.saveOperation, status: "idle" },
      }));
      return { success: false, error: "Editor validation failed" };
    }

    // Step 2: Prepare API payload
    // Filter out plugin edges - they are regenerated on load from embedded plugin data
    // Plugin edges have IDs starting with "plugin::", "plugin-btn::", or "plugin-exit::"
    const persistableEdges = currentData.edges
      .filter((edge) => !PluginEdgeId.isPluginEdge(edge.id))
      .map((edge) => ({
        ...edge,
        label: typeof edge.label === "string" ? edge.label : undefined,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
      }));

    const apiConfig = {
      nodes: currentData.nodes,
      edges: persistableEdges,
    };

    // Step 3: Save with retry
    saveManagerStore.setState((s) => ({
      ...s,
      saveOperation: { ...s.saveOperation, status: "saving" },
    }));

    try {
      const result = await withRetry(
        () => apiClient.saveVersionAtomic(journeyUuid, {
          notes,
          configuration: apiConfig as JourneyConfigSchema,
        }),
        {
          maxAttempts: 3,
          baseDelay: 1000,
          onRetry: (attempt) => {
            log.info({ attempt, journeyUuid }, "saveManager:saveVersion:retrying");
            saveManagerStore.setState((s) => ({
              ...s,
              saveOperation: {
                ...s.saveOperation,
                status: "retrying",
                attemptCount: attempt,
              },
            }));
          },
        }
      );

      const { versionId } = result;
      log.info({ journeyUuid, versionId }, "saveManager:saveVersion:success");

      // Invalidate query cache
      const client = getQueryClient();
      if (client) {
        try {
          if (journeySlug) {
            client.invalidateQueries({ queryKey: journeyKeys.detail(journeySlug) });
          }
          client.invalidateQueries({ queryKey: journeyKeys.detail(journeyUuid) });
        } catch (error) {
          log.warn({ err: serializeError(error) }, "saveManager:saveVersion:cacheInvalidationFailed");
        }
      }

      // Reset save operation state
      saveManagerStore.setState((s) => ({
        ...s,
        saveOperation: {
          status: "idle",
          attemptCount: 0,
          lastError: null,
          lastAttemptAt: null,
        },
      }));

      // Emit success event FIRST - listeners will:
      // - journey-nodes-store: update baseline (sync)
      // - version-store: refresh versions (async, fire-and-forget)
      storeEventBus.emit({
        type: "saveManager:saveCompleted",
        payload: { versionId },
      });

      // Clear all dirty state after baseline is updated via event
      saveManagerActions.clearAllDirty();

      notify.success(`Published as ${versionId}`);

      return { success: true, versionId };

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error({ journeyUuid, err: serializeError(error) }, "saveManager:saveVersion:failed");

      // Add to recovery queue
      const recoveryItem: SaveRecoveryItem = {
        id: `save-${Date.now()}`,
        type: "version",
        data: { notes, configuration: apiConfig },
        failedAt: Date.now(),
        retryCount: 0,
        lastError: errorObj.message,
      };

      saveManagerStore.setState((s) => ({
        ...s,
        saveOperation: {
          status: "error",
          attemptCount: s.saveOperation.attemptCount,
          lastError: errorObj,
          lastAttemptAt: Date.now(),
        },
        recoveryQueue: [...s.recoveryQueue, recoveryItem],
      }));

      storeEventBus.emit({
        type: "saveManager:saveFailed",
        payload: { error: serializeError(errorObj) },
      });

      notify.error("Failed to save version", { description: "Your changes are queued for retry." });

      return { success: false, error: errorObj.message, recoverable: true };
    }
  },

  // ---------------------------------------------------------------------------
  // RECOVERY OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Retry all failed saves in the recovery queue.
   */
  retryFailedSaves: async (): Promise<boolean> => {
    const { recoveryQueue } = saveManagerStore.state;

    if (recoveryQueue.length === 0) {
      return true;
    }

    log.info({ count: recoveryQueue.length }, "saveManager:retryFailedSaves:start");

    // For now, just retry the last version save
    // More sophisticated recovery can be added later
    const result = await saveManagerActions.saveVersion();

    if (result.success) {
      // Clear recovery queue on success
      saveManagerStore.setState((s) => ({
        ...s,
        recoveryQueue: [],
      }));
    }

    return result.success;
  },

  /**
   * Clear the recovery queue (discard failed saves).
   */
  clearRecoveryQueue: () => {
    saveManagerStore.setState((s) => ({
      ...s,
      recoveryQueue: [],
      saveOperation: {
        ...s.saveOperation,
        status: "idle",
        lastError: null,
      },
    }));

    log.info({}, "saveManager:clearRecoveryQueue");
  },

  // ---------------------------------------------------------------------------
  // RESET
  // ---------------------------------------------------------------------------

  /**
   * Reset store to initial state (used on logout/journey change).
   */
  reset: () => {
    saveManagerStore.setState(() => initialState);
    log.info({}, "saveManager:reset");
  },
};

// =============================================================================
// EVENT BUS SUBSCRIPTIONS (with cleanup for HMR)
// =============================================================================

const saveManagerCleanupFunctions: (() => void)[] = [];

function setupSaveManagerSubscriptions(): void {
  // Clear any existing subscriptions first (HMR safety)
  cleanupSaveManagerSubscriptions();

  // Listen to node/edge events to track journey-level dirty state
  saveManagerCleanupFunctions.push(
    storeEventBus.onMany(
      [
        "web:node:added",
        "node:updated",
        "node:deleted",
        "web:edge:added",
        "edge:updated",
        "edge:deleted",
        "journey:layoutApplied",
      ],
      () => {
        saveManagerActions.setJourneyDirty(true);
      }
    )
  );

  // Listen to journey:loaded to clear dirty state
  saveManagerCleanupFunctions.push(
    storeEventBus.on("web:journey:loaded", () => {
      saveManagerActions.clearAllDirty();
    })
  );

  // Listen to journey:baselineUpdated (after save) to clear dirty state
  saveManagerCleanupFunctions.push(
    storeEventBus.on("journey:baselineUpdated", () => {
      saveManagerActions.clearAllDirty();
    })
  );

  saveManagerCleanupFunctions.push(
    storeEventBus.on("saveManager:flushActive", (event) => {
      void (async () => {
        try {
          const success = await saveManagerActions.flushActiveEditor();
          event.payload.onComplete(success);
        } catch (error) {
          log.error({ err: serializeError(error) }, "saveManager:flushActive:failed");
          event.payload.onComplete(false);
        }
      })();
    })
  );
}

export function cleanupSaveManagerSubscriptions(): void {
  saveManagerCleanupFunctions.forEach((fn) => fn());
  saveManagerCleanupFunctions.length = 0;
}

// Initialize subscriptions
setupSaveManagerSubscriptions();

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupSaveManagerSubscriptions();
  });
}
