/**
 * Transition Detail Schema
 *
 * Detailed transition record - why and how we moved between nodes.
 *
 * @module @journey/ai-report/schemas/transitions
 */

import { z } from "zod";

/**
 * Transition trigger types.
 */
export const TransitionTriggerSchema = z.enum([
  "auto",           // Automatic after node execution
  "button_click",   // User clicked a button
  "timer_expired",  // Timeout triggered
  "condition_true", // Condition evaluated true
  "condition_false",// Condition evaluated false
  "guard_passed",   // Guard allowed
  "guard_blocked",  // Guard blocked (to fallback)
  "error",          // Error occurred
  "workflow_exit",  // Agent workflow exited
]);

export type TransitionTrigger = z.infer<typeof TransitionTriggerSchema>;

/**
 * Detailed transition record - why and how we moved between nodes.
 */
export const TransitionDetailSchema = z.object({
  timestamp: z.string().datetime(),
  fromNodeId: z.string(),
  fromNodeType: z.string(),
  fromNodeLabel: z.string().optional(),
  toNodeId: z.string(),
  toNodeType: z.string(),
  toNodeLabel: z.string().optional(),

  // WHY the transition happened
  trigger: TransitionTriggerSchema,

  // Additional context based on trigger
  buttonId: z.string().optional(),      // If button_click
  buttonLabel: z.string().optional(),   // Human-readable button text
  conditionExpression: z.string().optional(), // If condition
  conditionResult: z.unknown().optional(),
  errorMessage: z.string().optional(),  // If error

  // Duration at previous node
  durationAtPreviousNodeMs: z.number().optional(),
});

export type TransitionDetail = z.infer<typeof TransitionDetailSchema>;
