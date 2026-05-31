/**
 * Version Store
 *
 * Purpose: Manages version history for journey configurations (API-only)
 *
 * Responsibilities:
 * - Store version list for current journey
 * - Load versions from database API
 * - Provide version data for restore operations
 *
 * Boundaries:
 * - Does NOT manage UI state (see editor-ui-store)
 * - Does NOT manage journey data (see journey-nodes-store)
 * - Uses apiClient for database persistence only
 */
import { Store } from "@tanstack/react-store";
import { createLogger, serializeError } from "@journey/logger";
import { apiClient } from "@/shared/lib/api";
import type { JourneyVersion, VersionedJourneyData, JourneySlug, JourneyUuid } from "@journey/schemas";
import { storeEventBus } from "./store-event-bus";

const log = createLogger("version-store");

/**
 * Version format for display in UI
 */
export interface DisplayVersion {
  id: string; // Version display ID (e.g., "v001")
  journeyUuid: JourneyUuid; // Database UUID (renamed from journeyId for clarity)
  timestamp: string; // ISO 8601 string for display
  notes?: string;
}

/**
 * Convert API version to display format
 */
function apiVersionToDisplay(v: JourneyVersion): DisplayVersion {
  return {
    id: v.versionId,
    journeyUuid: v.journeyId as JourneyUuid, // API returns UUID
    timestamp: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
    notes: v.notes ?? undefined,
  };
}

interface VersionStoreState {
  /** URL-friendly slug for routing (renamed from journeyId for clarity) */
  journeySlug: JourneySlug | null;
  /** Database UUID for API operations */
  journeyUuid: JourneyUuid | null;
  versions: DisplayVersion[];
  isLoading: boolean;
  error: string | null; // Error message from last failed operation
}

const initialState: VersionStoreState = {
  journeySlug: null,
  journeyUuid: null,
  versions: [],
  isLoading: false,
  error: null,
};

// Request counter for race condition prevention
let currentLoadRequest = 0;

// =============================================================================
// HMR-SAFE STORE CREATION
// =============================================================================

declare global {
   
  var __versionStore: Store<VersionStoreState> | undefined;
}

function getOrCreateStore(): Store<VersionStoreState> {
  if (typeof globalThis.__versionStore !== "undefined") {
    return globalThis.__versionStore;
  }
  const store = new Store(initialState);
  if (import.meta.env.DEV) {
    globalThis.__versionStore = store;
  }
  return store;
}

export const versionStore = getOrCreateStore();

// Actions - API-only operations
export const versionActions = {
  /**
   * Set the journey slug (for URL routing)
   */
  setJourneySlug: (slug: JourneySlug | null) => {
    versionStore.setState((state) => ({
      ...state,
      journeySlug: slug,
    }));
  },

  /**
   * Set the journey UUID and load versions from API
   */
  setJourneyUuid: (uuid: JourneyUuid | null) => {
    versionStore.setState((state) => ({
      ...state,
      journeyUuid: uuid,
      error: null, // Clear error when changing journey
    }));
    if (uuid) {
      versionActions.loadVersions(uuid);
    } else {
      versionStore.setState((state) => ({
        ...state,
        versions: [],
        error: null,
      }));
    }
  },

  /**
   * Load versions from the database API
   * Uses request tracking to prevent race conditions when switching journeys quickly
   */
  loadVersions: async (journeyUuid: JourneyUuid): Promise<void> => {
    const requestId = ++currentLoadRequest;
    versionStore.setState((state) => ({ ...state, isLoading: true, error: null }));

    try {
      const apiVersions = await apiClient.listVersions(journeyUuid);

      // Check if this request is still current (prevent race condition)
      if (requestId !== currentLoadRequest) {
        log.debug({ journeyUuid, requestId, currentLoadRequest }, "versionStore:loadVersions:staleRequest");
        return;
      }

      // Validate each version has required fields
      const validVersions = apiVersions.filter((v) => {
        const isValid = v.id && v.journeyId && v.versionId && v.createdAt;
        if (!isValid) {
          log.warn({ version: v, journeyUuid }, "versionStore:loadVersions:invalidVersion");
        }
        return isValid;
      });

      if (validVersions.length !== apiVersions.length) {
        log.warn(
          { total: apiVersions.length, valid: validVersions.length, dropped: apiVersions.length - validVersions.length, journeyUuid },
          "versionStore:loadVersions:invalidVersionsDropped"
        );
      }

      // Convert to display format and sort by timestamp (newest first)
      const displayVersions = validVersions
        .map(apiVersionToDisplay)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      log.debug({ journeyUuid, count: displayVersions.length }, "versionStore:loadVersions:success");

      versionStore.setState((state) => ({
        ...state,
        versions: displayVersions,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      // Check if this request is still current
      if (requestId !== currentLoadRequest) {
        return;
      }

      log.error({ journeyUuid, err: serializeError(error) }, "versionStore:loadVersions:error");
      // Keep existing versions on error (don't clear), just set error state
      versionStore.setState((state) => ({
        ...state,
        isLoading: false,
        error: "Failed to load version history",
      }));
    }
  },

  /**
   * Refresh versions list (re-fetch from API)
   * Returns a Promise so callers can await completion
   */
  refreshVersions: async (): Promise<void> => {
    const { journeyUuid } = versionStore.state;
    if (journeyUuid) {
      await versionActions.loadVersions(journeyUuid);
    }
  },

  /**
   * Get version data from API
   */
  getVersionData: async (versionId: string): Promise<VersionedJourneyData | null> => {
    const { journeyUuid } = versionStore.state;
    if (!journeyUuid) {
      log.warn({ versionId }, "versionStore:getVersionData:noUuid");
      return null;
    }

    try {
      const data = await apiClient.getVersion(journeyUuid, versionId);
      storeEventBus.emit({ type: "version:loaded", payload: { versionId } });
      log.debug({ versionId, journeyUuid }, "versionStore:getVersionData:success");
      return data;
    } catch (error) {
      log.error({ versionId, journeyUuid, err: serializeError(error) }, "versionStore:getVersionData:error");
      return null;
    }
  },

  /**
   * Reset store to initial state (used on logout/user change)
   */
  reset: () => {
    versionStore.setState(() => initialState);
  },
};

// =============================================================================
// EVENT BUS SUBSCRIPTIONS (with cleanup for HMR)
// =============================================================================

const versionStoreCleanupFunctions: (() => void)[] = [];

function setupVersionStoreSubscriptions(): void {
  // Clear any existing subscriptions first (HMR safety)
  cleanupVersionStoreSubscriptions();

  // Refresh versions when save completes (event-driven decoupling from save-manager)
  versionStoreCleanupFunctions.push(
    storeEventBus.on("saveManager:saveCompleted", () => {
      // Fire-and-forget async refresh - UI will update when data arrives
      versionActions.refreshVersions();
    })
  );
}

export function cleanupVersionStoreSubscriptions(): void {
  versionStoreCleanupFunctions.forEach((fn) => fn());
  versionStoreCleanupFunctions.length = 0;
}

// Initialize subscriptions
setupVersionStoreSubscriptions();

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupVersionStoreSubscriptions();
  });
}
