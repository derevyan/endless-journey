/**
 * Timing Profiles for Realistic Race Condition Testing
 *
 * Configurable timing profiles that simulate real-world conditions:
 * - User think time (how long users take to respond)
 * - Network latency (message delivery delays)
 * - Timer jitter (variance in timer accuracy)
 * - Button debounce (protection against rapid clicks)
 *
 * @example
 * ```typescript
 * import { TIMING_PROFILES, applyTimingProfile } from "./timing-profiles";
 *
 * const adapter = new MockMessagingAdapter({
 *   timingProfile: TIMING_PROFILES.realistic
 * });
 * ```
 */

export interface TimingProfile {
  /** Profile name for identification */
  name: string;

  /** Description of when to use this profile */
  description: string;

  /** Simulated user think time before button clicks (ms) */
  userThinkTime: {
    min: number;
    max: number;
  };

  /** Simulated network latency for message delivery (ms) */
  networkLatency: {
    min: number;
    max: number;
  };

  /** Timer jitter as percentage (0.1 = ±10% variance) */
  timerJitter: number;

  /** Minimum time between button clicks (ms) */
  buttonDebounce: number;

  /** Whether to enable out-of-order event delivery */
  allowReordering: boolean;
}

/**
 * Pre-configured timing profiles for different testing scenarios
 */
export const TIMING_PROFILES: Record<string, TimingProfile> = {
  /**
   * Instant - No delays, ideal for unit tests
   * Use when: Fast feedback during development, testing logic not timing
   */
  instant: {
    name: "Instant (Unit Test)",
    description: "No artificial delays - for fast unit tests",
    userThinkTime: { min: 0, max: 0 },
    networkLatency: { min: 0, max: 0 },
    timerJitter: 0,
    buttonDebounce: 0,
    allowReordering: false,
  },

  /**
   * Fast - Minimal delays for quick integration tests
   * Use when: Quick integration testing with some timing simulation
   */
  fast: {
    name: "Fast (Integration)",
    description: "Minimal delays for quick integration tests",
    userThinkTime: { min: 5, max: 20 },
    networkLatency: { min: 5, max: 15 },
    timerJitter: 0.02, // ±2%
    buttonDebounce: 10,
    allowReordering: false,
  },

  /**
   * Realistic - Production-like timing patterns
   * Use when: Testing real-world user behavior patterns
   */
  realistic: {
    name: "Realistic (Production-like)",
    description: "Simulates typical user behavior and network conditions",
    userThinkTime: { min: 200, max: 2000 },
    networkLatency: { min: 50, max: 200 },
    timerJitter: 0.1, // ±10%
    buttonDebounce: 300,
    allowReordering: false,
  },

  /**
   * Slow Network - High latency conditions
   * Use when: Testing behavior on poor network connections
   */
  slowNetwork: {
    name: "Slow Network",
    description: "High latency simulation for poor connections",
    userThinkTime: { min: 100, max: 500 },
    networkLatency: { min: 500, max: 2000 },
    timerJitter: 0.15, // ±15%
    buttonDebounce: 200,
    allowReordering: true, // Slow networks can reorder
  },

  /**
   * Stressed - Chaos testing conditions
   * Use when: Finding race conditions and edge cases
   */
  stressed: {
    name: "Stressed (Chaos)",
    description: "Rapid events with variable latency - finds race conditions",
    userThinkTime: { min: 0, max: 100 }, // Rapid fire
    networkLatency: { min: 100, max: 1000 }, // Variable latency
    timerJitter: 0.3, // ±30%
    buttonDebounce: 0, // No debounce
    allowReordering: true, // Events can arrive out of order
  },

  /**
   * Impatient User - Quick responses, tests timeout behavior
   * Use when: Testing follow-up cancellation and quick response paths
   */
  impatientUser: {
    name: "Impatient User",
    description: "Very quick user responses",
    userThinkTime: { min: 10, max: 100 },
    networkLatency: { min: 20, max: 50 },
    timerJitter: 0.05,
    buttonDebounce: 50,
    allowReordering: false,
  },

  /**
   * Distracted User - Long think times, tests follow-up sequences
   * Use when: Testing follow-up reminder effectiveness
   */
  distractedUser: {
    name: "Distracted User",
    description: "Long delays between interactions",
    userThinkTime: { min: 5000, max: 30000 },
    networkLatency: { min: 50, max: 150 },
    timerJitter: 0.1,
    buttonDebounce: 300,
    allowReordering: false,
  },
};

/**
 * Helper to get random value within a range
 */
export function randomInRange(min: number, max: number): number {
  if (min === max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Apply timer jitter to a duration
 * @param duration - Base duration in ms
 * @param jitter - Jitter as percentage (0.1 = ±10%)
 * @returns Duration with jitter applied
 */
export function applyJitter(duration: number, jitter: number): number {
  if (jitter === 0) return duration;
  const variance = duration * jitter;
  return Math.max(0, duration + randomInRange(-variance, variance));
}

/**
 * Calculate simulated user think time
 */
export function getThinkTime(profile: TimingProfile): number {
  return randomInRange(profile.userThinkTime.min, profile.userThinkTime.max);
}

/**
 * Calculate simulated network latency
 */
export function getNetworkLatency(profile: TimingProfile): number {
  return randomInRange(profile.networkLatency.min, profile.networkLatency.max);
}

/**
 * Check if button click should be debounced
 */
export function shouldDebounce(
  profile: TimingProfile,
  lastClickTime: number | null,
  currentTime: number = Date.now()
): boolean {
  if (!lastClickTime || profile.buttonDebounce === 0) return false;
  return currentTime - lastClickTime < profile.buttonDebounce;
}

/**
 * Create a custom timing profile by merging with a base profile
 */
export function createCustomProfile(
  base: TimingProfile,
  overrides: Partial<TimingProfile>
): TimingProfile {
  return {
    ...base,
    ...overrides,
    userThinkTime: {
      ...base.userThinkTime,
      ...overrides.userThinkTime,
    },
    networkLatency: {
      ...base.networkLatency,
      ...overrides.networkLatency,
    },
  };
}

/**
 * Profile presets for specific test scenarios
 */
export const SCENARIO_PROFILES = {
  /** Testing button click before timer fires */
  userBeatsTimer: createCustomProfile(TIMING_PROFILES.fast, {
    userThinkTime: { min: 5, max: 10 },
    networkLatency: { min: 5, max: 10 },
  }),

  /** Testing timer fires before user responds */
  timerBeatsUser: createCustomProfile(TIMING_PROFILES.fast, {
    userThinkTime: { min: 100, max: 200 },
    networkLatency: { min: 5, max: 10 },
  }),

  /** Testing simultaneous events */
  simultaneousEvents: createCustomProfile(TIMING_PROFILES.fast, {
    userThinkTime: { min: 0, max: 5 },
    networkLatency: { min: 0, max: 5 },
    timerJitter: 0,
  }),

  /** Testing network reordering */
  networkReordering: createCustomProfile(TIMING_PROFILES.slowNetwork, {
    allowReordering: true,
    networkLatency: { min: 100, max: 500 },
  }),
};

export type TimingProfileName = keyof typeof TIMING_PROFILES;
export type ScenarioProfileName = keyof typeof SCENARIO_PROFILES;
