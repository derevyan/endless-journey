/**
 * Detection Thresholds
 *
 * Centralized configuration for issue detection and analysis thresholds.
 * All magic numbers consolidated here for easy tuning and documentation.
 *
 * @module @journey/ai-report/constants/thresholds
 */

/**
 * Thresholds for issue detection in journey execution.
 */
export const DETECTION_THRESHOLDS = {
  /**
   * Number of times a node can be visited before flagging as repeated.
   * Default: 3 visits triggers an info-level issue.
   */
  REPEATED_NODE_VISIT_COUNT: 3,

  /**
   * Duration in milliseconds before a node transition is considered slow.
   * Default: 30 seconds (30000ms) triggers a warning.
   */
  SLOW_NODE_DURATION_MS: 30000,

  /**
   * Maximum length for path labels in path visualization.
   * Labels longer than this are truncated with ellipsis.
   */
  PATH_LABEL_MAX_LENGTH: 20,
} as const;

/**
 * LLM event matching tolerances.
 */
export const LLM_MATCHING = {
  /**
   * Default tolerance for timestamp-based LLM event matching.
   * Events within this window (ms) are considered matching.
   */
  TIMESTAMP_TOLERANCE_MS: 5000,
} as const;

/**
 * Report generation limits.
 */
export const REPORT_LIMITS = {
  /**
   * Default maximum events to include in a single report.
   */
  DEFAULT_MAX_EVENTS: 1000,

  /**
   * Default system prompt truncation length.
   */
  DEFAULT_SYSTEM_PROMPT_MAX_CHARS: 2000,

  /**
   * Default conversation history truncation length.
   */
  DEFAULT_CONVERSATION_HISTORY_MAX_CHARS: 5000,
} as const;
