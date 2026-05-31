/**
 * Core Event Types
 *
 * Base types and interfaces for the unified event system.
 * All events in the system extend these base types.
 *
 * @module schemas/events/core
 */

import { z } from "zod";

import { InteractionEventTypeValues } from "./event-types";

// =============================================================================
// EVENT SOURCE
// =============================================================================

/**
 * Source that triggered an event
 * Used for tracking and filtering events by origin
 */
export const EventSourceSchema = z.enum([
  "journey", // From journey engine (node execution)
  "crm", // From CRM UI/API operations
  "automation", // From automation trigger
  "webhook", // From external webhook
  "system", // From internal system operations
  "manual", // From manual user action via UI
]);

export type EventSource = z.infer<typeof EventSourceSchema>;

// =============================================================================
// EVENT METADATA
// =============================================================================

/**
 * Standardized metadata structure for events
 * Provides consistent structure for event context and tracing
 */
export const EventMetadataSchema = z.object({
  // Request context
  requestId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),

  // Journey engine specific
  adapter: z.string().optional(),
  nodeId: z.string().optional(),
  nodeName: z.string().optional(),

  // Custom application data (for arbitrary extension)
  custom: z.record(z.string(), z.unknown()).optional(),
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;

// =============================================================================
// BASE EVENT
// =============================================================================

/**
 * Base event structure - all events extend this
 *
 * The event bus validates and routes events based on this structure.
 * Payload is typed per-event-type via the registry.
 */
export const BaseEventSchema = z.object({
  // Identity
  id: z.string().uuid(),
  type: z.string().min(1),
  timestamp: z.iso.datetime(),

  // Schema versioning - for future schema evolution
  version: z.number().int().positive().default(1),

  // Context - required (UUID validated for data integrity)
  organizationId: z.string().uuid("organizationId must be a valid UUID"),

  // Context - optional (UUID validated when present)
  clientId: z.string().uuid("clientId must be a valid UUID").optional(),
  sessionId: z.string().uuid("sessionId must be a valid UUID").optional(),
  journeyId: z.string().uuid("journeyId must be a valid UUID").optional(),

  // Source tracking
  source: EventSourceSchema,
  performedBy: z.string().optional(),

  // Ordering - for detecting missed events and maintaining order
  // Required: DB schema has NOT NULL constraint, all publishers must provide via getNextSequence()
  sequence: z.number().int().positive(),

  // Tracing - for linking related events
  correlationId: z.string().uuid().optional(),
  causedBy: z.string().uuid().optional(),

  // Payload - validated per event type
  payload: z.unknown(),

  // Metadata - standardized structure
  metadata: EventMetadataSchema.optional(),
});

/**
 * Base event type with generic type and payload parameters.
 * Inferred from BaseEventSchema with overrides for type and payload.
 */
export type BaseEvent<T extends string = string, P = unknown> = Omit<z.infer<typeof BaseEventSchema>, "type" | "payload"> & {
  type: T;
  payload: P;
};

// =============================================================================
// INTERACTION EVENT TYPES (Engine Events)
// =============================================================================

/**
 * Interaction event types used by the journey engine
 *
 * These are atomic events that occur during journey execution.
 * Values are derived from InteractionEventTypes in event-types.ts (single source of truth).
 *
 * Naming Convention:
 * - engine.*     - Journey engine operations (message, transition, error)
 * - session.*    - Session state changes (tags, variables)
 * - timer.*      - Timer operations (expired, followup)
 * - journey.*    - Journey-level operations (teleport, crm)
 * - mindstate.*  - Mindstate changes
 * - llm.*        - LLM-specific operations (hitl, guard)
 * - user.*       - User-initiated actions (message, click)
 */
export const InteractionEventTypeSchema = z.enum(InteractionEventTypeValues);

export type InteractionEventType = z.infer<typeof InteractionEventTypeSchema>;

/**
 * Simple interaction event for session history
 * Used by the journey engine for in-session event tracking.
 * Simpler than EngineEvent - doesn't require organizationId/source/etc.
 */
export const InteractionEventSchema = z.object({
  id: z.string(),
  timestamp: z.iso.datetime(),
  type: InteractionEventTypeSchema,
  nodeId: z.string(),
  payload: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type InteractionEvent = z.infer<typeof InteractionEventSchema>;

/**
 * Engine event - BaseEvent typed for journey engine interactions
 * Used by session-engine for journey execution events
 */
export type EngineEvent<P = unknown> = BaseEvent<InteractionEventType, P> & {
  /** Node ID where the event occurred */
  nodeId: string;
};

/**
 * Engine event schema for validation
 */
export const EngineEventSchema = BaseEventSchema.extend({
  type: InteractionEventTypeSchema,
  nodeId: z.string(),
});

// =============================================================================
// ENRICHED EVENT (SSE Streaming)
// =============================================================================

/**
 * Enriched event schema for validation
 * Extends BaseEvent with display metadata computed by SSE consumer
 */
export const EnrichedEventSchema = BaseEventSchema.extend({
  /** Journey name (fetched from DB) */
  journeyName: z.string().optional(),
  /** Node ID from the event payload or metadata */
  nodeId: z.string().optional(),
});

/**
 * Enriched event for SSE streaming to frontend
 * Inferred from EnrichedEventSchema for type safety
 */
export type EnrichedEvent = z.infer<typeof EnrichedEventSchema>;

// =============================================================================
// EVENT CATEGORIES
// =============================================================================

/**
 * Event categories for grouping and filtering
 */
export const EventCategorySchema = z.enum([
  "bot", // Bot lifecycle events
  "crm", // CRM operations (stages, pipelines, fields)
  "tag", // Tag operations
  "variable", // Variable operations
  "journey", // Journey session lifecycle
  "interaction", // Journey engine events (messages, transitions)
  "workflow", // Agent workflow execution events
  "mindstate", // Mindstate definition events
  "system", // System-level events
]);

export type EventCategory = z.infer<typeof EventCategorySchema>;

// =============================================================================
// EVENT CONSUMER TYPES
// =============================================================================

/**
 * Event consumers that can receive events
 * Used in registry to declare routing
 */
export const EventConsumerSchema = z.enum([
  "sse", // Real-time streaming to frontend (Redis pub/sub)
  "automation", // Automation trigger queue (BullMQ)
  "log", // Database persistence for history
]);

export type EventConsumer = z.infer<typeof EventConsumerSchema>;

// =============================================================================
// LOG LEVELS
// =============================================================================

/**
 * Log level for event types
 * Used for filtering and display in Events UI
 */
export const EventLogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export type EventLogLevel = z.infer<typeof EventLogLevelSchema>;
