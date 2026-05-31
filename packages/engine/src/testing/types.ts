/**
 * Journey Variation Tester - Type Definitions
 *
 * Core types for the variation testing system that systematically
 * explores all possible execution paths through a journey.
 *
 * @module engine/testing/types
 */

// =============================================================================
// INPUT TYPES
// =============================================================================

/** Type of input at a node */
export type InputType = "button" | "text" | "timeout" | "auto" | "plugin_timeout" | "plugin_button";

/** Timing scenario for race condition testing */
export type TimingScenario = "user_first" | "timeout_first" | "concurrent" | "none";

/**
 * Input to simulate at a specific node
 */
export interface NodeInput {
  /** Node ID where input is applied */
  nodeId: string;
  /** Type of input */
  inputType: InputType;
  /** Button ID for button clicks, text content for messages */
  value?: string;
  /** Expected outcome (for validation testing) */
  expectedOutcome?: "success" | "validation_error";
  /** Plugin ID for plugin_timeout and plugin_button inputs */
  pluginId?: string;
  /** Step index for plugin_button inputs (which step's button to click) */
  stepIndex?: number;
}

// =============================================================================
// VARIATION TYPES
// =============================================================================

/**
 * A single test variation to execute
 */
export interface TestVariation {
  /** Unique ID for reproducibility (e.g., "path-3_btn-cancel_timing-none") */
  id: string;
  /** Path of node IDs (e.g., ["start", "welcome", "question", "end"]) */
  path: string[];
  /** Inputs to apply at each interactive node */
  inputs: NodeInput[];
  /** Timing scenario for nodes with timers */
  timing: TimingScenario;
  /** Initial context for condition evaluation */
  contextSetup: Record<string, unknown>;
  /** Condition branches that couldn't be derived into context */
  underivableConditions?: string[];
  /** Description for logs/reports */
  description?: string;
}

/**
 * Result status for a variation
 */
export type VariationStatus = "passed" | "failed" | "alternate_path" | "skipped";

/**
 * Reason for alternate path
 */
export type AlternatePathReason =
  | "text_response"
  | "timeout"
  | "guard_fallback"
  | "plugin_button"
  | "condition_branch";

/**
 * Information about an alternate path taken during variation execution
 */
export interface AlternatePathInfo {
  /** Node where divergence occurred */
  divergenceNodeId: string;
  /** Expected next node from original path */
  expectedNodeId: string;
  /** Actual next node visited */
  actualNodeId: string;
  /** Reason why this is a valid alternate */
  reason: AlternatePathReason;
  /** Input that triggered the alternate path */
  inputType: InputType;
}

/**
 * Result of executing a single variation
 */
export interface VariationResult {
  /** The variation that was executed */
  variation: TestVariation;
  /** Whether execution succeeded */
  success: boolean;
  /** Result status for granular tracking */
  status?: VariationStatus;
  /** Alternate path details if status is "alternate_path" */
  alternatePath?: AlternatePathInfo;
  /** Error message if failed */
  error?: string;
  /** Stack trace if error */
  stack?: string;
  /** Actual nodes visited during execution */
  visitedNodes: string[];
  /** Messages sent during execution */
  messagesSent: string[];
  /** Steps taken during execution */
  steps: VariationStep[];
  /** Execution time in milliseconds */
  durationMs: number;
  /** Final session status */
  finalStatus: string;
}

/**
 * A single step in variation execution
 */
export interface VariationStep {
  /** Node ID where step occurred */
  nodeId: string;
  /** Action taken */
  action: "click" | "text" | "timeout" | "auto" | "force" | "start" | "finish";
  /** Additional details */
  details?: string;
  /** Timestamp */
  timestamp: number;
}

// =============================================================================
// COVERAGE TYPES
// =============================================================================

/**
 * Coverage metrics for a node
 */
export interface NodeCoverage {
  /** Node ID */
  nodeId: string;
  /** Node label */
  label: string;
  /** Node type */
  nodeType: string;
  /** Number of times visited */
  visitCount: number;
  /** Whether node was visited at all */
  visited: boolean;
}

/**
 * Coverage metrics for an edge
 */
export interface EdgeCoverage {
  /** Edge ID */
  edgeId: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge type */
  edgeType: string;
  /** Edge label */
  label?: string;
  /** Number of times traversed */
  traverseCount: number;
  /** Whether edge was traversed at all */
  traversed: boolean;
}

