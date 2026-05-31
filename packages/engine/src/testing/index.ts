/**
 * Journey Variation Testing Module
 *
 * Provides tools for systematically testing all possible execution
 * paths through a journey graph.
 *
 * @module engine/testing
 *
 * @example
 * ```typescript
 * import { VariationTester, testJourney } from '@journey/engine/testing';
 *
 * // Quick test
 * const result = await testJourney(journey);
 * console.log(`Passed: ${result.summary.passed}/${result.summary.total}`);
 *
 * // Full control
 * const tester = new VariationTester(journey, {
 *   maxPaths: 500,
 *   includeRaceTests: true,
 *   failFast: true,
 * });
 * const output = await tester.runFormatted();
 * console.log(output);
 * ```
 */

// Main tester
export { VariationTester, testJourney, testJourneyFormatted } from "./variation-tester";
export type { VariationTesterOptions } from "./variation-tester";

// Variation exploration
export { VariationExplorer } from "./variation-explorer";

// Variation execution
export { VariationRunner } from "./variation-runner";

// Alternate path detection
export { AlternatePathDetector } from "./alternate-path-detector";
export type { AlternatePathResult } from "./alternate-path-detector";

// Context derivation for condition nodes
export { ContextDeriver } from "./context-deriver";
export type { DerivedContext } from "./context-deriver";

// Coverage tracking
export { CoverageTracker } from "./coverage-tracker";

// Coverage reporting
export { formatReport, ProgressReporter } from "./coverage-report";

// Execution backends
export { EngineBackend, TelegramParityBackend } from "./backends";
export type { TestExecutionBackend, BackendInitParams } from "./backends";

// Race condition testing
export {
  RaceConditionTester,
  formatRaceConditionReport,
} from "./race-condition-tester";
export type {
  RaceConditionTestResult,
  RaceConditionReport,
} from "./race-condition-tester";

// Timing profiles for realistic race condition testing
export {
  TIMING_PROFILES,
  SCENARIO_PROFILES,
  randomInRange,
  applyJitter,
  getThinkTime,
  getNetworkLatency,
  shouldDebounce,
  createCustomProfile,
} from "./timing-profiles";
export type {
  TimingProfile,
  TimingProfileName,
  ScenarioProfileName,
} from "./timing-profiles";

// Interactive mode
export { InteractiveRunner } from "./interactive-runner";
export {
  renderStartup,
  renderProgress,
  renderProblem,
  renderInspection,
  renderSummary,
  waitForAction,
  waitForAnyKey,
  clearProgress,
} from "./interactive-ui";

// Types
export type {
  // Input types
  InputType,
  TimingScenario,
  NodeInput,
  // Variation types
  TestVariation,
  VariationResult,
  VariationStep,
  VariationStatus,
  // Alternate path types
  AlternatePathInfo,
  AlternatePathReason,
  // Coverage types
  NodeCoverage,
  EdgeCoverage,
  BranchCoverage,
  InputCoverage,
  CoverageMetrics,
  // Enhanced coverage types
  HandlerCoverage,
  ErrorPathCoverage,
  TimerPathCoverage,
  ConditionContextCoverage,
  // Options
  VariationExplorerOptions,
  VariationRunnerOptions,
  // Results
  VariationTesterResult,
  BackendReportMetadata,
  // CLI
  OutputFormat,
  CLIOptions,
  // Interactive mode
  InteractiveAction,
  ProblemType,
  InteractiveRunnerOptions,
  ProblemContext,
  JourneyStats,
} from "./types";
