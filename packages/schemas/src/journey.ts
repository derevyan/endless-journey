import { z } from "zod";

// Import from common module (single source of truth for shared values)
import { JourneyStatusValues } from "./common";

// Import from nodes module
import { EdgeStyleSchema, JourneyStepDataSchema, NodeMetadataSchema, NodeTypeSchema, NodeTypeValues, PositionSchema } from "./nodes";

// Re-export node types and values
export { NodeTypeSchema, NodeTypeValues } from "./nodes";

// Re-export status values from common (for backward compatibility)
export { JourneyStatusValues } from "./common";
export type { JourneyStatus } from "./common";

// =============================================================================
// JOURNEY STATUS
// =============================================================================

// Journey status schema (values imported from common/status.ts)
export const JourneyStatusSchema = z.enum(JourneyStatusValues);

// Named constants for edge types (source of truth)
export const EdgeTypes = {
  SUCCESS: "success",
  DEFAULT: "default",
  RETRY: "retry",
  DROPOFF: "dropoff",
  EXIT: "exit",
  TIMER: "timer",
} as const;

// Edge Type enum values - derived from EdgeTypes for Zod schema
export const EdgeTypeValues = [EdgeTypes.SUCCESS, EdgeTypes.DEFAULT, EdgeTypes.RETRY, EdgeTypes.DROPOFF, EdgeTypes.EXIT, EdgeTypes.TIMER] as const;

// Edge Type enum schema
export const EdgeTypeSchema = z.enum(EdgeTypeValues);

// =============================================================================
// EDGE GUARD SCHEMAS (Smart Edges - Guards, Actions, Delays)
// =============================================================================

/**
 * Guard Type - determines how the guard condition is evaluated
 * - expression: JavaScript-like expression (e.g., "user.score > 50")
 * - variable: Simple variable comparison (key/operator/value)
 * - tag: Check if user has/doesn't have a tag
 */
export const GuardTypeValues = ["expression", "variable", "tag"] as const;
export const GuardTypeSchema = z.enum(GuardTypeValues);

/**
 * Guard Variable Operator - comparison operators for variable guards
 */
export const GuardVariableOperatorValues = ["equals", "notEquals", "gt", "gte", "lt", "lte", "contains", "exists"] as const;
export const GuardVariableOperatorSchema = z.enum(GuardVariableOperatorValues);

/**
 * Guard Tag Operator - operators for tag guards
 */
export const GuardTagOperatorValues = ["has", "notHas"] as const;
export const GuardTagOperatorSchema = z.enum(GuardTagOperatorValues);

/**
 * Variable Guard Condition
 * Simple key/operator/value comparison for session variables
 *
 * Uses a discriminated union to enforce:
 * - Operators like "equals", "contains", etc. REQUIRE a value
 * - Only "exists" operator allows value to be optional
 */

// Operators that require a comparison value
const ValueRequiredOperators = ["equals", "notEquals", "gt", "gte", "lt", "lte", "contains"] as const;
const ValueRequiredOperatorSchema = z.enum(ValueRequiredOperators);

// Custom schema for required value (rejects undefined/missing)
const RequiredValueSchema = z.custom<unknown>((val) => val !== undefined, { message: "Value is required for comparison operators" });

// Guard condition with required value (for comparison operators)
const GuardVariableWithValueSchema = z.object({
  key: z.string(),
  operator: ValueRequiredOperatorSchema,
  value: RequiredValueSchema, // Required - rejects undefined
});

// Guard condition for exists operator (value is optional/ignored)
const GuardVariableExistsSchema = z.object({
  key: z.string(),
  operator: z.literal("exists"),
  value: z.unknown().optional(), // Optional for exists - checks if key is defined
});

// Union of both schemas - validates based on operator
export const GuardVariableConditionSchema = z.union([GuardVariableWithValueSchema, GuardVariableExistsSchema]);

/**
 * Tag Guard Condition
 * Check if user has or doesn't have a specific tag
 */
