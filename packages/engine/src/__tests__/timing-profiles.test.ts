/**
 * Timing Profiles Tests
 *
 * Tests for the timing profile system used in race condition testing:
 * - Profile configurations
 * - Helper functions (jitter, debounce, think time)
 * - MockMessagingAdapter integration
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  TIMING_PROFILES,
  SCENARIO_PROFILES,
  randomInRange,
  applyJitter,
  getThinkTime,
  getNetworkLatency,
  shouldDebounce,
  createCustomProfile,
  type TimingProfile,
} from "../testing/timing-profiles";
import { MockMessagingAdapter } from "./helpers/mock-adapter";

describe("Timing Profiles", () => {
  describe("TIMING_PROFILES", () => {
    it("should have instant profile with zero delays", () => {
      const profile = TIMING_PROFILES.instant;
      expect(profile.userThinkTime.min).toBe(0);
      expect(profile.userThinkTime.max).toBe(0);
      expect(profile.networkLatency.min).toBe(0);
      expect(profile.networkLatency.max).toBe(0);
      expect(profile.timerJitter).toBe(0);
      expect(profile.buttonDebounce).toBe(0);
    });

    it("should have realistic profile with production-like delays", () => {
      const profile = TIMING_PROFILES.realistic;
      expect(profile.userThinkTime.min).toBeGreaterThan(0);
      expect(profile.userThinkTime.max).toBeGreaterThan(500);
      expect(profile.networkLatency.min).toBeGreaterThan(0);
      expect(profile.timerJitter).toBeGreaterThan(0);
    });

    it("should have stressed profile with chaos settings", () => {
      const profile = TIMING_PROFILES.stressed;
      expect(profile.allowReordering).toBe(true);
      expect(profile.timerJitter).toBeGreaterThanOrEqual(0.2);
    });

    it("should have all expected profiles", () => {
      expect(TIMING_PROFILES.instant).toBeDefined();
      expect(TIMING_PROFILES.fast).toBeDefined();
      expect(TIMING_PROFILES.realistic).toBeDefined();
      expect(TIMING_PROFILES.slowNetwork).toBeDefined();
      expect(TIMING_PROFILES.stressed).toBeDefined();
      expect(TIMING_PROFILES.impatientUser).toBeDefined();
      expect(TIMING_PROFILES.distractedUser).toBeDefined();
    });
  });

  describe("SCENARIO_PROFILES", () => {
    it("should have userBeatsTimer profile for quick response testing", () => {
      const profile = SCENARIO_PROFILES.userBeatsTimer;
      expect(profile.userThinkTime.max).toBeLessThan(50);
    });

    it("should have simultaneousEvents profile for race testing", () => {
      const profile = SCENARIO_PROFILES.simultaneousEvents;
      expect(profile.timerJitter).toBe(0);
    });
  });

  describe("randomInRange", () => {
    it("should return min when min equals max", () => {
      expect(randomInRange(5, 5)).toBe(5);
    });

    it("should return value within range", () => {
      for (let i = 0; i < 100; i++) {
        const value = randomInRange(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
      }
    });
  });

  describe("applyJitter", () => {
    it("should return original duration when jitter is 0", () => {
      expect(applyJitter(1000, 0)).toBe(1000);
    });

    it("should apply jitter within expected range", () => {
      const duration = 1000;
      const jitter = 0.1; // ±10%

      for (let i = 0; i < 100; i++) {
        const result = applyJitter(duration, jitter);
        expect(result).toBeGreaterThanOrEqual(900);
        expect(result).toBeLessThanOrEqual(1100);
      }
    });

    it("should not return negative values", () => {
      const result = applyJitter(10, 2.0); // 200% jitter
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getThinkTime", () => {
    it("should return 0 for instant profile", () => {
      expect(getThinkTime(TIMING_PROFILES.instant)).toBe(0);
    });

    it("should return value in range for realistic profile", () => {
      const profile = TIMING_PROFILES.realistic;
      for (let i = 0; i < 10; i++) {
        const thinkTime = getThinkTime(profile);
        expect(thinkTime).toBeGreaterThanOrEqual(profile.userThinkTime.min);
        expect(thinkTime).toBeLessThanOrEqual(profile.userThinkTime.max);
      }
    });
  });

  describe("getNetworkLatency", () => {
    it("should return 0 for instant profile", () => {
      expect(getNetworkLatency(TIMING_PROFILES.instant)).toBe(0);
    });

    it("should return value in range for slowNetwork profile", () => {
      const profile = TIMING_PROFILES.slowNetwork;
      for (let i = 0; i < 10; i++) {
        const latency = getNetworkLatency(profile);
        expect(latency).toBeGreaterThanOrEqual(profile.networkLatency.min);
        expect(latency).toBeLessThanOrEqual(profile.networkLatency.max);
      }
    });
  });

  describe("shouldDebounce", () => {
    it("should return false when no previous click", () => {
      expect(shouldDebounce(TIMING_PROFILES.realistic, null)).toBe(false);
    });

    it("should return false when debounce is 0", () => {
      expect(shouldDebounce(TIMING_PROFILES.instant, Date.now())).toBe(false);
    });

    it("should return true when within debounce window", () => {
      const profile = TIMING_PROFILES.realistic; // 300ms debounce
      const lastClick = Date.now() - 100; // 100ms ago
      expect(shouldDebounce(profile, lastClick, Date.now())).toBe(true);
    });

    it("should return false when outside debounce window", () => {
      const profile = TIMING_PROFILES.realistic; // 300ms debounce
      const lastClick = Date.now() - 500; // 500ms ago
      expect(shouldDebounce(profile, lastClick, Date.now())).toBe(false);
    });
  });

  describe("createCustomProfile", () => {
    it("should merge overrides with base profile", () => {
      const custom = createCustomProfile(TIMING_PROFILES.instant, {
        name: "Custom",
        buttonDebounce: 100,
      });

      expect(custom.name).toBe("Custom");
      expect(custom.buttonDebounce).toBe(100);
      expect(custom.timerJitter).toBe(0); // From base
    });

    it("should merge nested objects", () => {
      const custom = createCustomProfile(TIMING_PROFILES.instant, {
        userThinkTime: { min: 50, max: 100 },
      });

      expect(custom.userThinkTime.min).toBe(50);
      expect(custom.userThinkTime.max).toBe(100);
    });
  });
});

describe("MockMessagingAdapter with Timing Profiles", () => {
  let adapter: MockMessagingAdapter;

  beforeEach(() => {
    adapter = new MockMessagingAdapter();
  });

  describe("Profile Configuration", () => {
    it("should use instant profile by default", () => {
      expect(adapter.getTimingProfile().name).toBe("Instant (Unit Test)");
    });

    it("should accept profile in constructor", () => {
      const customAdapter = new MockMessagingAdapter({
        timingProfile: TIMING_PROFILES.realistic,
      });
      expect(customAdapter.getTimingProfile().name).toBe("Realistic (Production-like)");
    });

    it("should allow changing profile", () => {
      adapter.setTimingProfile(TIMING_PROFILES.stressed);
      expect(adapter.getTimingProfile().name).toBe("Stressed (Chaos)");
    });
  });

  describe("Event Queue", () => {
    it("should be disabled by default", () => {
      expect(adapter.getQueuedEventCount()).toBe(0);
    });

    it("should queue events when enabled", async () => {
      adapter.setUseEventQueue(true);
      adapter.setTimingProfile(TIMING_PROFILES.fast);

      // Register a handler
      adapter.onMessage(async () => {
        // No-op handler
      });

      await adapter.simulateButtonClickWithTiming("btn-1");

      // Event should be queued, not delivered
      expect(adapter.getQueuedEventCount()).toBe(1);
    });

    it("should process queued events", async () => {
      adapter.setUseEventQueue(true);
      adapter.setTimingProfile(TIMING_PROFILES.instant);

      let eventCount = 0;
      adapter.onMessage(async () => {
        eventCount++;
      });

      await adapter.simulateButtonClickWithTiming("btn-1");
      await adapter.simulateButtonClickWithTiming("btn-2");

      expect(eventCount).toBe(0); // Not delivered yet
      expect(adapter.getQueuedEventCount()).toBe(2);

      await adapter.processNextEvent();
      expect(eventCount).toBe(1);

      await adapter.processNextEvent();
      expect(eventCount).toBe(2);
    });

    it("should clear event queue", async () => {
      adapter.setUseEventQueue(true);
      adapter.setTimingProfile(TIMING_PROFILES.instant);

      adapter.onMessage(async () => {});

      await adapter.simulateButtonClickWithTiming("btn-1");
      expect(adapter.getQueuedEventCount()).toBe(1);

      adapter.clearEventQueue();
      expect(adapter.getQueuedEventCount()).toBe(0);
    });
  });

  describe("Debounce Behavior", () => {
    it("should debounce rapid clicks with realistic profile", async () => {
      adapter.setTimingProfile(TIMING_PROFILES.realistic); // 300ms debounce

      adapter.onMessage(async () => {});

      // First click should succeed
      const result1 = await adapter.simulateButtonClickWithTiming("btn-1");
      expect(result1.debounced).toBe(false);

      // Immediate second click should be debounced
      const result2 = await adapter.simulateButtonClickWithTiming("btn-1");
      expect(result2.debounced).toBe(true);
    });

    it("should not debounce with instant profile", async () => {
      adapter.setTimingProfile(TIMING_PROFILES.instant); // 0ms debounce

      adapter.onMessage(async () => {});

      const result1 = await adapter.simulateButtonClickWithTiming("btn-1");
      expect(result1.debounced).toBe(false);

      const result2 = await adapter.simulateButtonClickWithTiming("btn-1");
      expect(result2.debounced).toBe(false);
    });

    it("should reset click tracking", async () => {
      adapter.setTimingProfile(TIMING_PROFILES.realistic);

      adapter.onMessage(async () => {});

      await adapter.simulateButtonClickWithTiming("btn-1");

      // This would normally be debounced
      adapter.resetClickTracking();

      // But after reset, it should work
      const result = await adapter.simulateButtonClickWithTiming("btn-1");
      expect(result.debounced).toBe(false);
    });
  });

  describe("Message with Timing", () => {
    it("should deliver message directly without queue", async () => {
      adapter.setTimingProfile(TIMING_PROFILES.instant);

      let receivedText = "";
      adapter.onMessage(async (event) => {
        if (event.type === "message" && event.payload.text) {
          receivedText = event.payload.text;
        }
      });

      const result = await adapter.simulateMessageWithTiming("Hello");
      expect(result.delivered).toBe(true);
      expect(receivedText).toBe("Hello");
    });
  });
});
