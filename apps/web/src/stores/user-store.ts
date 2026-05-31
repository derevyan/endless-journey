/**
 * User Store
 *
 * Manages the current user state for the application.
 * User data comes from Better Auth session.
 *
 * @module stores/user-store
 */

import { Store } from "@tanstack/react-store";
import { createLogger } from "@journey/logger";
import { storeEventBus } from "./store-event-bus";

const log = createLogger("user-store");

// =============================================================================
// TYPES
// =============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface UserState {
  currentUser: User | null;
  isLoading: boolean;
}

// =============================================================================
// STORE
// =============================================================================

const initialState: UserState = {
  currentUser: null,
  isLoading: false,
};

// HMR-SAFE STORE CREATION
declare global {
   
  var __userStore: Store<UserState> | undefined;
}

function getOrCreateStore(): Store<UserState> {
  if (typeof globalThis.__userStore !== "undefined") {
    return globalThis.__userStore;
  }
  const store = new Store<UserState>(initialState);
  if (import.meta.env.DEV) {
    globalThis.__userStore = store;
  }
  return store;
}

export const userStore = getOrCreateStore();

// =============================================================================
// ACTIONS
// =============================================================================

export const userActions = {
  /**
   * Set the current user (from auth session)
   */
  setUser: (user: User | null): void => {
    userStore.setState((state) => ({
      ...state,
      currentUser: user,
      isLoading: false,
    }));
    log.info({ userId: user?.id }, "userStore:setUser");
    if (user) {
      storeEventBus.emit({ type: "user:loggedIn", payload: { userId: user.id } });
    }
  },

  /**
   * Set loading state
   */
  setLoading: (isLoading: boolean): void => {
    userStore.setState((state) => ({
      ...state,
      isLoading,
    }));
  },

  /**
   * Clear user (logout)
   */
  clearUser: (): void => {
    userStore.setState((state) => ({
      ...state,
      currentUser: null,
      isLoading: false,
    }));
    log.info({}, "userStore:clearUser");
    storeEventBus.emit({ type: "user:loggedOut", payload: {} });
  },

  /**
   * Reset store to initial state (used on logout/user change)
   */
  reset: (): void => {
    userStore.setState(() => initialState);
    log.info({}, "userStore:reset");
  },
};

// =============================================================================
// SELECTORS
// =============================================================================

export const userSelectors = {
  currentUser: (state: UserState): User | null => state.currentUser,
  isLoading: (state: UserState): boolean => state.isLoading,
  isAuthenticated: (state: UserState): boolean => state.currentUser !== null,
};
