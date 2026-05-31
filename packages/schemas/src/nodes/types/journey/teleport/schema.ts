import { z } from "zod";
import { BaseNodeDataSchema } from "../../../base";

// Teleport node schema - transfers user to another journey
export const TeleportNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("teleport"),
  // Target journey ID (must be different from current)
  // Optional in schema - validated at form/editor level for cascading UI pattern
  targetJourneyId: z.string().min(1, "Target journey is required").optional(),
  // Target node ID within the journey (if not set, starts from start node)
  targetNodeId: z.string().optional(),
  // Whether to preserve context when teleporting (filtered for safety)
  preserveContext: z.boolean().default(true),
});

export type TeleportNodeData = z.infer<typeof TeleportNodeDataSchema>;