/**
 * Coverage metrics for a branch (condition node)
 */
export interface BranchCoverage {
  /** Node ID of the condition */
  nodeId: string;
  /** Branch ID */
  branchId: string;
  /** Branch label */
  label?: string;
  /** Number of times taken */
  takenCount: number;
  /** Whether branch was taken at all */
  taken: boolean;
}

/**
 * Coverage metrics for inputs at a node
 */
export interface InputCoverage {
  /** Node ID */
  nodeId: string;
  /** Node label */
  label: string;
  /** Total buttons on node */
  totalButtons: number;
  /** Buttons that were clicked */
  clickedButtons: Set<string>;
  /** Whether text input was tested */
  textTested: boolean;
  /** Whether timeout was tested */
  timeoutTested: boolean;
}

/**
 * Complete coverage report
 */
export interface CoverageMetrics {
  /** Node coverage */
  nodes: {
    total: number;
    visited: number;
    coverage: number;
    details: NodeCoverage[];
  };
  /** Edge coverage */
  edges: {
    total: number;
    traversed: number;
    coverage: number;
    details: EdgeCoverage[];
  };
  /** Path coverage */
  paths: {
    total: number;
    tested: number;
    coverage: number;
  };
  /** Branch coverage (conditions) */
  branches: {
    total: number;
    taken: number;
    coverage: number;
    details: BranchCoverage[];
  };
  /** Input coverage (interactive nodes) */
  inputs: {
    totalNodes: number;
    fullyCovered: number;
    coverage: number;
    details: InputCoverage[];
  };
  /** Enhanced: Handler execution coverage by node type */
  handlers?: HandlerCoverage;
  /** Enhanced: Error path coverage */
  errors?: ErrorPathCoverage;
  /** Enhanced: Timer outcome coverage */
  timers?: TimerPathCoverage;
  /** Enhanced: Condition context diversity */
  conditions?: ConditionContextCoverage;
}

// =============================================================================
// ENHANCED COVERAGE TYPES
// =============================================================================

/**
 * Handler execution coverage by node type
 * Tracks whether each handler type was actually executed (not just visited)
 */
export interface HandlerCoverage {
  /** Coverage by node type */
  byType: Record<
    string,
    {
      /** Number of nodes of this type that executed */
      executed: number;
      /** Total nodes of this type in journey */
      totalNodes: number;
      /** Variation IDs that executed this type */
      executionVariations: string[];
    }
  >;
  /** Overall handler coverage percentage */
  percentage: number;
}

/**
 * Error path coverage
 * Tracks which error conditions were triggered during testing
 */
export interface ErrorPathCoverage {
  /** Errors that were triggered */
  triggered: Record<
    string,
    {
      /** Error code/type */
      errorCode: string;
      /** Node where error occurred */
      nodeId: string;
      /** Variation IDs that triggered this error */
      variations: string[];
      /** Sample error message */
      sampleMessage?: string;
    }
  >;
  /** Known potential errors that weren't triggered */
  untriggered: string[];
  /** Overall error path coverage percentage */
  percentage: number;
}

/**
 * Timer outcome coverage
 * Tracks timer behaviors: expired, cancelled, or race conditions
 */
export interface TimerPathCoverage {
  /** Coverage by node with timers */
  byNode: Record<
    string,
    {
      /** Node ID */
      nodeId: string;
      /** Node label */
      label?: string;
      /** Timer duration (ms) */
      duration: number;
      /** Times timer expired naturally */
      expiredCount: number;
      /** Times timer was cancelled (user responded) */
      cancelledCount: number;
      /** Times both timer and user event arrived simultaneously */
      raceConditionCount: number;
    }
  >;
  /** Overall timer coverage percentage (both expired AND cancelled tested) */
  percentage: number;
}

/**
 * Condition context diversity
 * Tracks whether conditions evaluated with varied data (true AND false)
 */
export interface ConditionContextCoverage {
  /** Coverage by condition node */
  byCondition: Record<
    string,
    {
      /** Node ID */
      nodeId: string;
      /** Condition expression */
      expression: string;
      /** Number of times evaluated true */
      trueCases: number;
      /** Number of times evaluated false */
      falseCases: number;
      /** Sample contexts that led to true */
      trueContextSamples: Array<Record<string, unknown>>;
      /** Sample contexts that led to false */
      falseContextSamples: Array<Record<string, unknown>>;
      /** Whether balanced (both true and false tested) */
      isBalanced: boolean;
    }
  >;
  /** Overall condition diversity percentage */
  percentage: number;
}

