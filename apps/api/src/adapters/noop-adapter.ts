/**
 * No-Op Messaging Adapter
 *
 * A messaging adapter that doesn't actually send messages.
 * Used for channel-less automations where the journey only performs
 * actions like setting tags/variables without needing to send messages.
 *
 * @module adapters/noop-adapter
 */

import { createLogger } from "@journey/logger";
import type { JourneyEvent, JourneyMessage, MessagingAdapter, SendMessageResult } from "@journey/engine";

const log = createLogger("noop-adapter");

/**
 * No-Op Messaging Adapter
 *
 * Used when:
 * - An automation triggers a journey without a channel
 * - The journey doesn't require actual message delivery
 *
 * Message nodes will log a warning but won't fail the journey.
 */
export class NoOpAdapter implements MessagingAdapter {
  readonly adapterType = "mock" as const; // Using "mock" for channel-less automations

  private sessionId: string;
  private messageHandler: ((event: JourneyEvent) => Promise<void>) | null = null;
  private timerIdCounter = 0;
  private scheduledTimers: Map<string, { timeout: ReturnType<typeof setTimeout>; edgeId: string }> = new Map();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Register a message handler
   */
  onMessage(handler: (event: JourneyEvent) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /**
   * Unregister a message handler
   */
  offMessage(handler: (event: JourneyEvent) => Promise<void>): void {
    if (this.messageHandler === handler) {
      this.messageHandler = null;
    }
  }

  /**
   * Send a message - logs warning but doesn't actually send
   * Returns empty messageIds since no actual messages are sent
   */
  async sendMessage(userId: string, message: JourneyMessage): Promise<SendMessageResult> {
    log.warn(
      {
        sessionId: this.sessionId,
        userId,
        messageType: message.type,
        content: typeof message.content === "string" ? message.content.substring(0, 50) : "[complex content]",
      },
      "noopAdapter:sendMessage:noChannel"
    );
    // Don't throw - allow the journey to continue
    // Return success with empty messageIds since we didn't actually send anything
    return { success: true, messageIds: [] };
  }

  /**
   * Schedule a timer - uses in-memory setTimeout
   * Note: These timers won't survive process restarts
   * Returns immediately as setTimeout is synchronous (timer scheduling is instant)
   */
  async scheduleTimer(sessionId: string, delayMs: number, edgeId: string): Promise<string> {
    const timerId = `noop_timer_${++this.timerIdCounter}_${Date.now()}`;

    const timeout = setTimeout(async () => {
      this.scheduledTimers.delete(timerId);
      if (this.messageHandler) {
        // Properly await the async handler
        await this.messageHandler({
          type: "timeout",
          userId: "", // No user in channel-less context
          sessionId,
          timestamp: new Date().toISOString(),
          payload: { timerId },
        });
      }
    }, delayMs);

    this.scheduledTimers.set(timerId, { timeout, edgeId });

    log.debug(
      {
        sessionId,
        timerId,
        delayMs,
        edgeId,
      },
      "noopAdapter:scheduleTimer"
    );

    return timerId;
  }

  /**
   * Cancel a timer
   */
  async cancelTimer(timerId: string, _edgeId: string, _sessionId: string): Promise<boolean> {
    const entry = this.scheduledTimers.get(timerId);
    if (entry) {
      clearTimeout(entry.timeout);
      this.scheduledTimers.delete(timerId);
      log.debug({ timerId }, "noopAdapter:cancelTimer");
      return true;
    }
    return false;
  }

  /**
   * Cleanup all timers when adapter is no longer needed
   */
  cleanup(): void {
    for (const entry of this.scheduledTimers.values()) {
      clearTimeout(entry.timeout);
    }
    this.scheduledTimers.clear();
    log.debug({ sessionId: this.sessionId }, "noopAdapter:cleanup");
  }

  /**
   * Cleanup adapter resources
   */
  dispose(): void {
    this.messageHandler = null;
    this.cleanup();
  }
}
