/**
 * Mindstate Save Manager Store
 *
 * Orchestrates atomic saves for mindstate definitions.
 * Simplified version of journey save-manager (mindstate has simpler editor lifecycle).
 *
 * @module features/mindstate/stores/mindstate-save-manager-store
 */

import { Store } from "@tanstack/react-store";
import { createLogger, serializeError } from "@journey/logger";
import type { AtomicSaveMindstateInput } from "@journey/schemas";
import { mindstateVersionsApi } from "@/shared/lib/api";
import { builderActions, builderStore } from "./builder-store";
import { mindstateVersionActions } from "./mindstate-version-store";
import { notify } from "@/shared/lib/ui/notify";

const log = createLogger("mindstate-save-manager-store");

// =============================================================================
// TYPES
// =============================================================================

export interface MindstateSaveManagerState {
  isSaving: boolean;
  saveOperation: {
    status: "idle" | "validating" | "saving" | "retrying" | "error";
    attemptCount: number;
    lastError: Error | null;
    lastAttemptAt: number | null;
  };
}

// =============================================================================
// STORE CREATION
// =============================================================================

declare global {
   
  var __mindstateSaveManagerStore: Store<MindstateSaveManagerState> | undefined;
}

function getOrCreateStore(): Store<MindstateSaveManagerState> {
  if (typeof globalThis.__mindstateSaveManagerStore !== "undefined") {
    return globalThis.__mindstateSaveManagerStore;
  }

  const store = new Store<MindstateSaveManagerState>({
    isSaving: false,
    saveOperation: {
      status: "idle",
      attemptCount: 0,
      lastError: null,
      lastAttemptAt: null,
    },
  });

  if (import.meta.env.DEV) {
    globalThis.__mindstateSaveManagerStore = store;
  }

  return store;
}

export const mindstateSaveManagerStore = getOrCreateStore();

// =============================================================================
// ACTIONS
// =============================================================================

export const mindstateSaveManagerActions = {
  saveVersion: async (notes?: string) => {
    const state = mindstateSaveManagerStore.state;
    const builderState = builderStore.state;

    // Check if already saving
    if (state.isSaving) {
      log.warn({}, "mindstateSaveManagerStore:saveVersion:alreadySaving");
      return false;
    }

    // Check if dirty
    if (!builderState.isDirty) {
      log.debug({}, "mindstateSaveManagerStore:saveVersion:notDirty");
      return true;
    }

    // Check if we have a definition to save
    if (!builderState.definition) {
      log.error({}, "mindstateSaveManagerStore:saveVersion:noDefinition");
      notify.error("No definition to save");
      return false;
    }

    try {
      mindstateSaveManagerStore.setState((s) => ({
        ...s,
        isSaving: true,
        saveOperation: {
          status: "saving",
          attemptCount: 1,
          lastError: null,
          lastAttemptAt: Date.now(),
        },
      }));

      // Prepare configuration
      const config = {
        mainAgentConfig: builderState.definition.mainAgentConfig,
        defaultAgents: builderState.definition.defaultAgents,
        defaultParameters: builderState.definition.defaultParameters,
        analysisMode: builderState.definition.analysisMode,
        categories: builderState.definition.categories,
      };

      // Call atomic save API
      const data: AtomicSaveMindstateInput = {
        configuration: config,
        notes: notes || undefined,
      };

      const result = await mindstateVersionsApi.saveVersionAtomic(builderState.definition.id, data);

      // Mark as clean and refresh versions
      builderActions.markClean();
      await mindstateVersionActions.refreshVersions();

      mindstateSaveManagerStore.setState((s) => ({
        ...s,
        isSaving: false,
        saveOperation: {
          status: "idle",
          attemptCount: 0,
          lastError: null,
          lastAttemptAt: null,
        },
      }));

      notify.success(`Published as ${result.versionId}`);
      log.info({ versionId: result.versionId }, "mindstateSaveManagerStore:saveVersion:success");
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      mindstateSaveManagerStore.setState((s) => ({
        ...s,
        isSaving: false,
        saveOperation: {
          status: "error",
          attemptCount: state.saveOperation.attemptCount,
          lastError: error instanceof Error ? error : new Error(errorMsg),
          lastAttemptAt: Date.now(),
        },
      }));

      notify.error("Failed to save version", { description: errorMsg });
      log.error({ err: serializeError(error) }, "mindstateSaveManagerStore:saveVersion:error");
      return false;
    }
  },

  reset: () => {
    mindstateSaveManagerStore.setState({
      isSaving: false,
      saveOperation: {
        status: "idle",
        attemptCount: 0,
        lastError: null,
        lastAttemptAt: null,
      },
    });
  },
};
