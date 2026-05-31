/**
 * Store Event Bus
 *
 * Provides typed event-driven communication between stores without direct coupling.
 * Stores emit events when their state changes and can subscribe to events from other stores.
 *
 * Benefits:
 * - Decouples stores from each other
 * - Makes stores independently testable
 * - Clear event contracts between modules
 * - Easy to add new stores without modifying existing ones
 *
 * Event types are defined in @journey/schemas for sharing between frontend and backend.
 * This enables real-time sync via SSE when needed.
 *
 * @module stores/store-event-bus
 */

import type { JourneyConfig, JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import type { LayoutOptions } from "@/shared/lib/ui/layout";
import { createLogger, serializeError } from "@journey/logger";
import type {
  // Import base event types from schemas
  StoreEventBase as SchemaStoreEvent,
  SyncEvent,
  PluginNode,
} from "@journey/schemas";

const log = createLogger("store-event-bus");

// Re-export schema event types for convenience
export type { SyncEvent, AllStoreEvents, WorkflowSyncEvent } from "@journey/schemas";

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Web-specific event extensions that include React Flow node/edge objects.
 * These extend the base schema events with richer payloads for the frontend.
 *
 * Web events use a "web:" prefix to distinguish from schema events that come from
 * the backend via SSE. Schema events use simpler payloads (just IDs) for backend
 * compatibility, while web events include full objects for direct store updates.
 */
type WebSpecificEvents =
  // Node events with full node objects
  | { type: "web:node:added"; payload: { node: JourneyNode } }
  | { type: "web:edge:added"; payload: { edge: JourneyEdge } }

  // Journey events with full data
  | { type: "web:journey:loaded"; payload: { journeyId: string; data: JourneyConfig } }
  | { type: "journey:layoutApplied"; payload: { options: LayoutOptions } }

  // Baseline updated after successful save (fixes discard-after-save bug)
  | { type: "journey:baselineUpdated"; payload: Record<string, never> }

  // Plugin events
  | { type: "plugin:added"; payload: { plugin: PluginNode } }
  | { type: "plugin:updated"; payload: { pluginId: string; updates: Partial<PluginNode["data"]> } }
  | { type: "plugin:deleted"; payload: { pluginId: string } }

  // SaveManager events for centralized save state coordination
  | { type: "saveManager:editorRegistered"; payload: { editorId: string } }
  | { type: "saveManager:editorUnregistered"; payload: { editorId: string } }
  | { type: "saveManager:formDirtyChanged"; payload: { editorId: string; isDirty: boolean } }
  | { type: "saveManager:pendingChangesUpdated"; payload: { hasAnyDirty: boolean } }
  | { type: "saveManager:saveCompleted"; payload: { versionId: string } }
  | { type: "saveManager:saveFailed"; payload: { error: unknown } }
  | { type: "saveManager:flushActive"; payload: { onComplete: (success: boolean) => void } };

/**
 * All possible store events with their payloads.
 *
 * This combines:
 * - Base events from @journey/schemas (shareable with backend)
 * - Web-specific extensions with richer payloads
 */
export type StoreEvent =
  | Exclude<SchemaStoreEvent, WebSpecificEvents>
  | WebSpecificEvents
  | SyncEvent;

/**
 * Event listener callback type
 */
type EventListener<T extends StoreEvent = StoreEvent> = (event: T) => void;

/**
 * Unsubscribe function type
 */
type Unsubscribe = () => void;

// =============================================================================
// EVENT BUS CLASS
// =============================================================================

/**
 * Type-safe event bus for store communication
 */
class StoreEventBus {
  private listeners = new Map<StoreEvent["type"], Set<EventListener>>();
  private eventCount = 0;

  /**
   * Emit an event to all subscribed listeners
   */
  emit<T extends StoreEvent>(event: T): void {
    const listeners = this.listeners.get(event.type);

    if (!listeners || listeners.size === 0) {
      // No listeners for this event type - this is OK
      return;
    }

    this.eventCount++;
    log.debug({ eventType: event.type, listenerCount: listeners.size, totalEvents: this.eventCount }, "storeEventBus:emit");

    // Call all listeners with the event
    listeners.forEach((listener) => {
      try {
        listener(event as never); // Cast needed for type narrowing
      } catch (error) {
        log.error({ eventType: event.type, err: serializeError(error) }, "storeEventBus:listenerError");
      }
    });
  }

  /**
   * Subscribe to a specific event type
   * Returns an unsubscribe function
   */
  on<T extends StoreEvent["type"]>(eventType: T, listener: EventListener<Extract<StoreEvent, { type: T }>>): Unsubscribe {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const listeners = this.listeners.get(eventType)!;
    listeners.add(listener as EventListener);

    log.debug({ eventType, listenerCount: listeners.size }, "storeEventBus:subscribed");

    // Return unsubscribe function
    return () => {
      listeners.delete(listener as EventListener);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
      log.debug({ eventType, listenerCount: listeners.size }, "storeEventBus:unsubscribed");
    };
  }

  /**
   * Subscribe to multiple event types with a single listener
   */
  onMany(eventTypes: StoreEvent["type"][], listener: EventListener): Unsubscribe {
    const unsubscribers = eventTypes.map((type) => this.on(type, listener));

    // Return function that unsubscribes from all
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  /**
   * Remove all listeners (useful for testing)
   */
  clear(): void {
    this.listeners.clear();
    this.eventCount = 0;
    log.debug({}, "storeEventBus:cleared");
  }

  /**
   * Get current listener count for an event type (useful for debugging)
   */
  getListenerCount(eventType: StoreEvent["type"]): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }

  /**
   * Get total number of event types with listeners (useful for debugging)
   */
  getEventTypeCount(): number {
    return this.listeners.size;
  }

  /**
   * Get total number of events emitted (useful for debugging)
   */
  getTotalEventCount(): number {
    return this.eventCount;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global store event bus instance
 * Import and use this in stores for cross-store communication
 */
export const storeEventBus = new StoreEventBus();

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type { EventListener, Unsubscribe };