// =============================================================================
// EXPLORER OPTIONS
// =============================================================================

/**
 * Options for variation exploration
 */
export interface VariationExplorerOptions {
  /** Maximum number of paths to explore (default: 1000) */
  maxPaths?: number;
  /** Maximum path depth (default: 100) */
  maxDepth?: number;
  /** Include dead-end paths (default: true) */
  includeDeadEnds?: boolean;
  /** Number of text input samples per node (default: 3) */
  textSampleCount?: number;
  /** Include race condition variations (default: false) */
  includeRaceTests?: boolean;
  /** Seed for reproducible randomness */
  seed?: number;
  /** Fast mode: use additive variation generation instead of cartesian product (default: false) */
  fastMode?: boolean;
}

/**
 * Options for variation runner
 */
export interface VariationRunnerOptions {
  /** Maximum concurrent executions (default: 10) */
  concurrency?: number;
  /** Timeout per variation in ms (default: 30000) */
  timeout?: number;
  /** Stop on first failure (default: false) */
  failFast?: boolean;
  /** Log level (default: "info") */
  logLevel?: "silent" | "error" | "warn" | "info" | "debug" | "trace";
  /** Scale factor for delays and timeouts during testing (default: 1) */
  timeScale?: number;
}

// =============================================================================
// TESTER RESULT TYPES
// =============================================================================

/**
 * Execution backend metadata for reports
 */
export interface BackendReportMetadata {
  name: string;
  details?: Record<string, unknown>;
}

/**
 * Complete test result
 */
export interface VariationTesterResult {
  /** Journey identifier */
  journeyId: string;
  /** Journey name/label */
  journeyName?: string;
  /** Journey file path (for identification when name is missing) */
  journeyPath?: string;
  /** Summary statistics */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    /** Count of variations that took valid alternate paths */
    alternatePaths: number;
    durationMs: number;
  };
  /** Coverage metrics */
  coverage: CoverageMetrics;
  /** Individual variation results (failed ones first) */
  results: VariationResult[];
  /** Backend metadata */
  backend?: BackendReportMetadata;
  /** Seed used for reproducibility */
  seed: number;
  /** Timestamp */
  timestamp: string;
}

// =============================================================================
// CLI OUTPUT TYPES
// =============================================================================

/** Output format for CLI */
export type OutputFormat = "text" | "json" | "junit";

// =============================================================================
// INTERACTIVE MODE TYPES
// =============================================================================

/** User action in interactive mode */
export type InteractiveAction = "continue" | "inspect" | "skip_family" | "quit";

/** Problem classification for display */
export type ProblemType = "validation" | "execution" | "timeout";

/**
 * Options for interactive runner
 */
export interface InteractiveRunnerOptions {
  /** Timeout per variation in ms (default: 30000) */
  timeout?: number;
  /** Maximum paths to explore (default: 1000) */
  maxPaths?: number;
  /** Fast mode for variation generation (default: true for interactive) */
  fastMode?: boolean;
  /** Maximum concurrent executions (default: 500) */
  concurrency?: number;
}

/**
 * Problem context for interactive display
 */
export interface ProblemContext {
  /** Classification of the problem */
  type: ProblemType;
  /** The variation that failed */
  variation: TestVariation;
  /** The result with error details */
  result: VariationResult;
  /** Current variation index (1-based) */
  variationIndex: number;
  /** Total number of variations */
  totalVariations: number;
  /** Similar variations that can be skipped */
  similarVariations: TestVariation[];
  /** Index in path where failure occurred */
  failedAtIndex: number;
}

/**
 * Journey stats for startup display
 */
export interface JourneyStats {
  nodeCount: number;
  edgeCount: number;
  variationCount: number;
  journeyName: string;
}

/**
 * CLI options
 */
export interface CLIOptions {
  /** Journey file path or ID */
  journey: string;
  /** Output format */
  format: OutputFormat;
  /** Show detailed coverage */
  coverage: boolean;
  /** Stop on first failure */
  failFast: boolean;
  /** Max concurrent executions */
  parallel: number;
  /** Timeout per variation (ms) */
  timeout: number;
  /** Random seed */
  seed?: number;
  /** Include race condition tests */
  raceTests: boolean;
  /** Verbose output */
  verbose: boolean;
  /** Filter pattern for variations */
  filter?: string;
}
