/**
 * Date Utilities
 *
 * Shared date manipulation utilities for the application.
 *
 * @module lib/date-utils
 */

// =============================================================================
// TYPES
// =============================================================================

export type Timeline = "30min" | "1hour" | "24hours" | "7days" | "custom";

/**
 * Timeline filter options for UI selects
 */
export const TIMELINE_OPTIONS = [
  { label: "Past 30 minutes", value: "30min" },
  { label: "Past 1 hour", value: "1hour" },
  { label: "Past 24 hours", value: "24hours" },
  { label: "Past 7 days", value: "7days" },
  { label: "Custom", value: "custom" },
] as const;

// =============================================================================
// TIMELINE UTILITIES
// =============================================================================

/**
 * Get date range for timeline filter.
 * Rounds dates to the nearest second to avoid microsecond differences
 * that cause query key changes and infinite loops.
 *
 * @param timeline - The timeline period to calculate
 * @returns Object with startDate and endDate ISO strings, or empty object for custom
 */
export function getTimelineRange(timeline: Timeline): { startDate?: string; endDate?: string } {
  const now = new Date();
  const nowRounded = new Date(Math.floor(now.getTime() / 1000) * 1000);
  let startDate: Date | undefined;

  switch (timeline) {
    case "30min":
      startDate = new Date(nowRounded.getTime() - 30 * 60 * 1000);
      break;
    case "1hour":
      startDate = new Date(nowRounded.getTime() - 60 * 60 * 1000);
      break;
    case "24hours":
      startDate = new Date(nowRounded.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7days":
      startDate = new Date(nowRounded.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "custom":
      return {};
  }

  return {
    startDate: startDate?.toISOString(),
    endDate: nowRounded.toISOString(),
  };
}

// =============================================================================
// RELATIVE TIME FORMATTING
// =============================================================================

/**
 * Format a date as a relative time string.
 * Returns human-readable strings like "Just now", "5m ago", "2h ago", "3d ago"
 */
export function formatRelativeTime(dateStr: string | Date | null): string {
  if (!dateStr) return "Unknown";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}