export const GuardTagConditionSchema = z.object({
  tag: z.string(),
  operator: GuardTagOperatorSchema,
});

/**
 * Individual guard type schemas for discriminated union
 * Each schema enforces that only the correct fields are present for that guard type
 */

/** Expression guard - uses JavaScript-like expression string */
const ExpressionGuardSchema = z.object({
  type: z.literal("expression"),
  /** Expression string (e.g., "user.score > 50 && tags.includes('vip')") */
  expression: z.string(),
});

/** Variable guard - uses simple key/operator/value comparison */
const VariableGuardSchema = z.object({
  type: z.literal("variable"),
  /** Variable condition with key, operator, and optional value */
  variable: GuardVariableConditionSchema,
});

/** Tag guard - checks if user has/doesn't have a tag */
const TagGuardSchema = z.object({
  type: z.literal("tag"),
  /** Tag condition with tag name and operator (has/notHas) */
  tag: GuardTagConditionSchema,
});

/**
 * Edge Guard Schema (Discriminated Union)
 * Conditions that must pass for an edge to be traversable
 *
 * Guards complement (don't replace) Condition Nodes:
 * - Guards: Simple binary pass/fail on a single edge
 * - Condition Nodes: Complex multi-branch routing logic
 *
 * Uses discriminated union to enforce that only the correct fields
 * are present for each guard type (no mixing expression/variable/tag).
 */
export const EdgeGuardSchema = z.discriminatedUnion("type", [ExpressionGuardSchema, VariableGuardSchema, TagGuardSchema]);

// Deactivation Mode enum values - for journey status changes
// - pause: Freeze timers, can resume later
// - terminate: Cancel all sessions immediately
// - complete: Let running sessions finish, block new ones
export const DeactivationModeValues = ["pause", "terminate", "complete"] as const;

// Deactivation Mode enum schema
export const DeactivationModeSchema = z.enum(DeactivationModeValues);

// Import mindstate config schema from mindstate module
import { JourneyMindstateConfigSchema } from "./mindstate";

// Import variable schemas for journey-level variable type definitions
import { VariableSchemasSchema } from "./variables";

// Note: PluginNodeSchema is still exported from plugins/node.ts for synthetic PluginNode wrappers
// used by frontend's addPlugin() return type. It's no longer part of JourneyConfigSchema.

// Helper to convert null to undefined for optional fields
const nullToUndefined = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((val) => (val === null ? undefined : val), schema);

// Journey Node schema
// Uses .loose() to preserve unknown ReactFlow internal properties on round-trip
export const JourneyNodeSchema = z
  .object({
    id: z.string(),
    type: z.literal("custom"), // ReactFlow node type
    data: JourneyStepDataSchema,
    position: PositionSchema,
    metadata: NodeMetadataSchema,
    // React Flow internal properties (optional, preserved on round-trip)
    selected: z.boolean().optional(),
    dragging: z.boolean().optional(),
    width: nullToUndefined(z.number().optional()),
    height: nullToUndefined(z.number().optional()),
  })
  .loose();

// Journey Edge schema
// Uses .loose() to preserve unknown ReactFlow internal properties on round-trip
export const JourneyEdgeSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: nullToUndefined(z.string().optional()), // For timer edges: "timer", for condition branches: branch id
    targetHandle: nullToUndefined(z.string().optional()), // React Flow target handle
    label: z.string().optional(),
    animated: z.boolean().optional(),
    edgeType: EdgeTypeSchema.optional(),
    style: EdgeStyleSchema.optional(),
    // React Flow internal properties (optional, preserved on round-trip)
    selected: z.boolean().optional(),
    // Managed edge properties (auto-created from button/followup targets)
    managed: z.boolean().optional(), // true = auto-created, engine sees it, UI protects it
    managedBy: z.string().optional(), // "button-{buttonId}" or "followup-{stepIdx}-{buttonId}"
    // Smart Edge properties (guards, actions, delays)
    /** Guard condition - edge only traversable if guard passes (or no guard set) */
    guard: EdgeGuardSchema.optional(),
    /** Fallback edge - used when all other guards fail (safety net) */
    fallback: z.boolean().optional(),
  })
  .loose();

