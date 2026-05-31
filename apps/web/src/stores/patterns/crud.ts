/**
 * CRUD Pattern (Create, Read, Update, Delete)
 *
 * Composable CRUD capability for array fields in stores.
 * Automatically emits events via store event bus.
 *
 * @module stores/patterns/crud
 */

import type { Store } from "@tanstack/react-store";
import { storeEventBus, type StoreEvent } from "../store-event-bus";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Base item interface - must have an id field.
 */
export interface Identifiable {
  id: string;
}

/**
 * CRUD capability interface returned by createCRUDCapability.
 */
export interface CRUDCapability<T extends Identifiable> {
  /** Add a new item to the array */
  add: (item: T) => void;
  /** Update an existing item by id */
  update: (id: string, updates: Partial<T>) => void;
  /** Remove an item by id */
  remove: (id: string) => void;
  /** Get an item by id */
  getById: (id: string) => T | undefined;
  /** Get all items */
  getAll: () => T[];
  /** Check if an item exists */
  exists: (id: string) => boolean;
  /** Get count of items */
  count: () => number;
  /** Replace all items */
  setAll: (items: T[]) => void;
  /** Clear all items */
  clear: () => void;
}

/**
 * Options for creating CRUD capability.
 */
export interface CRUDOptions<T extends Identifiable> {
  /** Event type prefix (e.g., "node" emits "node:added", "node:updated", "node:deleted") */
  eventPrefix?: string;
  /** Extract type from item for event payload */
  getType?: (item: T) => string | undefined;
  /** Callback after item added */
  onAdd?: (item: T) => void;
  /** Callback after item updated */
  onUpdate?: (id: string, updates: Partial<T>) => void;
  /** Callback after item removed */
  onRemove?: (id: string) => void;
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create CRUD capability for an array field in a store.
 *
 * This is a composable pattern that adds standard CRUD operations for any
 * array field in your store. Events are automatically emitted via the store
 * event bus.
 *
 * @param store - TanStack Store instance
 * @param fieldName - Name of the array field in state
 * @param options - Configuration options
 * @returns CRUD capability object
 *
 * @example
 * ```typescript
 * // In your store file
 * interface MyState {
 *   nodes: Node[];
 *   edges: Edge[];
 * }
 *
 * const store = new Store<MyState>({ nodes: [], edges: [] });
 *
 * const nodeCRUD = createCRUDCapability(store, "nodes", {
 *   eventPrefix: "node",
 *   getType: (node) => node.data?.type,
 * });
 *
 * const edgeCRUD = createCRUDCapability(store, "edges", {
 *   eventPrefix: "edge",
 * });
 *
 * // Use in actions
 * export const actions = {
 *   addNode: nodeCRUD.add,
 *   updateNode: nodeCRUD.update,
 *   deleteNode: nodeCRUD.remove,
 *   // ...
 * };
 * ```
 */
export function createCRUDCapability<
  TState extends Record<string, unknown>,
  T extends Identifiable,
>(
  store: Store<TState>,
  fieldName: keyof TState & string,
  options: CRUDOptions<T> = {}
): CRUDCapability<T> {
  const { eventPrefix, getType, onAdd, onUpdate, onRemove } = options;

  // Helper to get items array from state
  const getItems = (): T[] => (store.state[fieldName] as T[]) ?? [];

  // Helper to emit event if prefix is configured
  const emitEvent = (eventType: string, payload: Record<string, unknown>) => {
    if (eventPrefix) {
      storeEventBus.emit({
        type: eventType,
        payload,
      } as StoreEvent);
    }
  };

  return {
    add: (item: T) => {
      store.setState((s) => ({
        ...s,
        [fieldName]: [...getItems(), item],
      }));

      emitEvent(`${eventPrefix}:added`, {
        [`${eventPrefix}Id`]: item.id,
        ...(getType && { [`${eventPrefix}Type`]: getType(item) }),
      });

      onAdd?.(item);
    },

    update: (id: string, updates: Partial<T>) => {
      store.setState((s) => ({
        ...s,
        [fieldName]: getItems().map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }));

      emitEvent(`${eventPrefix}:updated`, {
        [`${eventPrefix}Id`]: id,
        updates,
      });

      onUpdate?.(id, updates);
    },

    remove: (id: string) => {
      store.setState((s) => ({
        ...s,
        [fieldName]: getItems().filter((item) => item.id !== id),
      }));

      emitEvent(`${eventPrefix}:deleted`, {
        [`${eventPrefix}Id`]: id,
      });

      onRemove?.(id);
    },

    getById: (id: string) => getItems().find((item) => item.id === id),

    getAll: () => getItems(),

    exists: (id: string) => getItems().some((item) => item.id === id),

    count: () => getItems().length,

    setAll: (items: T[]) => {
      store.setState((s) => ({
        ...s,
        [fieldName]: items,
      }));
    },

    clear: () => {
      store.setState((s) => ({
        ...s,
        [fieldName]: [],
      }));
    },
  };
}
