/**
 * Typed Event Helpers
 *
 * Type-safe utilities for working with events from the registry.
 * Provides compile-time type inference for event payloads.
 *
 * @module schemas/events/typed-events
 */

import { z } from "zod";
import type { BaseEvent } from "./core";
import { EVENT_REGISTRY, type EventType, type EventContextType } from "./registry";

// =============================================================================
// PAYLOAD TYPE INFERENCE
// =============================================================================

/**
 * Infer the payload type for a specific event type from the registry
 *
 * @example
 * type StageChangedPayload = EventPayload<"crm.stage.changed">;
 * // Results in: { pipelineId: string; pipelineName: string; ... }
 */
export type EventPayload<T extends EventType> = z.infer<
  (typeof EVENT_REGISTRY)[T]["payloadSchema"]
>;

/**
 * A fully typed event with payload inferred from the registry
 *
 * @example
 * const event: TypedEvent<"crm.stage.changed"> = { ... };
 */
export type TypedEvent<T extends EventType> = BaseEvent<T, EventPayload<T>>;

// =============================================================================
// CONTEXT TYPE INFERENCE
// =============================================================================

/**
 * Get the context type for a specific event type
 *
 * @example
 * type CrmStageContext = EventContextFor<"crm.stage.changed">;
 * // Results in: "client"
 */
export type EventContextFor<T extends EventType> =
  (typeof EVENT_REGISTRY)[T]["contextType"];

/**
 * Filter event types by context type
 *
 * @example
 * type OrgEvents = EventTypesByContext<"org">;
 * // Results in: "bot.created" | "bot.updated" | "crm.pipeline.created" | ...
 */
export type EventTypesByContext<C extends EventContextType> = {
  [K in EventType]: (typeof EVENT_REGISTRY)[K]["contextType"] extends C
    ? K
    : never;
}[EventType];

// =============================================================================
// DISCRIMINATED UNION TYPE
// =============================================================================

/**
 * Discriminated union of all event types
 *
 * Enables type-safe event consumption without casting.
 * Use with type narrowing via event.type checks.
 *
 * @example
 * ```ts
 * function handleEvent(event: AnyEvent) {
 *   if (event.type === "crm.stage.changed") {
 *     // event.payload is CrmStageChangedPayload
 *     console.log(event.payload.pipelineId);
 *   }
 * }
 * ```
 */
export type AnyEvent = {
  [K in EventType]: TypedEvent<K>;
}[EventType];

/**
 * Type guard for checking specific event types
 *
 * @example
 * ```ts
 * if (isEventType(event, "crm.stage.changed")) {
 *   // event is TypedEvent<"crm.stage.changed">
 * }
 * ```
 */
export function isEventType<T extends EventType>(
  event: { type: string },
  type: T
): event is TypedEvent<T> {
  return event.type === type;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the context type for an event type at runtime
 */
export function getEventContextType(eventType: EventType): EventContextType {
  return EVENT_REGISTRY[eventType].contextType;
}

/**
 * Get the log context for an event type at runtime
 *
 * Derives log context from the event category:
 * - "bot" → "botEvent"
 * - "crm" → "crmEvent"
 * - "interaction" → "interactionEvent"
 * etc.
 */
export function getEventLogContext(eventType: EventType): string {
  const category = EVENT_REGISTRY[eventType].category;
  return `${category}Event`;
}

/**
 * Check if an event type requires client context
 */
export function requiresClientContext(eventType: EventType): boolean {
  const contextType = EVENT_REGISTRY[eventType].contextType;
  return contextType === "client" || contextType === "session";
}

/**
 * Check if an event type requires session context
 */
export function requiresSessionContext(eventType: EventType): boolean {
  return EVENT_REGISTRY[eventType].contextType === "session";
}

/**
 * Get all event types for a specific context type
 */
export function getEventTypesForContext(
  contextType: EventContextType
): EventType[] {
  return (Object.keys(EVENT_REGISTRY) as EventType[]).filter(
    (eventType) => EVENT_REGISTRY[eventType].contextType === contextType
  );
}
