/**
 * Detected Issue Schema
 *
 * Issues detected during AI analysis of the execution.
 *
 * @module @journey/ai-report/schemas/issues
 */

import { z } from "zod";

/**
 * Issue severity levels.
 */
export const IssueSeveritySchema = z.enum(["error", "warning", "info"]);

export type IssueSeverity = z.infer<typeof IssueSeveritySchema>;

/**
 * Issue category types.
 */
export const IssueCategorySchema = z.enum([
  "execution_error",
  "timeout_no_response",
  "guard_blocked",
  "webhook_failure",
  "slow_node",
  "high_token_usage",
  "repeated_node",           // Same node visited multiple times
  "variable_undefined",      // Referenced undefined variable
  "button_click_ignored",    // Button clicked but no transition
  "event_not_processed",     // Event received but not handled
  "edge_not_found",          // Expected edge missing
  "state_inconsistency",     // Session state doesn't match expected
]);

export type IssueCategory = z.infer<typeof IssueCategorySchema>;

/**
 * Detected issue with fix suggestion.
 */
export const DetectedIssueSchema = z.object({
  severity: IssueSeveritySchema,
  category: IssueCategorySchema,
  nodeId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  message: z.string(),
  suggestion: z.string().optional(), // AI-friendly fix suggestion
  context: z.record(z.string(), z.unknown()).optional(),

  // Link to related tracking records
  relatedButtonClick: z.string().optional(), // clickId
  relatedUnprocessedEvent: z.string().optional(), // eventId
});

export type DetectedIssue = z.infer<typeof DetectedIssueSchema>;
