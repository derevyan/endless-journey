import type { JourneyEvent, JourneyMessage, MessagingAdapter, SendMessageResult } from "../../types";
import {
  type TimingProfile,
  TIMING_PROFILES,
  getThinkTime,
  getNetworkLatency,
  shouldDebounce,
  applyJitter,
} from "../../testing/timing-profiles";

interface SentMessage {
  userId: string;
  message: JourneyMessage;
  timestamp: number;
}

interface ScheduledTimer {
  timerId: string;
  sessionId: string;
  delayMs: number;
  edgeId: string;
  timestamp: number;
}

interface QueuedEvent {
  event: JourneyEvent;
  deliverAt: number;
  id: string;
}

export interface MockAdapterOptions {
  /** Timing profile for realistic simulation */
  timingProfile?: TimingProfile;
  /** Enable event queue for out-of-order delivery testing */
  useEventQueue?: boolean;
}

/**
 * Mock Messaging Adapter for testing
 *
 * Tracks all sent messages, scheduled timers, and provides methods
 * to simulate user events for integration testing.
 *
 * Implements the async interface to properly test race conditions:
 * - scheduleTimer returns Promise<string>
 * - cancelTimer returns Promise<boolean>
 * - onMessage callback is async (returns Promise<void>)
 *
 * Also supports failure simulation for testing error handling:
 * - mockSendMessageFail() - Make sendMessage return failure
 * - mockSendMessageSucceed() - Reset to normal behavior
 *
 * And async delay simulation for race condition testing:
 * - setScheduleTimerDelay(ms) - Delay timer scheduling
 * - setCancelTimerDelay(ms) - Delay timer cancellation
 * - setHandlerDelay(ms) - Delay handler execution
 */
export class MockMessagingAdapter implements MessagingAdapter {
  adapterType = "mock" as const;

  private messageHandler: ((event: JourneyEvent) => Promise<void>) | null = null;
  private sentMessages: SentMessage[] = [];
  private scheduledTimers: Map<string, ScheduledTimer> = new Map();
  private timerIdCounter = 0;

  // Failure simulation state
  private shouldFail = false;
  private failureError = "Mock send failure";
  private failureCount = 0; // 0 = fail forever, >0 = fail N times then succeed
  private currentFailures = 0;

  // Async delay simulation for race condition testing
  private scheduleTimerDelayMs = 0;
  private cancelTimerDelayMs = 0;
  private handlerDelayMs = 0;

  // Timing profile for realistic simulation
  private timingProfile: TimingProfile;
  private useEventQueue: boolean;
  private eventQueue: QueuedEvent[] = [];
  private eventIdCounter = 0;
  private lastClickTime: number | null = null;

  constructor(options: MockAdapterOptions = {}) {
    this.timingProfile = options.timingProfile || TIMING_PROFILES.instant;
    this.useEventQueue = options.useEventQueue || false;
  }

  /**
   * Register a message handler (async to support proper error handling)
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
   * Send a message to a user (mocked - just records it)
   * Returns mock message IDs for testing
   * Supports failure simulation for testing error handling
   */
  async sendMessage(userId: string, message: JourneyMessage): Promise<SendMessageResult> {
    // Check if we should simulate failure
    if (this.shouldFail) {
      if (this.failureCount === 0) {
        // Fail forever
        return { success: false, messageIds: [], error: this.failureError };
      }
      // Fail N times then succeed
      this.currentFailures++;
      if (this.currentFailures <= this.failureCount) {
        return { success: false, messageIds: [], error: this.failureError };
      }
      // Reset after reaching failure count
      this.shouldFail = false;
      this.currentFailures = 0;
    }

    const timestamp = Date.now();
    this.sentMessages.push({
      userId,
      message,
      timestamp,
    });

    // Generate mock message ID
    const mockMessageId = `mock_${timestamp}_${this.sentMessages.length}`;

    return {
      success: true,
      messageIds: [
        {
          platformMessageId: mockMessageId,
          messageType: message.type === "media" ? "photo" : message.buttons?.length ? "buttons" : "text",
        },
      ],
    };
  }

