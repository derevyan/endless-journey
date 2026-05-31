/**
 * Blade Runner - Type Definitions
 *
 * Core types for the intelligent journey testing tool.
 *
 * @module engine/testing/blade-runner/types
 */

import type { VariationTesterResult, VariationResult, TestVariation } from "../types";

// =============================================================================
// TEST LEVELS
// =============================================================================

/** Available test level keys */
export type TestLevelKey = "quick" | "standard" | "thorough" | "full" | "custom";

/**
 * Test level configuration
 */
export interface TestLevel {
  /** Level key */
  key: TestLevelKey;
  /** Display name */
  name: string;
  /** Icon for display */
  icon: string;
  /** Description */
  description: string;
  /** Maximum paths to explore */
  maxPaths: number;
  /** Use fast mode (additive vs cartesian) */
  fastMode: boolean;
  /** Number of text samples per node */
  textSampleCount: number;
  /** Include race condition tests */
  includeRaceTests: boolean;
  /** Concurrency level */
  concurrency: number;
  /** Estimated variation count (approximate) */
  estimatedVariations?: string;
  /** Estimated duration */
  estimatedDuration?: string;
}

// =============================================================================
// ERROR DIAGNOSIS
// =============================================================================

/** Issue categories for classification */
export type IssueCategory =
  | "journey_design" // User's journey has a problem
  | "engine_bug" // Engine behaved unexpectedly
  | "test_limitation" // Test infrastructure issue
  | "timeout" // Just too slow
  | "path_divergence" // Valid path divergence (condition node routing)
  | "unknown"; // Needs investigation

/** Issue severity levels */
export type IssueSeverity = "critical" | "warning" | "info";

/**
 * Node context for detailed error reporting
 */
export interface NodeContext {
  /** Node type (message, questionnaire, etc.) */
  nodeType: string;
  /** Node label/title */
  label?: string;
  /** Configured delay in seconds */
  delay?: number;
  /** Response type (auto, buttons, text, any) */
  responseType?: string;
  /** Outgoing edges from this node */
  outgoingEdges: Array<{
    id: string;
    target: string;
    type: string;
    label?: string;
  }>;
}

/**
 * Timing breakdown for error analysis
 */
export interface TimingBreakdown {
  /** Total duration in ms */
  totalDurationMs: number;
  /** What triggered the timeout */
  timeoutSource?: string;
  /** Configured timeout in ms */
  configuredTimeoutMs?: number;
}

/**
 * A diagnosed issue from a failed variation
 */
export interface DiagnosedIssue {
  /** Issue category */
  category: IssueCategory;
  /** Severity level */
  severity: IssueSeverity;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** What likely caused this */
  likelyCause: string;
  /** Suggested fix */
  suggestedFix: string;
  /** Node where issue occurred */
  affectedNode?: string;
  /** Edge related to issue */
  affectedEdge?: string;
  /** Path that led to failure */
  failurePath: string[];
  /** Number of variations affected by same issue */
  affectedCount: number;
  /** The actual error message */
  originalError: string;
  /** Node context for engineering details */
  nodeContext?: NodeContext;
  /** Timing breakdown */
  timingBreakdown?: TimingBreakdown;
  /** Root cause analysis lines */
  rootCauseAnalysis?: string[];
}

/**
 * Grouped issues by type
 */
export interface IssueGroup {
  /** Group key (hash of issue signature) */
  key: string;
  /** The diagnosed issue */
  issue: DiagnosedIssue;
  /** All variations that hit this issue */
  variations: VariationResult[];
}

// =============================================================================
// REPORTING
// =============================================================================

/**
 * Enhanced test result with diagnosis
 */
export interface BladeRunnerResult extends VariationTesterResult {
  /** Diagnosed issues grouped by type */
  issues: IssueGroup[];
  /** Summary of issues by category */
  issueSummary: {
    journeyDesign: number;
    engineBugs: number;
    testLimitations: number;
    timeouts: number;
    pathDivergence: number;
    unknown: number;
  };
  /** Test level used */
  testLevel: TestLevelKey;
  /** Performance metrics */
  performance: {
    variationsPerSecond: number;
    avgVariationMs: number;
  };
}

// =============================================================================
// MENU & UI
// =============================================================================

/** User action after seeing results */
export type ResultAction = "review" | "export" | "rerun" | "quit";

/** Export format options */
export type ExportFormat = "json" | "markdown" | "text";

/**
 * Journey stats for menu display
 */
export interface JourneyInfo {
  /** Journey name */
  name: string;
  /** Journey file path */
  path: string;
  /** Number of nodes */
  nodeCount: number;
  /** Number of edges */
  edgeCount: number;
  /** Number of interactive nodes (questionnaire, etc) */
  interactiveNodes: number;
  /** Number of timer nodes */
  timerNodes: number;
  /** Number of condition nodes */
  conditionNodes: number;
}

/**
 * Runner configuration from user selections
 */
export interface BladeRunnerConfig {
  /** Journey file path */
  journeyPath: string;
  /** Selected test level */
  level: TestLevel;
  /** Execution backend */
  backend?: "engine" | "telegram-parity";
  /** Whether running in interactive mode */
  interactive: boolean;
  /** Stop on first failure */
  failFast: boolean;
  /** Custom timeout (optional) */
  timeout?: number;
  /** Max concurrent executions (optional) */
  concurrency?: number;
  /** Worker threads to use (optional) */
  workers?: number;
  /** Scale factor for delays/timeouts during testing (optional) */
  timeScale?: number;
  /** Deterministic seed (optional) */
  seed?: number;
  /** Filter pattern for variation IDs/descriptions (optional) */
  filter?: string;
  /** Enforce Telegram sandbox constraints (optional) */
  sandboxStrict?: boolean;
  /** Force mock LLM (optional) */
  mockLlm?: boolean;
  /** Max wait per parity step in ms (optional) */
  parityWaitMs?: number;
  /** Parity poll interval in ms (optional) */
  parityPollMs?: number;
  /** Pause session timers between inputs (optional) */
  parityFreezeTimers?: boolean;
  /** Skip media sends in parity runs (optional) */
  parityStripMedia?: boolean;
  /** Mock user ID for parity auth (optional) */
  parityUserId?: string;
  /** Output path for reports (optional) */
  output?: string;
  /** Verbose output */
  verbose: boolean;
}