// Journey Config schema (root)
// Note: Plugins are embedded in node.data.plugins[] - no separate pluginNodes array
export const JourneyConfigSchema = z.object({
  nodes: z.array(JourneyNodeSchema),
  edges: z.array(JourneyEdgeSchema),
});

// =============================================================================
// JOURNEY CONFIG RECORD (database record with metadata)
// =============================================================================

/**
 * JourneyConfigRecord - Canonical type for journey database records.
 *
 * Single source of truth for journey records used by:
 * - API service (journey-service.ts)
 * - Web API client (api/types.ts)
 *
 * Uses z.coerce.date() to handle both Date objects (from DB) and
 * ISO strings (from JSON serialization) transparently.
 */
export const JourneyConfigRecordSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  status: JourneyStatusSchema.nullable(),
  configuration: JourneyConfigSchema,
  organizationId: z.string().uuid().nullable(),
  defaultPipelineId: z.string().uuid().nullable(),
  /**
   * Optional mindstate tracking configuration
   * When set, the journey will track specified mindstate definitions
   */
  mindstateConfig: JourneyMindstateConfigSchema.nullable().optional(),
  /**
   * Allowlist of journey IDs that users can be transferred TO from this journey.
   * Used by IJourneyService for AI/node-initiated transfers.
   *
   * - Empty array or undefined = no transfers allowed (explicit opt-in required)
   * - Array of journey IDs = only these journeys are allowed as transfer targets
   */
  transferAllowlist: z.array(z.string()).nullable().optional(),
  /**
   * Variable schema definitions for autocomplete and validation.
   * Defines expected structure of user, session, and custom variables.
   *
   * @example
   * ```typescript
   * variableSchemas: {
   *   user: {
   *     type: "object",
   *     properties: {
   *       email: { type: "string", format: "email" },
   *       tier: { type: "string", enum: ["free", "pro"] }
   *     }
   *   }
   * }
   * ```
   */
  variableSchemas: VariableSchemasSchema.nullable().optional(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date().nullable(),
});

// Scenario schema for predefined paths
export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  nodeSequence: z.array(z.string()),
  edgeSequence: z.array(z.string()),
});

// Scenarios array schema
export const ScenariosSchema = z.array(ScenarioSchema);

// Manifest schema for journey list
export const ManifestSchema = z.object({
  journeys: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
    })
  ),
});

// =============================================================================
// INPUT VALIDATION SCHEMAS
// =============================================================================

/**
 * Create journey input schema
 * Omits auto-generated fields (id, timestamps)
 *
 * @example
 * const input: CreateJourneyInput = {
 *   name: "Welcome Journey",
 *   description: "Onboarding flow for new users",
 *   configuration: { nodes: [], edges: [] },
 *   status: "draft",
 * };
 */
export const CreateJourneyInputSchema = JourneyConfigRecordSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
}).extend({
  // Override nullable fields to be optional for cleaner input
  slug: z.string().optional(),
  description: z.string().optional(),
  status: JourneyStatusSchema.optional().default("draft"),
  organizationId: z.string().uuid().optional(),
  /** Pipeline ID or null to use org default. Use .nullish() to accept null from API calls. */
  defaultPipelineId: z.string().uuid().nullish(),
  /** Allowlist of journey IDs users can be transferred to. Empty/undefined = no transfers allowed. */
  transferAllowlist: z.array(z.string()).nullish(),
});

/**
 * Update journey input schema
 * All fields are optional for partial updates
 *
 * @example
 * const update: UpdateJourneyInput = {
 *   name: "Updated Journey Name",
 *   status: "active",
 * };
 */
