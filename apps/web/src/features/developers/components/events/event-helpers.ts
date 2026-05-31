/**
 * Event Helpers
 *
 * Helper utilities for event display and metadata derivation from EVENT_REGISTRY.
 *
 * @module components/developers/events/event-helpers
 */

import { format } from "date-fns";

import { EVENT_REGISTRY, type EventCategory, type EventContextType, type EventLogLevel, type EventType } from "@journey/schemas";

// =============================================================================
// CATEGORY LABELS
// =============================================================================

/** Simple category labels */
export const CATEGORY_LABELS: Record<EventCategory, string> = {
  bot: "Bot",
  crm: "CRM",
  tag: "Tags",
  variable: "Variables",
  journey: "Journey",
  interaction: "Interaction",
  workflow: "Workflow",
  mindstate: "Mindstate",
  system: "System",
};

// =============================================================================
// METADATA HELPERS
// =============================================================================

export interface EventMetadata {
  category: EventCategory;
  contextType: EventContextType;
  level: EventLogLevel;
  description: string;
}

/**
 * Get event metadata from registry
 */
export function getEventMetadata(eventType: string): EventMetadata | null {
  const entry = EVENT_REGISTRY[eventType as EventType];
  if (!entry) return null;

  return {
    category: entry.category,
    contextType: entry.contextType,
    level: entry.level,
    description: entry.description,
  };
}

/**
 * Get category label
 */
export function getCategoryLabel(category: EventCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

// =============================================================================
// GROUPING HELPERS
// =============================================================================

export interface EventTypeInfo {
  type: string;
  label: string;
  description: string;
  level: EventLogLevel;
}

export interface GroupedEventTypes {
  category: EventCategory;
  label: string;
  types: EventTypeInfo[];
}

/**
 * Get all event types grouped by category
 */
export function getEventTypesByCategory(): GroupedEventTypes[] {
  const grouped: Record<EventCategory, EventTypeInfo[]> = {
    bot: [],
    crm: [],
    tag: [],
    variable: [],
    journey: [],
    interaction: [],
    workflow: [],
    mindstate: [],
    system: [],
  };

  for (const [type, entry] of Object.entries(EVENT_REGISTRY)) {
    grouped[entry.category].push({
      type,
      label: formatEventTypeLabel(type),
      description: entry.description,
      level: entry.level,
    });
  }

  // Return only categories with types, ordered
  const order: EventCategory[] = ["bot", "crm", "tag", "variable", "journey", "interaction", "workflow", "mindstate", "system"];

  return order
    .filter((cat) => grouped[cat].length > 0)
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      types: grouped[category],
    }));
}

/**
 * Format event type string to readable label
 * e.g., "crm.stage.changed" -> "Stage Changed"
 */
export function formatEventTypeLabel(type: string): string {
  const parts = type.split(".");
  const relevantParts = parts.slice(1);
  return relevantParts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

/**
 * Format event type for display (short version)
 * e.g., "crm.stage.changed" -> "stage.changed"
 */
export function formatEventTypeShort(type: string): string {
  const parts = type.split(".");
  return parts.slice(1).join(".");
}

// =============================================================================
// ALL EVENT TYPES LIST
// =============================================================================

/**
 * Get all registered event types
 */
export function getAllEventTypes(): string[] {
  return Object.keys(EVENT_REGISTRY);
}

// =============================================================================
// LOG LEVEL HELPERS
// =============================================================================

export interface LogLevelOption {
  label: string;
  value: EventLogLevel;
}

/**
 * Get all log levels used in the event registry
 * Dynamically extracts unique levels from registered events
 */
export function getLogLevels(): LogLevelOption[] {
  const levels = new Set<EventLogLevel>();
  for (const entry of Object.values(EVENT_REGISTRY)) {
    levels.add(entry.level);
  }
  // Order: info, warn, error, debug (most common first)
  const order: EventLogLevel[] = ["info", "warn", "error", "debug"];
  return order
    .filter((l) => levels.has(l))
    .map((l) => ({
      label: l === "warn" ? "Warning" : l.charAt(0).toUpperCase() + l.slice(1),
      value: l,
    }));
}

// =============================================================================
// TIMESTAMP HELPERS
// =============================================================================

/**
 * Format ISO timestamp to readable format
 * Used by all event tables (events, crm-activity, llm-usage)
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return format(date, "yyyy-MM-dd HH:mm:ss");
  } catch {
    return timestamp;
  }
}
