/**
 * Simulator Constants and Types
 *
 * Single source of truth for all simulator-related constants.
 * Used by both backend (API) and frontend (Web) to ensure consistency.
 *
 * @module @journey/schemas/simulator
 */

import { z } from "zod";
import { IsoTimestampSchema } from "./utils";

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * SSE event types published by the SimulatorAdapter.
 *
 * Note: Bot messages are delivered via system.message events from the
 * engine's event stream, not via simulator-specific events.
 */
export const SIMULATOR_EVENTS = {
  /** Timer was scheduled (follow-up or timeout) */
  TIMER_SCHEDULED: "simulator.timer_scheduled",
  /** Timer completed and fired */
  TIMER_FIRED: "simulator.timer_fired",
  /** Timer was cancelled (e.g., user responded before timeout) */
  TIMER_CANCELLED: "simulator.timer_cancelled",
} as const;

export type SimulatorEventType = (typeof SIMULATOR_EVENTS)[keyof typeof SIMULATOR_EVENTS];

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Simulator configuration constants
 */
export const SIMULATOR_CONFIG = {
  /** Session timeout - 30 minutes of inactivity */
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,
  /** Redis pub/sub channel prefix */
  REDIS_CHANNEL_PREFIX: "events:",
  /** Platform identifier for simulator clients */
  PLATFORM: "simulator",
  /** Platform user ID for anonymous simulator client (one per org) */
  ANONYMOUS_PLATFORM_USER_ID: "anonymous",
} as const;

// =============================================================================
// ID GENERATORS
// =============================================================================

/**
 * Generate a unique client ID for simulator sessions
 * Format: simulator_{timestamp}_{random}
 */
export const generateSimulatorClientId = (): string => {
  const cryptoRef =
    typeof globalThis !== "undefined" && "crypto" in globalThis
      ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;

  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

// =============================================================================
// CHANNEL HELPERS
// =============================================================================

/**
 * Get the Redis pub/sub channel for an organization's events
 */
export const getSimulatorChannel = (organizationId: string): string =>
  `${SIMULATOR_CONFIG.REDIS_CHANNEL_PREFIX}${organizationId}`;

// =============================================================================
// EVENT PAYLOAD TYPES (with Zod schemas for SSE validation)
// =============================================================================

/**
 * Base event structure for all simulator SSE events
 */
export const SimulatorEventBaseSchema = z.object({
  type: z.enum([
    SIMULATOR_EVENTS.TIMER_SCHEDULED,
    SIMULATOR_EVENTS.TIMER_FIRED,
    SIMULATOR_EVENTS.TIMER_CANCELLED,
  ]),
  sessionId: z.string(),
  timestamp: IsoTimestampSchema,
});

export interface SimulatorEventBase {
  type: SimulatorEventType;
  sessionId: string;
  timestamp: string;
}

/**
 * Timer scheduled event payload
 */
export const SimulatorTimerScheduledPayloadSchema = z.object({
  timerId: z.string(),
  edgeId: z.string(),
  durationMs: z.number(),
  firesAt: IsoTimestampSchema,
});

export interface SimulatorTimerScheduledPayload {
  timerId: string;
  edgeId: string;
  durationMs: number;
  firesAt: string;
}

/**
 * Timer fired event payload
 */
export const SimulatorTimerFiredPayloadSchema = z.object({
  edgeId: z.string(),
  scheduledAt: IsoTimestampSchema,
});

export interface SimulatorTimerFiredPayload {
  edgeId: string;
  scheduledAt: string;
}

/**
 * Timer cancelled event payload
 */
export const SimulatorTimerCancelledPayloadSchema = z.object({
  timerId: z.string(),
  edgeId: z.string(),
});

export interface SimulatorTimerCancelledPayload {
  timerId: string;
  edgeId: string;
}

/**
 * Union type for all simulator event payloads.
 * Timer-related payloads only - messages are delivered via system.message events.
 */
export const SimulatorEventPayloadSchema = z.union([
  SimulatorTimerScheduledPayloadSchema,
  SimulatorTimerFiredPayloadSchema,
  SimulatorTimerCancelledPayloadSchema,
]);

export type SimulatorEventPayload =
  | SimulatorTimerScheduledPayload
  | SimulatorTimerFiredPayload
  | SimulatorTimerCancelledPayload;

/**
 * Full simulator event with typed payload and debug state.
 *
 * The _debug field is enriched by the backend SimulatorAdapter
 * to provide visibility into engine state for the simulator UI.
 */
export interface SimulatorEvent<T extends SimulatorEventPayload = SimulatorEventPayload>
  extends SimulatorEventBase {
  payload: T;
  /** Debug state enrichment (populated by SimulatorAdapter) */
  _debug?: SimulatorDebugState;
}

// =============================================================================
// DEBUG STATE (with Zod schema for SSE validation)
// =============================================================================

/**
 * Debug state enrichment for simulator SSE events.
 * Provides visibility into engine state for the simulator UI.
 *
 * @see Used by SimulatorAdapter.publishEvent() to enrich events
 * @see Consumed by frontend's use-backend-simulator hook
 */
export const SimulatorDebugStateSchema = z.object({
  /** Current node ID in the journey */
  currentNodeId: z.string().optional(),
  /** Active timers with their fire times */
  pendingTimers: z.array(z.object({
    edgeId: z.string(),
    firesAt: IsoTimestampSchema,
  })).optional(),
  /**
   * Generic plugin debug states.
   * Each plugin type registers its debug state under its pluginType key.
   * @example { followup: [...], analytics: {...} }
   */
  pluginStates: z.record(z.string(), z.unknown()).optional(),
  /** Journey context variables */
  variables: z.record(z.string(), z.unknown()).optional(),
  /** Client tags */
  tags: z.array(z.string()).optional(),
});

export interface SimulatorDebugState {
  /** Current node ID in the journey */
  currentNodeId?: string;
  /** Active timers with their fire times */
  pendingTimers?: Array<{
    edgeId: string;
    firesAt: string;
  }>;
  /**
   * Generic plugin debug states.
   * Each plugin type registers its debug state under its pluginType key.
   */
  pluginStates?: Record<string, unknown>;
  /** Journey context variables */
  variables?: Record<string, unknown>;
  /** Client tags */
  tags?: string[];
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input types that can be sent to the simulator engine.
 * Used by frontend API client and backend routes for type-safe input handling.
 */
export type SimulatorInput =
  | { type: "text"; text: string }
  | { type: "button_click"; buttonId: string }
  | { type: "timeout"; edgeId: string };

// =============================================================================
// ZOD VALIDATION SCHEMAS
// =============================================================================

/**
 * Zod schema for simulator execute event validation.
 * Used by the /simulator/execute endpoint to validate input.
 */
export const SimulatorExecuteEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().min(1, "Text message cannot be empty"),
  }),
  z.object({
    type: z.literal("button_click"),
    buttonId: z.string().min(1, "Button ID is required"),
  }),
  z.object({
    type: z.literal("timeout"),
    edgeId: z.string().min(1, "Edge ID is required"),
  }),
]);

