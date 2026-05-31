/**
 * Simulator Messaging Adapter
 *
 * Implements the MessagingAdapter interface for the backend simulator.
 * Instead of sending messages to Telegram, it publishes them to Redis
 * for SSE streaming to the frontend.
 *
 * Key differences from TelegramAdapter:
 * - sendMessage: Publishes to Redis channel for SSE instead of Telegram API
 * - scheduleTimer: Uses same BullMQ timers as production (100% parity)
 * - All callbacks use real DB operations
 *
 * @module adapters/simulator
 */

import type { MessagingAdapter, JourneyMessage, JourneyEvent, SendMessageResult } from "@journey/engine";
import { createLogger, serializeError } from "@journey/logger";
import {
  BadRequestError,
  ServiceUnavailableError,
  SIMULATOR_EVENTS,
  SIMULATOR_CONFIG,
  getSimulatorChannel,
  type SimulatorEventType,
  type SimulatorInput,
  type SimulatorDebugState,
} from "@journey/schemas";
import {
  scheduleTimer,
  cancelTimer,
  getActiveTimerBySessionAndEdge,
  createTimerJobData,
  type TimerJobData,
} from "../services/timers";
import { getRedisConnection } from "../lib/redis";

const log = createLogger("simulator-adapter");

// =============================================================================
// ADAPTER
// =============================================================================

/** Timer tracking info for debug state */
interface TimerInfo {
  jobId: string;
  firesAt: string;
}

export class SimulatorAdapter implements MessagingAdapter {
  readonly adapterType = "simulator" as const;
  private sessionId: string;
  private organizationId: string;
  private clientId: string;
  private messageHandler: ((event: JourneyEvent) => Promise<void>) | null = null;
  private log: ReturnType<typeof createLogger>;
  private timerMap: Map<string, TimerInfo> = new Map(); // edgeId -> TimerInfo

  // Debug state properties
  private currentNodeId: string = "";
  private variables: Record<string, unknown> = {};
  private tags: string[] = [];
  /** Generic plugin debug states - plugins register their state under their pluginType key */
  private pluginDebugStates: Record<string, unknown> = {};

