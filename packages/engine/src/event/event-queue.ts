/**
 * Event Queue
 *
 * Serializes event processing to prevent race conditions.
 *
 * Problem: When a user sends a message while a timeout is about to fire,
 * both events can be dispatched to the engine simultaneously. Even with
 * async timer cancellation, the timeout event may already be "in flight".
 *
 * Solution: Queue all events and process them one at a time (FIFO).
 * This ensures that:
 * 1. Events are processed sequentially
 * 2. Timer cancellation from event N completes before event N+1 processes
 * 3. Stale timeout events can be detected and discarded
 *
 * Error Handling: Uses catch-and-continue pattern to ensure a single
 * failed event doesn't stop processing of subsequent events.
 * Failed events are recorded to the Dead Letter Queue for analysis/retry.
 *
 * Performance: Uses a two-stack deque for O(1) amortized enqueue/dequeue
 * instead of O(n) Array.shift().
 */

import type { createLogger } from "@journey/logger";
import { ServiceUnavailableError } from "@journey/schemas";
import type { DlqService } from "../services/dlq-service";
import type { JourneyEvent } from "../types";

/**
 * Maximum retry attempts for DLQ persistence
 * Uses exponential backoff: 100ms, 200ms, 400ms
 */
const DLQ_MAX_RETRIES = 3;
const DLQ_BASE_DELAY_MS = 100;

/**
 * Overflow policy when queue reaches max size
 */
export type OverflowPolicy = "drop_oldest" | "drop_newest" | "reject";

/**
 * Efficient FIFO deque using two stacks
 *
 * Provides O(1) amortized push and shift operations,
 * compared to O(n) for Array.shift().
 */
class Deque<T> {
  private inbox: T[] = [];
  private outbox: T[] = [];

  push(item: T): void {
    this.inbox.push(item);
  }

  shift(): T | undefined {
    if (this.outbox.length === 0) {
      // Transfer all items from inbox to outbox (reverses order)
      while (this.inbox.length > 0) {
        this.outbox.push(this.inbox.pop()!);
      }
    }
    return this.outbox.pop();
  }

  get length(): number {
    return this.inbox.length + this.outbox.length;
  }

  clear(): void {
    this.inbox = [];
    this.outbox = [];
  }

  /** Remove and return the newest item (for drop_oldest policy) */
  dropOldest(): T | undefined {
    if (this.outbox.length > 0) {
      // Oldest items are at end of outbox (will be popped first normally)
      return this.outbox.pop();
    }
    // If outbox empty, oldest is at beginning of inbox
    if (this.inbox.length > 0) {
      return this.inbox.shift(); // O(n) but only when outbox empty
    }
    return undefined;
  }
}

/**
 * Context for DLQ recording
 * Provides session/journey info for failed events
 */
export interface DlqContext {
  sessionId: string;
  journeyId?: string;
  organizationId?: string;
  /** Get current node ID at time of failure */
  getCurrentNodeId?: () => string | undefined;
  /** Get session context snapshot at time of failure */
  getSessionContext?: () => Record<string, unknown> | undefined;
}

export interface EventQueueConfig {
  /** Logger for debugging queue operations */
  log?: ReturnType<typeof createLogger>;
  /** Dead Letter Queue service for failed events */
  dlq?: DlqService;
  /** Context for DLQ records */
  dlqContext?: DlqContext;
  /** Queue length threshold to emit backpressure signals */
  backpressureThreshold?: number;
  /** Callback for backpressure metrics */
  onBackpressure?: (info: { queueLength: number; eventType: JourneyEvent["type"] }) => void;
  /** Maximum queue length (default: 1000) */
  maxQueueLength?: number;
  /** Policy when queue is full (default: drop_oldest) */
  overflowPolicy?: OverflowPolicy;
}

export interface EventQueueLike {
  enqueue(event: JourneyEvent): Promise<void>;
  clear(): void;
  readonly pendingCount?: number;
  readonly isProcessing?: boolean;
}

export type EventQueueFactory = (
  processEvent: (event: JourneyEvent) => Promise<void>,
  config: EventQueueConfig
) => EventQueueLike;

export class EventQueue implements EventQueueLike {
  private queue = new Deque<JourneyEvent>();
  private processing = false;
  private processEvent: (event: JourneyEvent) => Promise<void>;
  private log?: ReturnType<typeof createLogger>;
  private dlq?: DlqService;
  private dlqContext?: DlqContext;
  private backpressureThreshold?: number;
  private onBackpressure?: (info: { queueLength: number; eventType: JourneyEvent["type"] }) => void;
  private maxQueueLength: number;
  private overflowPolicy: OverflowPolicy;

  constructor(processEvent: (event: JourneyEvent) => Promise<void>, config?: EventQueueConfig) {
    this.processEvent = processEvent;
    this.log = config?.log;
    this.dlq = config?.dlq;
    this.dlqContext = config?.dlqContext;
    this.backpressureThreshold = config?.backpressureThreshold;
    this.onBackpressure = config?.onBackpressure;
    this.maxQueueLength = config?.maxQueueLength ?? 1000;
    this.overflowPolicy = config?.overflowPolicy ?? "drop_oldest";
  }

