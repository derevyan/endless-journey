/**
 * Blade Runner - Test Level Configurations
 *
 * Defines progressive testing levels from quick smoke tests
 * to exhaustive full coverage runs.
 *
 * @module engine/testing/blade-runner/levels
 */

import type { TestLevel, TestLevelKey } from "./types";

// =============================================================================
// TEST LEVEL DEFINITIONS
// =============================================================================

/**
 * Quick Scan - Basic smoke test
 * Runs minimal variations to catch obvious issues fast.
 */
export const QUICK_LEVEL: TestLevel = {
  key: "quick",
  name: "Quick Scan",
  icon: "🚀",
  description: "Basic smoke test - one path, minimal inputs",
  maxPaths: 1,
  fastMode: true,
  textSampleCount: 1,
  includeRaceTests: false,
  concurrency: 100,
  estimatedVariations: "~10",
  estimatedDuration: "~2 sec",
};

/**
 * Standard - Balanced test coverage
 * Tests all paths with reasonable input coverage.
 */
export const STANDARD_LEVEL: TestLevel = {
  key: "standard",
  name: "Standard",
  icon: "⚡",
  description: "All paths, one input per node",
  maxPaths: 10,
  fastMode: true,
  textSampleCount: 2,
  includeRaceTests: false,
  concurrency: 500,
  estimatedVariations: "~100",
  estimatedDuration: "~5 sec",
};

/**
 * Thorough - High coverage testing
 * Tests multiple inputs per node with fast mode.
 */
export const THOROUGH_LEVEL: TestLevel = {
  key: "thorough",
  name: "Thorough",
  icon: "🔍",
  description: "All paths, multiple inputs, fast mode",
  maxPaths: 100,
  fastMode: true,
  textSampleCount: 4,
  includeRaceTests: false,
  concurrency: 500,
  estimatedVariations: "~500",
  estimatedDuration: "~15 sec",
};

/**
 * Full Coverage - Exhaustive testing
 * Uses cartesian product for all combinations + race conditions.
 */
export const FULL_LEVEL: TestLevel = {
  key: "full",
  name: "Full Coverage",
  icon: "🎯",
  description: "Exhaustive testing with race conditions",
  maxPaths: 1000,
  fastMode: false, // Cartesian product for full coverage
  textSampleCount: 8,
  includeRaceTests: true,
  concurrency: 500,
  estimatedVariations: "~2000",
  estimatedDuration: "~60 sec",
};

/**
 * Custom - User-defined settings
 * Placeholder that gets filled with custom values.
 */
export const CUSTOM_LEVEL: TestLevel = {
  key: "custom",
  name: "Custom",
  icon: "🛠️",
  description: "Configure your own test parameters",
  maxPaths: 100,
  fastMode: true,
  textSampleCount: 3,
  includeRaceTests: false,
  concurrency: 500,
  estimatedVariations: "varies",
  estimatedDuration: "varies",
};

// =============================================================================
// LEVEL ACCESS
// =============================================================================

/**
 * All test levels in order
 */
export const TEST_LEVELS: TestLevel[] = [
  QUICK_LEVEL,
  STANDARD_LEVEL,
  THOROUGH_LEVEL,
  FULL_LEVEL,
  CUSTOM_LEVEL,
];

/**
 * Get a test level by key
 */
export function getTestLevel(key: TestLevelKey): TestLevel {
  const level = TEST_LEVELS.find((l) => l.key === key);
  if (!level) {
    throw new Error(`Unknown test level: ${key}`);
  }
  return level;
}

/**
 * Get a test level by number (1-5)
 */
export function getTestLevelByNumber(num: number): TestLevel | undefined {
  if (num < 1 || num > TEST_LEVELS.length) {
    return undefined;
  }
  return TEST_LEVELS[num - 1];
}

/**
 * Estimate variation count based on journey stats
 */
export function estimateVariations(
  level: TestLevel,
  journeyStats: { pathCount: number; interactiveNodes: number; timerNodes: number }
): number {
  const { pathCount, interactiveNodes, timerNodes } = journeyStats;

  // Quick estimate based on level configuration
  const basePaths = Math.min(pathCount, level.maxPaths);

  if (level.fastMode) {
    // Additive: paths + (interactive * samples) + (timers * timing scenarios)
    const inputVariations = interactiveNodes * level.textSampleCount;
    const timerVariations = level.includeRaceTests ? timerNodes * 3 : timerNodes;
    return basePaths + inputVariations + timerVariations;
  } else {
    // Cartesian: paths * inputs * timers (exponential)
    const inputMultiplier = Math.pow(level.textSampleCount + 1, interactiveNodes);
    const timerMultiplier = level.includeRaceTests ? Math.pow(3, timerNodes) : 1;
    return Math.min(basePaths * inputMultiplier * timerMultiplier, 10000);
  }
}

/**
 * Create a custom level with overrides
 */
export function createCustomLevel(overrides: Partial<TestLevel>): TestLevel {
  return {
    ...CUSTOM_LEVEL,
    ...overrides,
    key: "custom",
    name: "Custom",
    icon: "🛠️",
  };
}
