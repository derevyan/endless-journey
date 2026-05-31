import { z } from "zod";

import { JourneyStatusValues } from "../common";
import { PluginsArraySchema } from "../plugins/config";
import { VariableValueSchema } from "../value-types";
import { VariableOperationSchema } from "../variables";

// Timer schema for timeout transitions
export const TimerSchema = z.object({
  seconds: z.number().min(1), // Total duration in seconds
});

// Media attachment schema for images and videos
// Used by message nodes and follow-up steps
export const MediaTypeSchema = z.enum(["image", "video"]);
export type MediaType = z.infer<typeof MediaTypeSchema>;

export const MediaSchema = z.object({
  type: MediaTypeSchema,
  url: z.string().url(),
  filename: z.string().optional(),
  mediaId: z.uuid().optional(),
});
export type Media = z.infer<typeof MediaSchema>;

// Position schema for node placement
export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// Metadata schema for node tracking
// Note: status uses JourneyStatusValues from common/status.ts (single source of truth)
export const NodeMetadataSchema = z.object({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.string(),
  status: z.enum(JourneyStatusValues),
  notes: z.string().optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// TAG ACTION SCHEMA (single scope - user tags)
// =============================================================================

// Tag operations - add/remove tags from users
const TagOperationsSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

// Tag action schema - applied to users when node is executed
// Tags are stored in client_tags table, follow user across ALL journeys
export const TagActionSchema = z.object({
  // User tags (stored in client_tags table, global scope)
  tags: TagOperationsSchema.optional(),
});

// =============================================================================
// VARIABLE ACTION SCHEMA
// =============================================================================
// VariableOperationSchema is imported from variables.ts (single source of truth).
// VariableValueSchema is imported from value-types.ts to avoid circular imports.

// Variable action schema - operations to perform on variables when node executes
// Supports journey, global, and user scoped operations simultaneously
export const VariableActionSchema = z.object({
  // Journey-scoped operations (stored in journey_variables table)
  journeyOperations: z.array(VariableOperationSchema).optional(),
  // Global-scoped operations (stored in global_variables table, shared across all journeys)
  globalOperations: z.array(VariableOperationSchema).optional(),
  // User-scoped operations (stored in user's session context, follows user across journeys)
  userOperations: z.array(VariableOperationSchema).optional(),
});

// =============================================================================
// CRM ACTION SCHEMA
// =============================================================================

// CRM action schema - updates user's CRM position when node is executed
// Allows any node to trigger CRM stage updates as a side effect (like tagAction)
export const CrmActionSchema = z.object({
  // Target pipeline - can be ID or template variable
  // If not set, uses the default pipeline
  pipelineId: z.string().optional(),
  // Target stage within the pipeline
  // If not set, uses the default/unassigned stage
  stageId: z.string().optional(),
  // Optional notes to record with the stage change
  // Supports template variables: {{variable_name}}
  notes: z.string().optional(),
});

// Base node data schema - shared properties for all nodes
export const BaseNodeDataSchema = z.object({
  label: z.string(),
  schemaVersion: z.number().int().min(1).optional().default(1),
  // Editor-only labels for organizing nodes (not used by engine)
  tags: z.array(z.string()).optional(),
  // Tag action - add/remove tags to users when this node is executed
  tagAction: TagActionSchema.optional(),
  // Variable action - read/write variables when this node is executed
  variableAction: VariableActionSchema.optional(),
  // CRM action - update user's CRM position when this node is executed
  crmAction: CrmActionSchema.optional(),
  // Embedded plugins - array of plugin configs attached to this node
  // Plugins are composable features (follow-up, analytics, etc.)
  plugins: PluginsArraySchema.optional(),
  // Journey visualization state (set at runtime)
  scenarioActive: z.boolean().optional(),
  scenarioStep: z.number().optional(),
  journeyVisited: z.boolean().optional(),
  journeyCurrent: z.boolean().optional(),
  journeyDroppedOff: z.boolean().optional(),
  journeyStep: z.number().optional(),
});

// Edge style schema
export const EdgeStyleSchema = z.object({
  stroke: z.string(),
  strokeWidth: z.number(),
  strokeDasharray: z.string().optional(),
});

// Type exports
export type Timer = z.infer<typeof TimerSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type NodeMetadata = z.infer<typeof NodeMetadataSchema>;
export type TagAction = z.infer<typeof TagActionSchema>;
export type VariableAction = z.infer<typeof VariableActionSchema>;
export type CrmAction = z.infer<typeof CrmActionSchema>;
export type BaseNodeData = z.infer<typeof BaseNodeDataSchema>;
export type EdgeStyle = z.infer<typeof EdgeStyleSchema>;
