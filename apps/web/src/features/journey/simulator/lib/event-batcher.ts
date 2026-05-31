/**
 * Event Batcher
 *
 * Optimized event batching for high-frequency simulator events.
 * Uses RequestAnimationFrame to batch events and prevent UI thrashing.
 *
 * @module features/journey/simulator/lib/event-batcher
 */

import { type InteractionEvent } from "@journey/schemas";

type BatchCallback = (events: InteractionEvent[]) => void;

export class EventBatcher {
  private queue: InteractionEvent[] = [];
  private rafId: number | null = null;
  private readonly callback: BatchCallback;

  constructor(callback: BatchCallback) {
    this.callback = callback;
  }

  /**
   * Add an event to the batch queue
   */
  public add(event: InteractionEvent): void {
    this.queue.push(event);

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.flush);
    }
  }

  /**
   * Flush pending events to the callback
   */
  private flush = (): void => {
    if (this.queue.length === 0) {
      this.rafId = null;
      return;
    }

    // Capture current queue and reset
    const batch = [...this.queue];
    this.queue = [];
    this.rafId = null;

    // Process batch
    this.callback(batch);
  };

  /**
   * Force immediate flush of pending events
   */
  public flushNow(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.flush();
  }

  /**
   * Clear pending events without processing
   */
  public clear(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.queue = [];
  }
}
