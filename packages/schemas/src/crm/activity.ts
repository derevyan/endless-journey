import { z } from "zod";
import { ActivitySourceSchema } from "./common";

/**
 * CRM Activity Schemas
 *
 * Schemas for activity log entries and activity types registry.
 */

// =============================================================================
// ACTIVITY TYPES REGISTRY
// =============================================================================

/**
 * Badge variant type for activity display
 */
export type ActivityBadgeVariant = "default" | "secondary" | "destructive" | "outline";

/**
 * CRM Activity Types Registry
 * Single source of truth for all CRM activity types.
 */
export const CRM_ACTIVITY_TYPES = {
  stage_change: { label: "Stage Change", variant: "default" as const },
  pipeline_entered: { label: "Pipeline Entered", variant: "default" as const },
  pipeline_removed: { label: "Pipeline Removed", variant: "destructive" as const },
  field_update: { label: "Field Update", variant: "outline" as const },
  message_sent: { label: "Message Sent", variant: "outline" as const },
  message_received: { label: "Message Received", variant: "outline" as const },
  tag_added: { label: "Tag Added", variant: "secondary" as const },
  tag_removed: { label: "Tag Removed", variant: "secondary" as const },
  journey_started: { label: "Journey Started", variant: "default" as const },
  journey_completed: { label: "Journey Completed", variant: "default" as const },
  note_added: { label: "Note Added", variant: "outline" as const },
  user_interaction: { label: "User Interaction", variant: "outline" as const },
} as const;

/**
 * CRM Activity Type union - derived from registry keys
 */
export type CrmActivityType = keyof typeof CRM_ACTIVITY_TYPES;

/**
 * Get all CRM activity types for filter dropdowns
 */
export function getCrmActivityTypes(): { label: string; value: string; variant: ActivityBadgeVariant }[] {
  return Object.entries(CRM_ACTIVITY_TYPES).map(([value, meta]) => ({
    label: meta.label,
    value,
    variant: meta.variant,
  }));
}

/**
 * Get display label for an activity type
 */
export function getCrmActivityLabel(type: string): string {
  return CRM_ACTIVITY_TYPES[type as CrmActivityType]?.label ?? type;
}

/**
 * Get badge variant for an activity type
 */
export function getCrmActivityVariant(type: string): ActivityBadgeVariant {
  return CRM_ACTIVITY_TYPES[type as CrmActivityType]?.variant ?? "outline";
}

// =============================================================================
// ACTIVITY ENTRY SCHEMA
// =============================================================================

// Activity entry for timeline
export const ActivityEntrySchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  type: z.string(),
  description: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  performedBy: z.string().uuid().nullable(),
  performedByName: z.string().nullable(),
  createdAt: z.coerce.date().nullable(),
  source: ActivitySourceSchema,
});

// Inferred types
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;
