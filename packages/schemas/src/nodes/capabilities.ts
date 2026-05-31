/**
 * Node Capabilities Schema
 *
 * Declares what features each node type supports. Used by:
 * - Section Registry: Show/hide editor sections based on capabilities
 * - Field Registry: Include/exclude form fields based on capabilities
 * - UI Components: Conditional rendering based on node features
 *
 * @module nodes/capabilities
 */

import { z } from "zod";
import { NodeTypeSchema, type NodeType } from "./index";

// =============================================================================
// CAPABILITY SCHEMA
// =============================================================================

/**
 * Node capabilities schema.
 * Declares what features a node type supports.
 */
export const NodeCapabilitiesSchema = z.object({
  // Content capabilities
  /** Can display text message content */
  hasTextMessage: z.boolean().default(false),
  /** Can have interactive buttons */
  hasButtons: z.boolean().default(false),
  /** Can include media attachments (image/video) */
  hasMedia: z.boolean().default(false),

  // Timing capabilities
  /** Can have a timer for auto-advancing */
  hasTimer: z.boolean().default(false),
  /** Can have follow-up sequence for reminders */
  hasFollowUp: z.boolean().default(false),
  /** Can have a duration/wait period */
  hasDuration: z.boolean().default(false),
  /** Can have timeout configuration */
  hasTimeout: z.boolean().default(false),

  // Logic capabilities
  /** Can have conditional branching logic */
  hasConditions: z.boolean().default(false),
  /** Can assign variables */
  hasVariableAssignment: z.boolean().default(false),
  /** Can manage user tags */
  hasTagAction: z.boolean().default(false),
  /** Can capture user response */
  hasResponseCapture: z.boolean().default(false),

  // Integration capabilities
  /** Can make HTTP webhook calls */
  hasWebhook: z.boolean().default(false),
  /** Can perform CRM actions */
  hasCrmAction: z.boolean().default(false),
  /** Can use AI/LLM capabilities */
  hasAI: z.boolean().default(false),

  // Questions capabilities
  /** Can have multi-question sequences */
  hasQuestions: z.boolean().default(false),

  // UI capabilities (frontend-only flags)
  /** Show quick reply button configuration */
  hasQuickButtons: z.boolean().default(false),
  /** Show content editor section */
  hasContent: z.boolean().default(false),
  /** Allow media uploads in editor */
  hasMediaUpload: z.boolean().default(false),
});

export type NodeCapabilities = z.infer<typeof NodeCapabilitiesSchema>;

// =============================================================================
// DEFAULT CAPABILITIES
// =============================================================================

/**
 * Default capabilities (all false).
 * Use as base and override specific capabilities.
 */
export const DEFAULT_CAPABILITIES: NodeCapabilities = {
  hasTextMessage: false,
  hasButtons: false,
  hasMedia: false,
  hasTimer: false,
  hasFollowUp: false,
  hasDuration: false,
  hasTimeout: false,
  hasConditions: false,
  hasVariableAssignment: false,
  hasTagAction: false,
  hasResponseCapture: false,
  hasWebhook: false,
  hasCrmAction: false,
  hasAI: false,
  hasQuestions: false,
  hasQuickButtons: false,
  hasContent: false,
  hasMediaUpload: false,
};

// =============================================================================
// NODE TYPE CAPABILITIES
// =============================================================================

/**
 * Capabilities for each node type.
 * Defines which features are available in node editors.
 */
export const NODE_CAPABILITIES: Record<NodeType, NodeCapabilities> = {
  start: {
    ...DEFAULT_CAPABILITIES,
    hasTextMessage: true,
    hasMedia: true,
    hasContent: true,
    hasMediaUpload: true,
    hasVariableAssignment: true,
    hasTagAction: true,
    hasCrmAction: true,
  },

  message: {
    ...DEFAULT_CAPABILITIES,
    hasTextMessage: true,
    hasButtons: true,
    hasMedia: true,
    hasQuickButtons: true,
    hasContent: true,
    hasMediaUpload: true,
    hasTimer: true,
    hasFollowUp: true,
    hasVariableAssignment: true,
    hasTagAction: true,
    hasResponseCapture: true,
    hasCrmAction: true,
  },

  condition: {
    ...DEFAULT_CAPABILITIES,
    hasConditions: true,
    hasVariableAssignment: true,
    hasTagAction: true,
  },

  wait: {
    ...DEFAULT_CAPABILITIES,
    hasDuration: true,
    hasVariableAssignment: true,
    hasTagAction: true,
  },

  webhook: {
    ...DEFAULT_CAPABILITIES,
    hasWebhook: true,
    hasVariableAssignment: true,
    hasTagAction: true,
  },

  crm: {
    ...DEFAULT_CAPABILITIES,
    hasCrmAction: true,
    hasVariableAssignment: true,
    hasTagAction: true,
  },

  teleport: {
    ...DEFAULT_CAPABILITIES,
    hasVariableAssignment: true,
    hasTagAction: true,
  },

  end: {
    ...DEFAULT_CAPABILITIES,
    hasTextMessage: true,
    hasButtons: true,
    hasMedia: true,
    hasQuickButtons: true,
    hasContent: true,
    hasMediaUpload: true,
    hasVariableAssignment: true,
    hasTagAction: true,
  },

  questionnaire: {
    ...DEFAULT_CAPABILITIES,
    hasQuestions: true,
    hasContent: true,
    hasMediaUpload: true,
    hasTimeout: true,
    hasFollowUp: true,
    hasVariableAssignment: true,
    hasTagAction: true,
  },

  agent: {
    ...DEFAULT_CAPABILITIES,
    hasAI: true,
    hasTimeout: true,
    hasFollowUp: true, // Supports follow-up plugin for re-engagement sequences
    hasVariableAssignment: true,
    hasTagAction: true,
    hasCrmAction: true,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get capabilities for a node type.
 *
 * @param nodeType - The node type to get capabilities for
 * @returns Node capabilities object
 *
 * @example
 * ```ts
 * const caps = getNodeCapabilities("message");
 * if (caps.hasTimer) {
 *   // Render timer section
 * }
 * ```
 */
export function getNodeCapabilities(nodeType: NodeType): NodeCapabilities {
  return NODE_CAPABILITIES[nodeType] ?? DEFAULT_CAPABILITIES;
}

/**
 * Check if a node type has a specific capability.
 *
 * @param nodeType - The node type to check
 * @param capability - The capability to check for
 * @returns Whether the node type has the capability
 *
 * @example
 * ```ts
 * if (hasCapability("message", "hasTimer")) {
 *   // Show timer section
 * }
 * ```
 */
export function hasCapability(
  nodeType: NodeType,
  capability: keyof NodeCapabilities
): boolean {
  return getNodeCapabilities(nodeType)[capability];
}

/**
 * Get all node types that have a specific capability.
 *
 * @param capability - The capability to filter by
 * @returns Array of node types with the capability
 *
 * @example
 * ```ts
 * const nodesWithTimers = getNodeTypesWithCapability("hasTimer");
 * // ["message"]
 * ```
 */
export function getNodeTypesWithCapability(
  capability: keyof NodeCapabilities
): NodeType[] {
  return (Object.keys(NODE_CAPABILITIES) as NodeType[]).filter(
    (nodeType) => NODE_CAPABILITIES[nodeType][capability]
  );
}
