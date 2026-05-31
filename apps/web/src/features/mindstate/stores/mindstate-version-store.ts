/**
 * Mindstate Version Store
 *
 * Manages version list state, loads from API, prevents race conditions.
 * Mirrors the journey version-store pattern adapted for mindstate definitions.
 *
 * @module features/mindstate/stores/mindstate-version-store
 */

import { Store } from "@tanstack/react-store";
import { createLogger, serializeError } from "@journey/logger";
import type { MindstateDefinitionVersion, VersionedMindstateData } from "@journey/schemas";
import { mindstateVersionsApi } from "@/shared/lib/api";

const log = createLogger("mindstate-version-store");

// =============================================================================
// TYPES
// =============================================================================

export interface MindstateVersionStoreState {
  definitionId: string | null;
  definitionKey: string | null;
  versions: MindstateDefinitionVersion[];
  isLoading: boolean;
  error: string | null;
  // Race condition prevention
  currentLoadRequest: number;
}

// =============================================================================
// STORE CREATION
// =============================================================================

declare global {
   
  var __mindstateVersionStore: Store<MindstateVersionStoreState> | undefined;
}

function getOrCreateStore(): Store<MindstateVersionStoreState> {
  if (typeof globalThis.__mindstateVersionStore !== "undefined") {
    return globalThis.__mindstateVersionStore;
  }

  const store = new Store<MindstateVersionStoreState>({
    definitionId: null,
    definitionKey: null,
    versions: [],
    isLoading: false,
    error: null,
    currentLoadRequest: 0,
  });

  if (import.meta.env.DEV) {
    globalThis.__mindstateVersionStore = store;
  }

  return store;
}

export const mindstateVersionStore = getOrCreateStore();

// =============================================================================
// ACTIONS
// =============================================================================

export const mindstateVersionActions = {
  setDefinitionId: (id: string | null) => {
    mindstateVersionStore.setState((s) => ({ ...s, definitionId: id }));
    // Auto-load versions when definition ID is set
    if (id) {
      mindstateVersionActions.loadVersions(id);
    }
  },

  setDefinitionKey: (key: string | null) => {
    mindstateVersionStore.setState((s) => ({ ...s, definitionKey: key }));
  },

  loadVersions: async (definitionId: string) => {
    try {
      // Increment request counter to prevent race conditions
      const state = mindstateVersionStore.state;
      const requestId = state.currentLoadRequest + 1;

      mindstateVersionStore.setState((s) => ({
        ...s,
        isLoading: true,
        error: null,
        currentLoadRequest: requestId,
      }));

      const versions = await mindstateVersionsApi.listVersions(definitionId);

      // Only update if this is still the latest request
      const currentState = mindstateVersionStore.state;
      if (currentState.currentLoadRequest === requestId) {
        mindstateVersionStore.setState((s) => ({
          ...s,
          versions,
          isLoading: false,
          error: null,
        }));
        log.debug({ definitionId, count: versions.length }, "mindstateVersionStore:loadVersions:success");
      }
    } catch (error) {
      mindstateVersionStore.setState((s) => ({
        ...s,
        isLoading: false,
        error: `Failed to load versions: ${error instanceof Error ? error.message : "Unknown error"}`,
      }));
      log.error({ definitionId, err: serializeError(error) }, "mindstateVersionStore:loadVersions:error");
    }
  },

  refreshVersions: async () => {
    const state = mindstateVersionStore.state;
    if (state.definitionId) {
      await mindstateVersionActions.loadVersions(state.definitionId);
    }
  },

  getVersionData: async (versionId: string): Promise<VersionedMindstateData | null> => {
    const state = mindstateVersionStore.state;
    if (!state.definitionId) {
      log.warn({}, "mindstateVersionStore:getVersionData:noDefinitionId");
      return null;
    }

    try {
      const data = await mindstateVersionsApi.getVersion(state.definitionId, versionId);
      log.debug({ definitionId: state.definitionId, versionId }, "mindstateVersionStore:getVersionData:success");
      return data;
    } catch (error) {
      log.error(
        { definitionId: state.definitionId, versionId, err: serializeError(error) },
        "mindstateVersionStore:getVersionData:error"
      );
      return null;
    }
  },

  reset: () => {
    mindstateVersionStore.setState({
      definitionId: null,
      definitionKey: null,
      versions: [],
      isLoading: false,
      error: null,
      currentLoadRequest: 0,
    });
  },
};
