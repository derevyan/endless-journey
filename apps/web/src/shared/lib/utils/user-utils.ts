/**
 * User Utility Functions
 *
 * Shared utilities for user/client display and formatting.
 *
 * @module lib/user-utils
 */

interface Entity {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}

/**
 * Get a display-friendly name for a user or client.
 * Prioritizes: full name > username > truncated ID
 */
export function getDisplayName(entity: Entity): string {
  if (entity.firstName || entity.lastName) {
    return `${entity.firstName || ""} ${entity.lastName || ""}`.trim();
  }
  if (entity.username) {
    return entity.username;
  }
  return entity.id.slice(0, 8);
}