  constructor(
    sessionId: string,
    organizationId: string,
    clientId: string,
    logger = createLogger("simulator-adapter")
  ) {
    this.sessionId = sessionId;
    this.organizationId = organizationId;
    this.clientId = clientId;
    this.log = logger.child({ adapterType: "simulator", sessionId, organizationId, clientId });
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Build the current debug state for event enrichment.
   *
   * Debug state includes:
   * - currentNodeId: Current position in the journey
   * - pendingTimers: Active timers with their fire times
   * - variables: Journey context variables
   * - tags: Client tags
   */
  private buildDebugState(): SimulatorDebugState {
    // Build pending timers from timerMap
    const pendingTimers = Array.from(this.timerMap.entries()).map(([edgeId, info]) => ({
      edgeId,
      firesAt: info.firesAt,
    }));

    return {
      currentNodeId: this.currentNodeId,
      pendingTimers,
      // Generic plugin debug states (includes follow-up under "followup" key)
      pluginStates: this.pluginDebugStates,
      variables: this.variables,
      tags: this.tags,
    };
  }

  /**
   * Publish an event to Redis for SSE streaming.
   * All events are enriched with _debug state for simulator UI.
   */
  private async publishEvent(
    type: SimulatorEventType,
    payload: Record<string, unknown>
  ): Promise<void> {
    const redis = getRedisConnection();
    const channel = getSimulatorChannel(this.organizationId);

    await redis.publish(
      channel,
      JSON.stringify({
        type,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        payload,
        _debug: this.buildDebugState(),
      })
    );

    this.log.debug({ type, channel }, "simulator:publishEvent");
  }

  /**
   * Get message type for SendMessageResult
   */
  private getMessageType(message: JourneyMessage): "text" | "photo" | "video" | "buttons" {
    if (message.buttons?.length) return "buttons";
    if (message.media?.type === "image") return "photo";
    if (message.media?.type === "video") return "video";
    return "text";
  }

  // ===========================================================================
  // DEBUG STATE MANAGEMENT
  // ===========================================================================

  /**
   * Update the debug state from engine state.
   *
   * This should be called by the session manager after engine operations
   * to keep the adapter's debug state in sync with the engine.
   *
   * @param state - Partial debug state to merge
   */
  updateDebugState(state: Partial<SimulatorDebugState>): void {
    if (state.currentNodeId !== undefined) {
      this.currentNodeId = state.currentNodeId;
    }
    if (state.variables !== undefined) {
      this.variables = state.variables;
    }
    if (state.tags !== undefined) {
      this.tags = state.tags;
    }
    // Handle generic plugin states (includes follow-up under "followup" key)
    if (state.pluginStates !== undefined) {
      this.pluginDebugStates = { ...this.pluginDebugStates, ...state.pluginStates };
    }
    // Note: pendingTimers is derived from timerMap, not set externally

    const followUpCount = (this.pluginDebugStates["followup"] as unknown[])?.length ?? 0;
    this.log.debug(
      { currentNodeId: this.currentNodeId, timerCount: this.timerMap.size, followUpCount },
      "simulator:debugStateUpdated"
    );
  }

  /**
   * Get the current debug state (for external access if needed)
   */
  getDebugState(): SimulatorDebugState {
    return this.buildDebugState();
  }

  /**
   * Publish a debug state update event.
   *
   * Called after session state changes (e.g., after engine processing) to notify
   * the frontend of updated debug info. This is necessary because engine events
   * (via sseConsumer) don't include _debug state - only adapter events do.
   *
   * Use case: When a follow-up plugin is scheduled during engine execution,
   * the frontend needs to be notified so it can display the pending timer.
   */
  async publishDebugStateUpdate(): Promise<void> {
    const redis = getRedisConnection();
    const channel = getSimulatorChannel(this.organizationId);

    await redis.publish(
      channel,
      JSON.stringify({
        type: "simulator.debug_update",
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        payload: {},
        _debug: this.buildDebugState(),
      })
    );

    const followUpCount = (this.pluginDebugStates["followup"] as unknown[])?.length ?? 0;
    this.log.debug(
      { channel, followUpCount },
      "simulator:debugStateUpdate:published"
    );
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Send a message to the simulator UI
   *
   * Instead of calling Telegram API, we publish to Redis for SSE streaming.
   * The frontend subscribes to `events:{orgId}` and receives messages in real-time.
   */
  async sendMessage(userId: string, message: JourneyMessage): Promise<SendMessageResult> {
    const messageId = crypto.randomUUID();

    this.log.trace(
      {
        userId,
        messageType: message.type,
        content: message.content?.substring(0, 100),
        hasMedia: !!message.media,
        buttonCount: message.buttons?.length ?? 0,
      },
      "simulator:trace:sendMessage"
    );

    try {
      // NOTE: We don't publish BOT_MESSAGE events here.
      // Messages are delivered via system.message events from the engine's
      // event stream, which the frontend subscribes to via SSE.
      // This avoids duplicate messages and keeps the data flow simple.

      this.log.info(
        { userId, type: message.type, buttons: message.buttons?.length ?? 0, messageId },
        "simulator:sendMessage:success"
      );

      return {
        success: true,
        messageIds: [{ platformMessageId: messageId, messageType: this.getMessageType(message) }],
      };
    } catch (error) {
      this.log.error({ userId, err: serializeError(error) }, "simulator:sendMessage:error");
      const message = error instanceof Error ? error.message : "Send message failed";
      return { success: false, messageIds: [], error: message };
    }
  }

  /**
   * Register callback for incoming events
   */
  onMessage(callback: (event: JourneyEvent) => Promise<void>): void {
    this.messageHandler = callback;
  }

  /**
   * Unregister callback for incoming events
   */
  offMessage(callback: (event: JourneyEvent) => Promise<void>): void {
    if (this.messageHandler === callback) {
      this.messageHandler = null;
    }
  }

  /**
   * Cleanup adapter resources
   */
  dispose(): void {
    this.messageHandler = null;
    this.timerMap.clear();
  }

  /**
   * Inject an event into the engine (called by simulator routes)
   *
   * This is how the frontend "sends messages" to the simulator:
   * 1. Frontend calls POST /api/simulator/execute with event payload
   * 2. SimulatorSessionManager calls adapter.handleInput()
   * 3. This method converts input to JourneyEvent and calls messageHandler
   */
  async handleInput(input: SimulatorInput): Promise<void> {
    if (!this.messageHandler) {
      throw new ServiceUnavailableError("Simulator adapter not initialized: no message handler registered");
    }

    let event: JourneyEvent;

    if (input.type === "button_click") {
      event = {
        type: "button_click",
        userId: this.clientId,
        sessionId: this.sessionId,
        payload: { buttonId: input.buttonId },
        timestamp: new Date().toISOString(),
      };
    } else if (input.type === "text") {
      event = {
        type: "message",
        userId: this.clientId,
        sessionId: this.sessionId,
        payload: { text: input.text },
        timestamp: new Date().toISOString(),
      };
    } else if (input.type === "timeout") {
      event = {
        type: "timeout",
        userId: this.clientId,
        sessionId: this.sessionId,
        payload: { timerId: input.edgeId },
        timestamp: new Date().toISOString(),
      };
    } else {
      throw new BadRequestError(`Unknown simulator input type: ${(input as { type: string }).type}`);
    }

    this.log.trace({ eventType: event.type, payload: event.payload }, "simulator:trace:handleInput");

    // CRITICAL: Await the async handler to ensure state is updated before returning
    await this.messageHandler(event);
  }

  /**
   * Schedule a timer using BullMQ (same as production!)
   *
   * This is the key to production parity - we use the exact same
   * BullMQ timer infrastructure as TelegramAdapter.
   */
  async scheduleTimer(sessionId: string, durationMs: number, edgeId: string): Promise<string> {
    this.log.trace(
      {
        sessionId,
        edgeId,
        durationMs,
        durationSec: durationMs / 1000,
        scheduledAt: new Date().toISOString(),
      },
      "simulator:trace:scheduleTimer"
    );

    const jobData = createTimerJobData({
      sessionId,
      edgeId,
      channelId: null, // Simulator sessions don't need a channel
      telegramUserId: this.clientId,
      adapterType: SIMULATOR_CONFIG.PLATFORM,
    });

    try {
      const jobId = await scheduleTimer(jobData, durationMs);
      const firesAt = new Date(Date.now() + durationMs).toISOString();

      // Store timer info for debug state
      this.timerMap.set(edgeId, { jobId, firesAt });

      await this.publishEvent(SIMULATOR_EVENTS.TIMER_SCHEDULED, {
        timerId: jobId,
        edgeId,
        durationMs,
        firesAt,
      });

      this.log.info({ sessionId, edgeId, durationMs, jobId }, "simulator:scheduleTimer:success");
      return jobId;
    } catch (error) {
      this.log.error(
        { sessionId, edgeId, durationMs, err: serializeError(error) },
        "simulator:scheduleTimer:error"
      );
      throw error;
    }
  }

  /**
   * Cancel a timer
   *
   * Uses in-memory lookup first (fast path), then falls back to database query
   * for robust cancellation after server restart.
   */
  async cancelTimer(timerId: string, edgeId: string, sessionId: string): Promise<boolean> {
    this.log.trace(
      { timerId, edgeId, sessionId, timerMapSize: this.timerMap.size },
      "simulator:trace:cancelTimer"
    );

    // Fast path: try in-memory lookup by edgeId
    const timerInfo = this.timerMap.get(edgeId);

    if (timerInfo) {
      try {
        const cancelled = await cancelTimer(timerInfo.jobId);
        if (cancelled) {
          this.timerMap.delete(edgeId);
          await this.publishEvent(SIMULATOR_EVENTS.TIMER_CANCELLED, { timerId: timerInfo.jobId, edgeId });
          this.log.info({ timerId, jobId: timerInfo.jobId, edgeId, sessionId }, "simulator:cancelTimer:success:memory");
        }
        return cancelled;
      } catch (error) {
        this.log.error({ timerId, jobId: timerInfo.jobId, edgeId, err: serializeError(error) }, "simulator:cancelTimer:error");
        throw error;
      }
    }

    // Fallback: query durableTimers table (handles server restart case)
    this.log.debug({ timerId, edgeId, sessionId }, "simulator:cancelTimer:fallbackToDb");

    try {
      const timer = await getActiveTimerBySessionAndEdge(sessionId, edgeId);
      if (timer?.bullmqJobId) {
        const cancelled = await cancelTimer(timer.bullmqJobId);
        if (cancelled) {
          await this.publishEvent(SIMULATOR_EVENTS.TIMER_CANCELLED, { timerId: timer.bullmqJobId, edgeId });
          this.log.info({ timerId, edgeId, sessionId, jobId: timer.bullmqJobId }, "simulator:cancelTimer:success:db");
        }
        return cancelled;
      }
      this.log.debug({ timerId, edgeId, sessionId }, "simulator:cancelTimer:notFoundInDb");
      return false;
    } catch (error) {
      this.log.error({ timerId, edgeId, sessionId, err: serializeError(error) }, "simulator:cancelTimer:dbError");
      throw error;
    }
  }

  /**
   * Handle a timer firing (called by the timer handler worker)
   *
   * This injects a timeout event into the engine, causing it to
   * process the wait edge transition.
   */
  async handleTimerFired(data: TimerJobData): Promise<void> {
    // Clear from timerMap to prevent memory leak (timer is no longer active)
    this.timerMap.delete(data.edgeId);

    this.log.trace(
      {
        sessionId: data.sessionId,
        edgeId: data.edgeId,
        scheduledAt: data.scheduledAt,
        hasMessageHandler: !!this.messageHandler,
        timerMapSize: this.timerMap.size,
      },
      "simulator:trace:handleTimerFired"
    );

    await this.publishEvent(SIMULATOR_EVENTS.TIMER_FIRED, {
      edgeId: data.edgeId,
      scheduledAt: data.scheduledAt,
    });

    if (this.messageHandler) {
      // Use data.timerId (actual BullMQ job ID) for proper follow-up timer lookup and stale detection
      const event: JourneyEvent = {
        type: "timeout",
        userId: this.clientId,
        sessionId: data.sessionId,
        payload: { timerId: data.timerId },
        timestamp: new Date().toISOString(),
      };

      this.log.trace({ eventType: event.type, timerId: data.edgeId, sessionId: data.sessionId }, "simulator:trace:timeoutEvent");

      // CRITICAL: Await the async handler
      await this.messageHandler(event);
    }
  }

  /**
   * Clear the timer map (for cleanup)
   */
  clearTimerMap(): void {
    const size = this.timerMap.size;
    this.timerMap.clear();
    this.log.debug({ previousSize: size }, "simulator:timerMap:cleared");
  }
}