/**
 * Zod schema for the full execute request body.
 */
export const SimulatorExecuteRequestSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  event: SimulatorExecuteEventSchema,
});

export type SimulatorExecuteRequest = z.infer<typeof SimulatorExecuteRequestSchema>;
export type SimulatorExecuteEvent = z.infer<typeof SimulatorExecuteEventSchema>;

/**
 * Schema for creating a new simulator session
 * POST /simulator/sessions
 */
export const CreateSimulatorSessionSchema = z.object({
  journeyId: z.string().uuid("Invalid journey ID"),
  startNodeId: z.string().optional(),
  personaId: z.string().uuid("Invalid persona ID").optional(),
  clientProfile: z.record(z.string(), z.unknown()).optional(),
});

export type CreateSimulatorSession = z.infer<typeof CreateSimulatorSessionSchema>;

/**
 * Schema for skipping a timer
 * POST /simulator/timers/:edgeId/skip
 */
export const SkipTimerRequestSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
});

export type SkipTimerRequest = z.infer<typeof SkipTimerRequestSchema>;

/**
 * Schema for creating a simulator persona
 * POST /simulator/personas
 */
export const CreatePersonaRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  profile: z.record(z.string(), z.unknown()).optional(),
  userVars: z.record(z.string(), z.unknown()).optional(),
});

export type CreatePersonaRequest = z.infer<typeof CreatePersonaRequestSchema>;

/**
 * Schema for updating a simulator persona
 * PUT /simulator/personas/:id
 */
export const UpdatePersonaRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  profile: z.record(z.string(), z.unknown()).optional(),
  userVars: z.record(z.string(), z.unknown()).optional(),
});

export type UpdatePersonaRequest = z.infer<typeof UpdatePersonaRequestSchema>;

// =============================================================================
// PLAYBACK MODE (IMPERSONATE)
// =============================================================================

/**
 * Session metadata stored in clients.metadata JSONB column.
 * Used to track playback mode and prevent real messages during impersonate.
 */
export const SessionMetadataSchema = z.object({
  isPlaybackMode: z.boolean().optional(),
  playbackStartedAt: z.string().optional(),
  playbackUserId: z.string().optional(),
});

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

/**
 * Request body for setting playback mode on a session.
 * POST /simulator/sessions/:id/playback
 */
export const SetPlaybackModeSchema = z.object({
  enabled: z.boolean(),
});

export type SetPlaybackModeRequest = z.infer<typeof SetPlaybackModeSchema>;

/**
 * Response for playback mode status.
 * GET /simulator/sessions/:id/playback
 */
export const PlaybackModeStatusSchema = z.object({
  playbackMode: z.boolean(),
  startedAt: z.string().optional(),
  userId: z.string().optional(),
});

export type PlaybackModeStatus = z.infer<typeof PlaybackModeStatusSchema>;
