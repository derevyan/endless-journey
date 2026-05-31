/**
 * Blade Runner - Journey Testing Tool
 *
 * "More human than human" - Testing journeys like a Replicant Hunter
 *
 * An intelligent, interactive journey testing tool that:
 * - Guides users through testing with intuitive menus
 * - Distinguishes between engine bugs vs journey design issues
 * - Provides progressive testing levels (smoke → full)
 * - Generates actionable issue reports
 *
 * @module engine/testing/blade-runner
 */

// Types
export type {
  TestLevelKey,
  TestLevel,
  IssueCategory,
  IssueSeverity,
  DiagnosedIssue,
  IssueGroup,
  BladeRunnerResult,
  ResultAction,
  ExportFormat,
  JourneyInfo,
  BladeRunnerConfig,
} from "./types";

// Test levels
export {
  TEST_LEVELS,
  QUICK_LEVEL,
  STANDARD_LEVEL,
  THOROUGH_LEVEL,
  FULL_LEVEL,
  CUSTOM_LEVEL,
  getTestLevel,
  getTestLevelByNumber,
  estimateVariations,
  createCustomLevel,
} from "./levels";

// Presets
export {
  BLADE_RUNNER_VERSION,
  EXECUTION_PRESETS,
  DEFAULT_TIME_SCALE,
  DEFAULT_PARITY_WAIT_MS,
  DEFAULT_PARITY_POLL_MS,
  PARITY_DEFAULT_CONCURRENCY,
  getExecutionPreset,
  getExecutionPresetKeys,
  getExecutionPresetsForBackend,
} from "./presets";

// Menu
export { showMenu, analyzeJourney, showRunConfirmation, confirmRunAnother } from "./menu";

// Recommender
export {
  recommendTestLevel,
  getRecommendedLevelIndex,
  formatRecommendation,
  type LevelRecommendation,
  type JourneyStats,
} from "./recommender";

// Diagnosis
export {
  diagnoseFailure,
  diagnoseAllFailures,
  getIssueSummary,
  getCategoryIcon,
  getSeverityColor,
} from "./diagnosis";

// Reporter
export {
  enhanceResult,
  renderResults,
  renderIssueDetail,
  interactiveReview,
  formatExport,
} from "./reporter";

// UI utilities (re-export commonly used)
export {
  style,
  icons,
  formatDuration,
  formatNumber,
  progressBar,
  percentage,
  showCursor,
  hideCursor,
  visualLength,
  padRight,
  padLeft,
  coverageBar,
  sparkline,
  spinnerFrame,
  formatRate,
  formatEta,
  updateLines,
  SPINNER_FRAMES,
} from "./ui";

// Dashboard
export {
  Dashboard,
  createDashboard,
  type DashboardState,
  type DashboardCallbacks,
} from "./dashboard";

// Key handler
export {
  KeyHandler,
  createKeyHandler,
  type KeyHandlerCallbacks,
} from "./key-handler";
