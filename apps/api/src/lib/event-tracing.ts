/**
 * Event Tracing Context
 *
 * Uses AsyncLocalStorage to propagate correlationId and causedBy through
 * the request lifecycle. This enables linking related events without
 * explicitly passing context through every function call.
 *
 * @module lib/event-tracing
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { createLogger } from "@journey/logger";

const log = createLogger("event-tracing");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tracing context that propagates through async operations
 */
export interface TracingContext {
  /** Unique ID linking all events in a request/operation */
  correlationId: string;
  /** ID of the parent event (for causality chains) */
  causedBy?: string;
  /** Request metadata for debugging */
  requestId?: string;
  /** User agent from the request */
  userAgent?: string;
  /** IP address from the request */
  ipAddress?: string;
}

// =============================================================================
// ASYNC LOCAL STORAGE
// =============================================================================

/**
 * AsyncLocalStorage instance for tracing context
 * This is the core mechanism for propagating context through async operations
 */
const tracingStorage = new AsyncLocalStorage<TracingContext>();

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get the current tracing context
 * Returns undefined if called outside of a tracing context
 */
export function getTracingContext(): TracingContext | undefined {
  return tracingStorage.getStore();
}

/**
 * Get the current correlationId
 * Returns a new UUID if called outside of a tracing context
 * (ensures events always have a correlationId)
 */
export function getCorrelationId(): string {
  const context = tracingStorage.getStore();
  return context?.correlationId ?? randomUUID();
}

/**
 * Get the current causedBy event ID
 * Returns undefined if no parent event is set
 */
export function getCausedBy(): string | undefined {
  const context = tracingStorage.getStore();
  return context?.causedBy;
}

/**
 * Run a function within a tracing context
 *
 * @param context - Tracing context to use
 * @param fn - Function to run
 * @returns Result of the function
 */
export function runWithTracing<T>(context: TracingContext, fn: () => T): T {
  return tracingStorage.run(context, fn);
}

/**
 * Run an async function within a tracing context
 *
 * @param context - Tracing context to use
 * @param fn - Async function to run
 * @returns Promise resolving to the function result
 */
export async function runWithTracingAsync<T>(
  context: TracingContext,
  fn: () => Promise<T>
): Promise<T> {
  return tracingStorage.run(context, fn);
}

/**
 * Create a child context for a new event chain
 * Preserves correlationId but updates causedBy to link events
 *
 * @param parentEventId - ID of the parent event
 * @returns New context with updated causedBy
 */
export function createChildContext(parentEventId: string): TracingContext {
  const current = tracingStorage.getStore();
  return {
    correlationId: current?.correlationId ?? randomUUID(),
    causedBy: parentEventId,
    requestId: current?.requestId,
    userAgent: current?.userAgent,
    ipAddress: current?.ipAddress,
  };
}

/**
 * Initialize a new tracing context for an incoming request
 *
 * @param options - Optional context fields
 * @returns New tracing context
 */
export function createTracingContext(
  options: Partial<TracingContext> = {}
): TracingContext {
  const correlationId = options.correlationId ?? randomUUID();

  log.debug(
    { correlationId, requestId: options.requestId },
    "eventTracing:contextCreated"
  );

  return {
    correlationId,
    causedBy: options.causedBy,
    requestId: options.requestId,
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
  };
}

/**
 * Update the current context's causedBy field
 * This is used when an event causes another event
 *
 * @param eventId - ID of the event that caused the current operation
 */
export function setCausedBy(eventId: string): void {
  const context = tracingStorage.getStore();
  if (context) {
    context.causedBy = eventId;
  }
}

/**
 * Clear the causedBy field after handling an event
 * This prevents incorrectly linking unrelated events
 */
export function clearCausedBy(): void {
  const context = tracingStorage.getStore();
  if (context) {
    context.causedBy = undefined;
  }
}