  /**
   * Schedule a timer (mocked - just records it)
   * Returns Promise to match async interface and allow delay simulation
   */
  async scheduleTimer(sessionId: string, delayMs: number, edgeId: string): Promise<string> {
    // Simulate async delay if configured (for race condition testing)
    if (this.scheduleTimerDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.scheduleTimerDelayMs));
    }

    const timerId = `timer_${++this.timerIdCounter}`;
    this.scheduledTimers.set(timerId, {
      timerId,
      sessionId,
      delayMs,
      edgeId,
      timestamp: Date.now(),
    });
    return timerId;
  }

  /**
   * Cancel a timer
   * Returns Promise<boolean> to match async interface
   *
   * @param timerId - Timer ID
   * @param _edgeId - Edge ID (unused in mock)
   * @param _sessionId - Session ID (unused in mock)
   */
  async cancelTimer(timerId: string, _edgeId: string, _sessionId: string): Promise<boolean> {
    // Simulate async delay if configured (for race condition testing)
    if (this.cancelTimerDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.cancelTimerDelayMs));
    }

    const existed = this.scheduledTimers.has(timerId);
    this.scheduledTimers.delete(timerId);
    return existed;
  }

  /**
   * Cleanup adapter resources
   */
  dispose(): void {
    this.messageHandler = null;
    this.scheduledTimers.clear();
  }

  // ===== Test Helper Methods =====

  /**
   * Simulate a user button click
   * Properly awaits the async handler to ensure state changes complete
   */
  async simulateButtonClick(buttonId: string, userId = "test-user-1", sessionId = "test-session-1"): Promise<void> {
    if (!this.messageHandler) {
      throw new Error("No message handler registered");
    }

    // Simulate async delay if configured (for race condition testing)
    if (this.handlerDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.handlerDelayMs));
    }

    await this.messageHandler({
      type: "button_click",
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      payload: { buttonId },
    });
  }

  /**
   * Simulate a user text message
   * Properly awaits the async handler to ensure state changes complete
   */
  async simulateMessage(text: string, userId = "test-user-1", sessionId = "test-session-1"): Promise<void> {
    if (!this.messageHandler) {
      throw new Error("No message handler registered");
    }

    // Simulate async delay if configured (for race condition testing)
    if (this.handlerDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.handlerDelayMs));
    }

    await this.messageHandler({
      type: "message",
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      payload: { text },
    });
  }

  /**
   * Simulate a timer timeout
   * Properly awaits the async handler to ensure state changes complete
   */
  async simulateTimeout(timerId: string, userId = "test-user-1", sessionId = "test-session-1"): Promise<void> {
    if (!this.messageHandler) {
      throw new Error("No message handler registered");
    }
    const timer = this.scheduledTimers.get(timerId);
    if (!timer) {
      throw new Error(`Timer ${timerId} not found`);
    }

    // Simulate async delay if configured (for race condition testing)
    if (this.handlerDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.handlerDelayMs));
    }

    await this.messageHandler({
      type: "timeout",
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      payload: { timerId, durationMs: timer.delayMs },
    });
  }

  /**
   * Get all sent messages
   */
  getSentMessages(): SentMessage[] {
    return [...this.sentMessages];
  }

  /**
   * Get the last sent message
   */
  getLastMessage(): SentMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  /**
   * Get all scheduled timers
   */
  getScheduledTimers(): ScheduledTimer[] {
    return Array.from(this.scheduledTimers.values());
  }

  /**
   * Get a specific timer by ID
   */
  getTimer(timerId: string): ScheduledTimer | undefined {
    return this.scheduledTimers.get(timerId);
  }

  /**
   * Check if a timer exists
   */
  hasTimer(timerId: string): boolean {
    return this.scheduledTimers.has(timerId);
  }

  /**
   * Get count of sent messages
   */
  getMessageCount(): number {
    return this.sentMessages.length;
  }

  /**
   * Get count of active timers
   */
  getTimerCount(): number {
    return this.scheduledTimers.size;
  }

  /**
   * Clear all sent messages
   */
  clearMessages(): void {
    this.sentMessages = [];
  }

  /**
   * Clear all timers
   */
  clearTimers(): void {
    this.scheduledTimers.clear();
  }

  /**
   * Reset the adapter to initial state
   */
  reset(): void {
    this.messageHandler = null;
    this.sentMessages = [];
    this.scheduledTimers.clear();
    this.timerIdCounter = 0;
    this.resetFailureSimulation();
    this.resetDelaySimulation();
  }

  // ===== Failure Simulation Methods =====

  /**
   * Make sendMessage return failure
   * @param error - Error message to return (default: "Mock send failure")
   * @param failCount - Number of times to fail before succeeding (0 = fail forever)
   */
  mockSendMessageFail(error = "Mock send failure", failCount = 0): void {
    this.shouldFail = true;
    this.failureError = error;
    this.failureCount = failCount;
    this.currentFailures = 0;
  }

  /**
   * Reset sendMessage to normal success behavior
   */
  mockSendMessageSucceed(): void {
    this.resetFailureSimulation();
  }

  /**
   * Reset failure simulation state
   */
  private resetFailureSimulation(): void {
    this.shouldFail = false;
    this.failureError = "Mock send failure";
    this.failureCount = 0;
    this.currentFailures = 0;
  }

  /**
   * Check if failure simulation is active
   */
  isFailureSimulationActive(): boolean {
    return this.shouldFail;
  }

  // ===== Async Delay Simulation Methods (for race condition testing) =====

  /**
   * Set delay for scheduleTimer calls
   * Use to test that callers properly await timer scheduling
   * @param ms - Delay in milliseconds (0 = no delay)
   */
  setScheduleTimerDelay(ms: number): void {
    this.scheduleTimerDelayMs = ms;
  }

  /**
   * Set delay for cancelTimer calls
   * Use to test that callers properly await timer cancellation
   * @param ms - Delay in milliseconds (0 = no delay)
   */
  setCancelTimerDelay(ms: number): void {
    this.cancelTimerDelayMs = ms;
  }

  /**
   * Set delay for handler execution
   * Use to test that state changes complete before caller continues
   * @param ms - Delay in milliseconds (0 = no delay)
   */
  setHandlerDelay(ms: number): void {
    this.handlerDelayMs = ms;
  }

  /**
   * Reset all delay simulation
   */
  private resetDelaySimulation(): void {
    this.scheduleTimerDelayMs = 0;
    this.cancelTimerDelayMs = 0;
    this.handlerDelayMs = 0;
  }

  /**
   * Check if any delay simulation is active
   */
  isDelaySimulationActive(): boolean {
    return this.scheduleTimerDelayMs > 0 || this.cancelTimerDelayMs > 0 || this.handlerDelayMs > 0;
  }

  // ===== Timing Profile Methods =====

  /**
   * Set the timing profile for realistic simulation
   */
  setTimingProfile(profile: TimingProfile): void {
    this.timingProfile = profile;
  }

  /**
   * Get the current timing profile
   */
  getTimingProfile(): TimingProfile {
    return this.timingProfile;
  }

  /**
   * Enable or disable event queue mode
   */
  setUseEventQueue(enabled: boolean): void {
    this.useEventQueue = enabled;
  }

  /**
   * Simulate button click with timing profile applied
   * Includes think time, debounce check, and network latency
   */
  async simulateButtonClickWithTiming(
    buttonId: string,
    userId = "test-user-1",
    sessionId = "test-session-1"
  ): Promise<{ delivered: boolean; debounced: boolean }> {
    if (!this.messageHandler) {
      throw new Error("No message handler registered");
    }

    // Check debounce
    if (shouldDebounce(this.timingProfile, this.lastClickTime)) {
      return { delivered: false, debounced: true };
    }

    // Simulate user think time
    const thinkTime = getThinkTime(this.timingProfile);
    if (thinkTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, thinkTime));
    }

    this.lastClickTime = Date.now();

    const event: JourneyEvent = {
      type: "button_click",
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      payload: { buttonId },
    };

    if (this.useEventQueue) {
      const latency = getNetworkLatency(this.timingProfile);
      this.queueEvent(event, latency);
      return { delivered: false, debounced: false }; // Will be delivered later
    }

    // Simulate network latency
    const latency = getNetworkLatency(this.timingProfile);
    if (latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, latency));
    }

    await this.messageHandler(event);
    return { delivered: true, debounced: false };
  }

  /**
   * Simulate message with timing profile applied
   */
  async simulateMessageWithTiming(
    text: string,
    userId = "test-user-1",
    sessionId = "test-session-1"
  ): Promise<{ delivered: boolean }> {
    if (!this.messageHandler) {
      throw new Error("No message handler registered");
    }

    // Simulate user think time
    const thinkTime = getThinkTime(this.timingProfile);
    if (thinkTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, thinkTime));
    }

    const event: JourneyEvent = {
      type: "message",
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      payload: { text },
    };

    if (this.useEventQueue) {
      const latency = getNetworkLatency(this.timingProfile);
      this.queueEvent(event, latency);
      return { delivered: false };
    }

    // Simulate network latency
    const latency = getNetworkLatency(this.timingProfile);
    if (latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, latency));
    }

    await this.messageHandler(event);
    return { delivered: true };
  }

  /**
   * Simulate timeout with timing profile jitter applied
   */
  async simulateTimeoutWithTiming(
    timerId: string,
    userId = "test-user-1",
    sessionId = "test-session-1"
  ): Promise<void> {
    if (!this.messageHandler) {
      throw new Error("No message handler registered");
    }
    const timer = this.scheduledTimers.get(timerId);
    if (!timer) {
      throw new Error(`Timer ${timerId} not found`);
    }

    // Apply jitter to simulate timer inaccuracy
    const jitteredDelay = applyJitter(timer.delayMs, this.timingProfile.timerJitter);
    const actualDelay = Math.max(0, jitteredDelay - timer.delayMs);

    if (actualDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, actualDelay));
    }

    const event: JourneyEvent = {
      type: "timeout",
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      payload: { timerId, durationMs: timer.delayMs },
    };

    if (this.useEventQueue) {
      const latency = getNetworkLatency(this.timingProfile);
      this.queueEvent(event, latency);
      return;
    }

    await this.messageHandler(event);
  }

  // ===== Event Queue Methods =====

  /**
   * Queue an event for later delivery
   */
  private queueEvent(event: JourneyEvent, deliveryDelayMs: number): void {
    const queuedEvent: QueuedEvent = {
      event,
      deliverAt: Date.now() + deliveryDelayMs,
      id: `queued_${++this.eventIdCounter}`,
    };
    this.eventQueue.push(queuedEvent);

    // Sort by delivery time (with optional reordering)
    if (this.timingProfile.allowReordering) {
      // Shuffle events that are close in delivery time (within 50ms)
      this.eventQueue.sort((a, b) => {
        const diff = a.deliverAt - b.deliverAt;
        if (Math.abs(diff) < 50) {
          return Math.random() - 0.5; // Random order for close events
        }
        return diff;
      });
    } else {
      this.eventQueue.sort((a, b) => a.deliverAt - b.deliverAt);
    }
  }

  /**
   * Process all queued events in order
   * Call this to deliver all pending events
   */
  async processEventQueue(): Promise<number> {
    if (!this.messageHandler) {
      throw new Error("No message handler registered");
    }

    let processed = 0;
    const now = Date.now();

    // Process events that are ready
    while (this.eventQueue.length > 0 && this.eventQueue[0].deliverAt <= now) {
      const queuedEvent = this.eventQueue.shift()!;
      await this.messageHandler(queuedEvent.event);
      processed++;
    }

    return processed;
  }

  /**
   * Process next event in queue (regardless of delivery time)
   */
  async processNextEvent(): Promise<boolean> {
    if (!this.messageHandler || this.eventQueue.length === 0) {
      return false;
    }

    const queuedEvent = this.eventQueue.shift()!;
    await this.messageHandler(queuedEvent.event);
    return true;
  }

  /**
   * Get number of events in queue
   */
  getQueuedEventCount(): number {
    return this.eventQueue.length;
  }

  /**
   * Clear the event queue
   */
  clearEventQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Get queued events (for inspection)
   */
  getQueuedEvents(): QueuedEvent[] {
    return [...this.eventQueue];
  }

  /**
   * Reset click tracking
   */
  resetClickTracking(): void {
    this.lastClickTime = null;
  }
}