  /**
   * Add an event to the queue and start processing if not already running.
   *
   * Events are processed in FIFO order. If the queue is already being
   * processed, the new event is simply added to the queue and will be
   * processed after the current event completes.
   *
   * If queue is at maxQueueLength, applies overflow policy:
   * - drop_oldest: Remove oldest event to make room
   * - drop_newest: Reject new event
   * - reject: Throw error
   */
  async enqueue(event: JourneyEvent): Promise<void> {
    // Handle overflow when at max capacity
    if (this.queue.length >= this.maxQueueLength) {
      switch (this.overflowPolicy) {
        case "drop_oldest": {
          const dropped = this.queue.dropOldest();
          this.log?.warn(
            { droppedEventType: dropped?.type, queueLength: this.queue.length, maxQueueLength: this.maxQueueLength },
            "eventQueue:overflow:droppedOldest"
          );
          break;
        }
        case "drop_newest":
          this.log?.warn(
            { droppedEventType: event.type, queueLength: this.queue.length, maxQueueLength: this.maxQueueLength },
            "eventQueue:overflow:droppedNewest"
          );
          return; // Don't add the new event
        case "reject":
          throw new ServiceUnavailableError(`Event queue at capacity (${this.maxQueueLength})`);
      }
    }

    this.queue.push(event);
    this.log?.trace(
      { eventType: event.type, queueLength: this.queue.length, isProcessing: this.processing },
      "eventQueue:enqueued"
    );
    if (this.backpressureThreshold && this.queue.length >= this.backpressureThreshold && this.onBackpressure) {
      try {
        this.onBackpressure({ queueLength: this.queue.length, eventType: event.type });
      } catch (error) {
        this.log?.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "eventQueue:backpressureCallbackFailed"
        );
      }
    }

    if (!this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Process all events in the queue sequentially.
   *
   * Uses catch-and-continue pattern: if an event fails, it's recorded
   * to the DLQ and processing continues with the next event.
   */
  private async processQueue(): Promise<void> {
    this.processing = true;
    this.log?.trace({ queueLength: this.queue.length }, "eventQueue:processingStarted");

    try {
      while (this.queue.length > 0) {
        const event = this.queue.shift()!;
        this.log?.trace({ eventType: event.type, remainingInQueue: this.queue.length }, "eventQueue:processingEvent");

        try {
          await this.processEvent(event);
        } catch (error) {
          // Log the error
          this.log?.error(
            { eventType: event.type, error: error instanceof Error ? error.message : String(error) },
            "eventQueue:processError"
          );

          // Record in DLQ if available
          // Wrap in try-catch to ensure DLQ errors don't stop queue processing
          if (this.dlq && this.dlqContext) {
            try {
              // Safely call getters - they might throw
              let currentNodeId: string | undefined;
              let sessionContext: Record<string, unknown> | undefined;

              try {
                currentNodeId = this.dlqContext.getCurrentNodeId?.();
              } catch (getterError) {
                this.log?.warn(
                  { error: getterError instanceof Error ? getterError.message : String(getterError) },
                  "eventQueue:getCurrentNodeId:failed"
                );
              }

              try {
                sessionContext = this.dlqContext.getSessionContext?.();
              } catch (getterError) {
                this.log?.warn(
                  { error: getterError instanceof Error ? getterError.message : String(getterError) },
                  "eventQueue:getSessionContext:failed"
                );
              }

              // Retry DLQ persistence with exponential backoff to handle transient failures
              let dlqSuccess = false;
              let lastDlqError: unknown;

              for (let attempt = 0; attempt < DLQ_MAX_RETRIES && !dlqSuccess; attempt++) {
                try {
                  await this.dlq.recordFailure(event, error instanceof Error ? error : new Error(String(error)), {
                    sessionId: this.dlqContext.sessionId,
                    journeyId: this.dlqContext.journeyId,
                    organizationId: this.dlqContext.organizationId,
                    currentNodeId,
                    sessionContext,
                  });
                  dlqSuccess = true;
                } catch (dlqError) {
                  lastDlqError = dlqError;
                  if (attempt < DLQ_MAX_RETRIES - 1) {
                    // Exponential backoff: 100ms, 200ms, 400ms
                    const delay = DLQ_BASE_DELAY_MS * Math.pow(2, attempt);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    this.log?.debug(
                      { attempt: attempt + 1, maxRetries: DLQ_MAX_RETRIES, delayMs: delay },
                      "eventQueue:dlqRetrying"
                    );
                  }
                }
              }

              if (!dlqSuccess) {
                // All retries exhausted - log error level (not just warning)
                this.log?.error(
                  {
                    error: lastDlqError instanceof Error ? lastDlqError.message : String(lastDlqError),
                    eventType: event.type,
                    sessionId: this.dlqContext.sessionId,
                    attemptsExhausted: DLQ_MAX_RETRIES,
                  },
                  "eventQueue:dlqRecordFailed:allRetriesExhausted"
                );
              }
            } catch (dlqError) {
              // Unexpected error in DLQ retry logic itself - log but continue processing
              this.log?.error(
                { error: dlqError instanceof Error ? dlqError.message : String(dlqError) },
                "eventQueue:dlqUnexpectedError"
              );
            }
          }

          // CONTINUE processing remaining events (catch-and-continue pattern)
          // This is the key change from the previous throw behavior
        }
      }
    } finally {
      this.processing = false;
      this.log?.trace({}, "eventQueue:processingComplete");
    }
  }

  /**
   * Clear all pending events from the queue.
   *
   * Use this when destroying the engine to prevent processing
   * events after cleanup has started.
   */
  clear(): void {
    const clearedCount = this.queue.length;
    this.queue.clear();
    this.log?.debug({ clearedCount }, "eventQueue:cleared");
  }

  /**
   * Get the number of events waiting to be processed.
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is currently processing events.
   */
  get isProcessing(): boolean {
    return this.processing;
  }
}
