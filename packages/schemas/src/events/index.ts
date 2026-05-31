/**
 * Unified Event System
 *
 * A comprehensive event system for cross-module communication and activity tracking.
 *
 * ## Event Architecture
 *
 * ### Event Types by Category
 * | Category     | Events                           | Purpose                     |
 * |--------------|----------------------------------|-----------------------------|
 * | bot          | started, stopped, error          | Bot lifecycle               |
 * | crm          | stage.moved, field.updated, etc. | CRM operations              |
 * | tag          | added, removed                   | User tag operations         |
 * | variable     | set, deleted, incremented        | Variable changes            |
 * | journey      | session.*, node.*                | Journey execution           |
 * | interaction  | user.*, engine.*, timer.*        | Real-time interactions      |
 * | workflow     | started, completed, step.*       | Agent workflow execution    |
 *
 * ### Event Flow
 * ```
 * Publisher                    Event Bus                   Consumers
 * ┌─────────────┐            ┌──────────┐            ┌─────────────┐
 * │ Engine      │──publish──>│ Validate │──route──>  │ SSE (live)  │
 * │ Workflow    │            │ Register │            │ Automation  │
 * │ API Route   │            │ Route    │            │ DB Log      │
 * └─────────────┘            └──────────┘            └─────────────┘
 * ```
 *
 * ### Event Structure
 * ```typescript
 * interface BaseEvent {
 *   id: string;           // UUID
 *   type: string;         // Event type (e.g., "journey.session.started")
 *   timestamp: string;    // ISO datetime
 *   organizationId: string;
 *   source: EventSource;  // "journey" | "crm" | "automation" | ...
 *   sequence: number;     // For ordering
 *   payload: unknown;     // Typed per event type
 * }
 * ```
 *
 * ### Modules
 * - **core.ts**: Base event types and schemas
 * - **registry.ts**: Event type registration and metadata
 * - **typed-events.ts**: Type-safe event creation helpers
 * - **payloads/**: Event-specific payload schemas
 * - **event-types.ts**: String constants for event types
 * - **store-events.ts**: Frontend state management events
 *
 * @module schemas/events
 */

// Core types
export * from "./core";

// Event registry
export * from "./registry";

// Typed event helpers
export * from "./typed-events";

// Payload schemas
export * from "./payloads";

// Event type constants (for type-safe references)
export * from "./event-types";

// Store events (frontend state management, shareable with backend for sync)
export * from "./store-events";
