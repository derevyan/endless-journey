/**
 * CRM Activity Helpers
 *
 * Shared utilities for CRM activity display.
 * Note: For activity type formatting, import directly from @journey/schemas:
 *   - getCrmActivityLabel
 *   - getCrmActivityVariant
 *
 * @module components/developers/events/crm-activity-helpers
 */

import type { CrmActivity } from "@/hooks/queries/use-events";

// =============================================================================
// CLIENT HELPERS
// =============================================================================

/**
 * Get display name for a CRM client
 */
export function getClientName(activity: CrmActivity): string {
  if (activity.clientFirstName || activity.clientLastName) {
    return [activity.clientFirstName, activity.clientLastName].filter(Boolean).join(" ");
  }
  if (activity.clientUsername) {
    return `@${activity.clientUsername}`;
  }
  if (activity.clientId) {
    return activity.clientId.slice(0, 8);
  }
  return "Unknown";
}