export const UpdateJourneyInputSchema = CreateJourneyInputSchema.partial().extend({
  /** Status is optional for updates - override to remove .default("draft") from CreateJourneyInputSchema */
  status: JourneyStatusSchema.optional(),
  /** Required when changing status from active to inactive/archived */
  deactivationMode: DeactivationModeSchema.optional(),
});

// =============================================================================
// VERSION MANAGEMENT SCHEMAS
// =============================================================================

/**
 * Journey version metadata
 * Represents a saved snapshot of a journey configuration
 */
export const JourneyVersionSchema = z.object({
  id: z.string().uuid(),
  journeyId: z.string().uuid(),
  versionId: z.string(), // "v001", "v002", etc.
  notes: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.coerce.date(),
});

/**
 * Save version input schema
 * Used when saving a new version of a journey
 */
export const SaveVersionInputSchema = z.object({
  versionId: z.string().min(1),
  notes: z.string().optional(),
  configuration: JourneyConfigSchema,
});

/**
 * Atomic save input schema
 * Used for atomic save endpoint (version ID generated server-side)
 */
export const AtomicSaveInputSchema = z.object({
  notes: z.string().optional(),
  configuration: JourneyConfigSchema,
});

/**
 * Versioned journey data with full configuration
 * Returned when loading a specific version
 */
export const VersionedJourneyDataSchema = z.object({
  version: JourneyVersionSchema,
  data: JourneyConfigSchema,
});

/**
 * Journey list query parameters
 */
export const JourneyListQuerySchema = z.object({
  status: JourneyStatusSchema.optional(),
  organizationId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

// Type exports derived from Zod schemas
// Note: NodeType is exported from ./nodes, not redefined here
// Note: JourneyMindstateConfig is exported from ./mindstate, not redefined here
// Note: JourneyStatus is exported from ./common (single source of truth)
export type EdgeType = z.infer<typeof EdgeTypeSchema>;
export type DeactivationMode = z.infer<typeof DeactivationModeSchema>;

// Smart Edge types (guards, actions, delays)
export type GuardType = z.infer<typeof GuardTypeSchema>;
export type GuardVariableOperator = z.infer<typeof GuardVariableOperatorSchema>;
export type GuardTagOperator = z.infer<typeof GuardTagOperatorSchema>;
export type GuardVariableCondition = z.infer<typeof GuardVariableConditionSchema>;
export type GuardTagCondition = z.infer<typeof GuardTagConditionSchema>;
export type EdgeGuard = z.infer<typeof EdgeGuardSchema>;
export type JourneyNodeData = z.infer<typeof JourneyNodeSchema>;
export type JourneyEdgeData = z.infer<typeof JourneyEdgeSchema>;
export type JourneyConfig = z.infer<typeof JourneyConfigSchema>;
export type JourneyConfigRecord = z.infer<typeof JourneyConfigRecordSchema>;
export type CreateJourneyInput = z.infer<typeof CreateJourneyInputSchema>;
export type UpdateJourneyInput = z.infer<typeof UpdateJourneyInputSchema>;
export type JourneyListQuery = z.infer<typeof JourneyListQuerySchema>;
export type ScenarioPath = z.infer<typeof ScenarioSchema>;
export type JourneyVersion = z.infer<typeof JourneyVersionSchema>;
export type SaveVersionInput = z.infer<typeof SaveVersionInputSchema>;
export type AtomicSaveInput = z.infer<typeof AtomicSaveInputSchema>;
export type VersionedJourneyData = z.infer<typeof VersionedJourneyDataSchema>;

export interface JourneyAtomicSaveResult {
  version: JourneyVersion;
  versionId: string;
}

export interface JourneyDeactivationResult {
  sessionsAffected: number;
  timersAffected: number;
}

// Note: Node types and schemas (MessageNodeData, ConditionNodeDataSchema, etc.) are
// exported from ./nodes and available via @journey/schemas. No need to re-export here.
//
// Guard schemas (EdgeGuardSchema, GuardTypeValues, etc.) are already exported
// at their definition site above. They can be imported directly from @journey/schemas.
