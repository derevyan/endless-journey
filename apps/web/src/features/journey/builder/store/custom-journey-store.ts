/**
 * Custom Journey Store
 *
 * Purpose: Manages persistence of user-created custom journeys
 *
 * Responsibilities:
 * - CRUD operations for custom journeys (created via UI)
 * - In-memory storage of custom journey data
 * - Persistence via localStorage (handled by TanStack Store)
 *
 * Boundaries:
 * - Does NOT manage editor UI state (see editor-ui-store)
 * - Does NOT manage version history (see version-store)
 * - Does NOT manage journey nodes/edges (see journey-nodes-store)
 * - Only handles custom journeys, not pre-defined journeys from data/
 * - Clear separation: custom-journey-store = data persistence
 */
import { Store } from "@tanstack/react-store";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
interface JourneyDataContent {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  name?: string;
  description?: string;
}

export type CustomJourneyData = {
  journey?: JourneyDataContent;
  defaultPipelineId?: string;
};

export interface CustomJourneyStoreState {
  customJourneys: Record<string, CustomJourneyData>;
}

const initialState: CustomJourneyStoreState = {
  customJourneys: {},
};

// HMR Safety - Singleton pattern prevents stale subscriptions during hot reload
declare global {
  var __customJourneyStore: ReturnType<typeof createStore> | undefined;
}

function createStore() {
  return new Store<CustomJourneyStoreState>(initialState);
}

function getOrCreateStore() {
  if (globalThis.__customJourneyStore) {
    return globalThis.__customJourneyStore;
  }
  const store = createStore();
  if (import.meta.env.DEV) {
    globalThis.__customJourneyStore = store;
  }
  return store;
}

export const customJourneyStore = getOrCreateStore();

// Helper to get content from journey property
function getContent(data: CustomJourneyData): JourneyDataContent | undefined {
  return data.journey;
}

// Helper to normalize data
function normalizeData(data: CustomJourneyData): CustomJourneyData {
  const content = getContent(data);
  if (!content) {
    return { journey: undefined };
  }
  return {
    journey: content,
    defaultPipelineId: data.defaultPipelineId,
  };
}

export const customJourneyActions = {
  addJourney: (id: string, data: CustomJourneyData) => {
    const normalized = normalizeData(data);
    customJourneyStore.setState((state) => ({
      customJourneys: {
        ...state.customJourneys,
        [id]: normalized,
      },
    }));
  },

  updateJourney: (id: string, data: Partial<CustomJourneyData>) => {
    customJourneyStore.setState((state) => {
      const existing = state.customJourneys[id];
      if (!existing) return state;

      const existingContent = getContent(existing);
      const newContent = getContent(data as CustomJourneyData);

      const mergedContent: JourneyDataContent | undefined = existingContent
        ? {
            ...existingContent,
            ...(newContent || {}),
          }
        : newContent;

      return {
        customJourneys: {
          ...state.customJourneys,
          [id]: {
            journey: mergedContent,
          },
        },
      };
    });
  },

  deleteJourney: (id: string) => {
    customJourneyStore.setState((state) => {
      const updated = { ...state.customJourneys };
      delete updated[id];
      return {
        customJourneys: updated,
      };
    });
  },

  getJourney: (id: string): CustomJourneyData | null => {
    return customJourneyStore.state.customJourneys[id] || null;
  },

  getAllJourneys: (): Record<string, CustomJourneyData> => {
    return customJourneyStore.state.customJourneys;
  },

  reset: () => {
    customJourneyStore.setState({ customJourneys: {} });
  },
};
