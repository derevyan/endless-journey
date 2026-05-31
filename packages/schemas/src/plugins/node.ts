import { z } from "zod";
import { NodeMetadataSchema, PositionSchema } from "../nodes/base";
import { PluginDataSchema } from "./follow-up";

// Helper to convert null to undefined for optional fields
const nullToUndefined = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((val) => (val === null ? undefined : val), schema);

/**
 * Plugin Node Schema
 *
 * Represents a plugin node on the journey canvas.
 * Plugin nodes attach to parent nodes via plugin edges.
 *
 * Uses .loose() to preserve unknown ReactFlow internal properties.
 */
export const PluginNodeSchema = z
  .object({
    /** Unique plugin node ID (e.g., "plugin-fu-v1-button") */
    id: z.string(),
    /** ReactFlow node type for plugins */
    type: z.literal("plugin"),
    /** Plugin configuration data */
    data: PluginDataSchema,
    /** Canvas position - typically offset from parent node */
    position: PositionSchema,
    /** Optional metadata (notes, etc.) */
    metadata: NodeMetadataSchema.optional(),
    /** Parent node ID that this plugin attaches to */
    parentNodeId: z.string(),
    // React Flow internal properties (optional, preserved on round-trip)
    selected: z.boolean().optional(),
    dragging: z.boolean().optional(),
    width: nullToUndefined(z.number().optional()),
    height: nullToUndefined(z.number().optional()),
  })
  .loose();

export type PluginNode = z.infer<typeof PluginNodeSchema>;

/**
 * Plugin Node Types constant
 *
 * Named constants for plugin node types (mirrors NodeTypes pattern)
 */
export const PluginTypes = {
  FOLLOWUP: "followup",
  // Future plugins:
  // ANALYTICS: "analytics",
  // RATE_LIMIT: "ratelimit",
} as const;

export const PluginTypeValues = [PluginTypes.FOLLOWUP] as const;

export const PluginTypeSchema = z.enum(PluginTypeValues);

export type PluginType = z.infer<typeof PluginTypeSchema>;
