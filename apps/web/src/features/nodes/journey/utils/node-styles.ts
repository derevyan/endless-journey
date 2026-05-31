/**
 * Node Styles Utilities
 *
 * Shared styling utilities for node components.
 *
 * @module lib/node-styles
 */

/**
 * Returns CSS classes to show/hide handles based on edit mode.
 * In edit mode, handles are visible and interactive.
 * In view mode, handles are hidden and non-interactive.
 */
export function getHandleVisibility(isEditMode: boolean): string {
  return isEditMode ? "" : "opacity-0 pointer-events-none";
}

/**
 * Returns CSS classes for journey visualization ring styles.
 * Used to highlight nodes based on their state in the journey.
 */
export function getJourneyVisualizationClasses(isJourneyVisited?: boolean, isJourneyCurrent?: boolean, isJourneyDropped?: boolean): string {
  if (isJourneyCurrent) return "ring-2 ring-sky-500 shadow-md shadow-sky-500/20";
  if (isJourneyDropped) return "ring-2 ring-destructive/50";
  if (isJourneyVisited) return "ring-2 ring-sky-500/50";
  return "";
}
