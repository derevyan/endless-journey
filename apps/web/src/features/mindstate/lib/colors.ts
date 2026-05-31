/**
 * Agent Color System
 *
 * Provides consistent color theming for agents and parameters.
 */

export interface AgentColorClasses {
  bg: string;
  softBg: string;
  border: string;
  ring: string;
  text: string;
  progressBar: string;
}

/**
 * Color definitions for agent themes
 */
export const AGENT_COLORS: Record<string, AgentColorClasses> = {
  indigo: {
    bg: "bg-indigo-500",
    softBg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    ring: "ring-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
    progressBar: "[&>div]:bg-indigo-500",
  },
  blue: {
    bg: "bg-blue-500",
    softBg: "bg-blue-500/10",
    border: "border-blue-500/30",
    ring: "ring-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    progressBar: "[&>div]:bg-blue-500",
  },
  rose: {
    bg: "bg-rose-500",
    softBg: "bg-rose-500/10",
    border: "border-rose-500/30",
    ring: "ring-rose-500/20",
    text: "text-rose-600 dark:text-rose-400",
    progressBar: "[&>div]:bg-rose-500",
  },
  emerald: {
    bg: "bg-emerald-500",
    softBg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    ring: "ring-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    progressBar: "[&>div]:bg-emerald-500",
  },
  amber: {
    bg: "bg-amber-500",
    softBg: "bg-amber-500/10",
    border: "border-amber-500/30",
    ring: "ring-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    progressBar: "[&>div]:bg-amber-500",
  },
  purple: {
    bg: "bg-purple-500",
    softBg: "bg-purple-500/10",
    border: "border-purple-500/30",
    ring: "ring-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
    progressBar: "[&>div]:bg-purple-500",
  },
  fuchsia: {
    bg: "bg-fuchsia-500",
    softBg: "bg-fuchsia-500/10",
    border: "border-fuchsia-500/30",
    ring: "ring-fuchsia-500/20",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    progressBar: "[&>div]:bg-fuchsia-500",
  },
  cyan: {
    bg: "bg-cyan-500",
    softBg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    ring: "ring-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
    progressBar: "[&>div]:bg-cyan-500",
  },
  orange: {
    bg: "bg-orange-500",
    softBg: "bg-orange-500/10",
    border: "border-orange-500/30",
    ring: "ring-orange-500/20",
    text: "text-orange-600 dark:text-orange-400",
    progressBar: "[&>div]:bg-orange-500",
  },
  teal: {
    bg: "bg-teal-500",
    softBg: "bg-teal-500/10",
    border: "border-teal-500/30",
    ring: "ring-teal-500/20",
    text: "text-teal-600 dark:text-teal-400",
    progressBar: "[&>div]:bg-teal-500",
  },
  slate: {
    bg: "bg-slate-500",
    softBg: "bg-slate-500/10",
    border: "border-slate-500/30",
    ring: "ring-slate-500/20",
    text: "text-slate-600 dark:text-slate-400",
    progressBar: "[&>div]:bg-slate-500",
  },
};

/**
 * Get color classes for an agent by color name
 */
export function getAgentColorClasses(colorName?: string): AgentColorClasses {
  return AGENT_COLORS[colorName || "indigo"] || AGENT_COLORS.indigo;
}

/**
 * Available color options for pickers
 */
export const COLOR_OPTIONS = Object.keys(AGENT_COLORS) as Array<keyof typeof AGENT_COLORS>;

/**
 * Get semantic color for a parameter value based on its configuration
 */
export function getSemanticValueColor(
  value: number,
  min: number,
  max: number,
  semanticDirection?: "low_is_good" | "high_is_good"
): "good" | "warning" | "bad" | "neutral" {
  const normalized = (value - min) / (max - min);

  if (semanticDirection === "low_is_good") {
    if (normalized < 0.3) return "good";
    if (normalized < 0.7) return "warning";
    return "bad";
  } else if (semanticDirection === "high_is_good") {
    if (normalized > 0.7) return "good";
    if (normalized > 0.3) return "warning";
    return "bad";
  }

  return "neutral";
}

/**
 * Get tailwind classes for semantic value colors
 */
export function getSemanticColorClasses(semantic: "good" | "warning" | "bad" | "neutral"): string {
  switch (semantic) {
    case "good":
      return "text-green-600 dark:text-green-400";
    case "warning":
      return "text-yellow-600 dark:text-yellow-400";
    case "bad":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Category to icon name mapping
 */
export const CATEGORY_ICONS: Record<string, string> = {
  Emotional: "Heart",
  Mental: "Brain",
  Physical: "Activity",
  Motivation: "Zap",
  Cognitive: "Lightbulb",
  Social: "Users",
  Informational: "Info",
  Trait: "Fingerprint",
};

/**
 * Get icon name for a category
 */
export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || "Circle";
}
