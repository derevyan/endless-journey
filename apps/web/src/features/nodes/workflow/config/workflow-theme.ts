/**
 * Workflow Node Theme Configuration
 *
 * Single source of truth for visual constants in the Workflow Builder.
 * Follows the same pattern as journey builder's node-theme.ts.
 *
 * @module features/nodes/workflow/config/workflow-theme
 */

import type { WorkflowNodeType } from "@journey/schemas";

// =============================================================================
// NODE DIMENSIONS - Size tiers based on node complexity
// =============================================================================

/**
 * Premium shadows and border constants
 */
export const WORKFLOW_VISUAL_CONSTANTS = {
  borderRadius: "rounded-2xl",
  shadow: {
    default: "shadow-sm border-border/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
    premium: "shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]",
    selected: "shadow-xl border-primary/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
  },
  header: {
    iconWrapper: "size-7 rounded-full flex items-center justify-center shrink-0 shadow-inner ring-1 ring-inset ring-black/5 dark:ring-white/5",
    fontSize: "text-[13px] font-semibold tracking-tight",
    subtitleSize: "text-[10px] font-medium text-muted-foreground leading-tight",
  },
  transitions: "transition-all duration-300 ease-out",
  hover: "hover:-translate-y-0.5 hover:shadow-lg",
} as const;

/**
 * Two-tier sizing for workflow nodes.
 */
export type WorkflowNodeSize = "compact" | "standard";

export const WORKFLOW_NODE_DIMENSIONS: Record<
  WorkflowNodeSize,
  {
    minWidth: string;
    maxWidth: string;
    iconSize: string;
    padding: string;
    headerPadding: string;
  }
> = {
  compact: {
    minWidth: "min-w-[140px]",
    maxWidth: "max-w-[180px]",
    iconSize: "size-3.5",
    padding: "px-3 py-2",
    headerPadding: "px-3 py-2",
  },
  standard: {
    minWidth: "min-w-[200px]",
    maxWidth: "max-w-[280px]",
    iconSize: "size-4",
    padding: "px-4 py-3",
    headerPadding: "px-4 py-2.5",
  },
};

/**
 * Maps each workflow node type to its size tier.
 */
export const WORKFLOW_NODE_SIZES: Record<WorkflowNodeType, WorkflowNodeSize> = {
  start: "compact",
  end: "compact",
  set_state: "compact",
  transform: "compact",
  context: "compact",
  mcp: "compact",
  guard: "compact",
  question_understanding: "compact",
  if_else: "compact",
  user_approval: "compact",
  agent: "standard",
};

export function getWorkflowNodeDimensions(nodeType: string) {
  const size = WORKFLOW_NODE_SIZES[nodeType as WorkflowNodeType] || "standard";
  return WORKFLOW_NODE_DIMENSIONS[size];
}

// =============================================================================
// NODE TYPE TO COLOR MAPPING
// =============================================================================

export const WORKFLOW_NODE_COLORS: Record<WorkflowNodeType, string> = {
  start: "emerald",
  end: "slate",
  agent: "violet", 
  guard: "rose",
  question_understanding: "indigo",
  context: "sky",
  transform: "violet",
  set_state: "blue",
  if_else: "fuchsia",
  mcp: "amber",
  user_approval: "orange",
};

export function getWorkflowNodeColor(nodeType: WorkflowNodeType): string {
  return WORKFLOW_NODE_COLORS[nodeType] ?? "slate";
}

// =============================================================================
// COLOR SCHEME INTERFACE
// =============================================================================

export interface WorkflowColorScheme {
  icon: string;
  iconBg: string;
  nodeBg: string; // Used for glassmorphism base
  border: string;
  header: string;
  selected: string;
  badge: string;
  glow: string;
}

// =============================================================================
// THEME DEFINITIONS
// =============================================================================

const WORKFLOW_THEMES: Record<string, WorkflowColorScheme> = {
  slate: {
    icon: "text-slate-600 dark:text-slate-400",
    iconBg: "bg-slate-500/20 dark:bg-slate-500/30",
    nodeBg: "bg-card/90",
    border: "border-border hover:border-slate-500/50 dark:hover:border-slate-400/50",
    header: "bg-gradient-to-b from-slate-500/10 to-slate-500/5 dark:from-slate-500/20 dark:to-slate-500/10",
    selected: "border-slate-500/80 ring-2 ring-slate-500/20",
    badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    glow: "shadow-[0_0_20px_rgba(100,116,139,0.15)]",
  },
  emerald: {
    icon: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-500/20 dark:bg-emerald-500/30",
    nodeBg: "bg-card/90",
    border: "border-border hover:border-emerald-500/50 dark:hover:border-emerald-400/50",
    header: "bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/10",
    selected: "border-emerald-500/80 ring-2 ring-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
  },
  violet: {
    icon: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-500/20 dark:bg-violet-500/30",
    nodeBg: "bg-card/90",
    border: "border-border hover:border-violet-500/50 dark:hover:border-violet-400/50",
    header: "bg-violet-500/5 dark:bg-violet-500/10",
    selected: "border-violet-500/80 ring-2 ring-violet-500/20",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)]",
  },
  rose: {
    icon: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-500/20 dark:bg-rose-500/30",
    nodeBg: "bg-card/90",
    border: "border-border hover:border-rose-500/50 dark:hover:border-rose-400/50",
    header: "bg-rose-500/5 dark:bg-rose-500/10",
    selected: "border-rose-500/80 ring-2 ring-rose-500/20",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)]",
  },
  sky: {
    icon: "text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-500/20 dark:bg-sky-500/30",
    nodeBg: "bg-card/90",
    border: "border-border hover:border-sky-500/50 dark:hover:border-sky-400/50",
    header: "bg-sky-500/5 dark:bg-sky-500/10",
    selected: "border-sky-500/80 ring-2 ring-sky-500/20",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    glow: "shadow-[0_0_20px_rgba(14,165,233,0.15)]",
  },
  fuchsia: {
    icon: "text-fuchsia-600 dark:text-fuchsia-400",
    iconBg: "bg-fuchsia-500/20 dark:bg-fuchsia-500/30",
    nodeBg: "bg-card/90",
    border: "border-border hover:border-fuchsia-500/50 dark:hover:border-fuchsia-400/50",
    header: "bg-fuchsia-500/5 dark:bg-fuchsia-500/10",
    selected: "border-fuchsia-500/80 ring-2 ring-fuchsia-500/20",
    badge: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
    glow: "shadow-[0_0_20px_rgba(232,121,249,0.15)]",
  },
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/20 dark:bg-blue-500/30",
    nodeBg: "bg-card/90",
    border: "border-border hover:border-blue-500/50 dark:hover:border-blue-400/50",
    header: "bg-blue-500/5 dark:bg-blue-500/10",
    selected: "border-blue-500/80 ring-2 ring-blue-500/20",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]",
  },
  amber: {
    icon: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/20 dark:bg-amber-500/30",
    nodeBg: "bg-card/90",
    border: "border-border hover:border-amber-500/50 dark:hover:border-amber-400/50",
    header: "bg-amber-500/5 dark:bg-amber-500/10",
    selected: "border-amber-500/80 ring-2 ring-amber-500/20",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
  },
  orange: {
    icon: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-500/20 dark:bg-orange-500/30",
    nodeBg: "bg-card/90",
    border: "border-border hover:border-orange-500/50 dark:hover:border-orange-400/50",
    header: "bg-orange-500/5 dark:bg-orange-500/10",
    selected: "border-orange-500/80 ring-2 ring-orange-500/20",
    badge: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.15)]",
  },
  indigo: {
    icon: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-500/20 dark:bg-indigo-500/30",
    nodeBg: "bg-card/90",
    border: "border-border hover:border-indigo-500/50 dark:hover:border-indigo-400/50",
    header: "bg-indigo-500/5 dark:bg-indigo-500/10",
    selected: "border-indigo-500/80 ring-2 ring-indigo-500/20",
    badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    glow: "shadow-[0_0_20px_rgba(79,70,229,0.15)]",
  },
};

// =============================================================================
// EDGE STYLING
// =============================================================================

export interface WorkflowEdgeStyle {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

/**
 * Default edge configuration.
 * Adjust strokeWidth here to change all edge thicknesses.
 */
export const WORKFLOW_EDGE_DEFAULTS = {
  strokeWidth: 1, // Default stroke width for all edges
} as const;

export const WORKFLOW_EDGE_STYLES = {
  default: { stroke: "#22c55e", strokeWidth: WORKFLOW_EDGE_DEFAULTS.strokeWidth },
  yes: { stroke: "#22c55e", strokeWidth: WORKFLOW_EDGE_DEFAULTS.strokeWidth },
  no: { stroke: "#f97316", strokeWidth: WORKFLOW_EDGE_DEFAULTS.strokeWidth, strokeDasharray: "6,4" },
  passed: { stroke: "#22c55e", strokeWidth: WORKFLOW_EDGE_DEFAULTS.strokeWidth },
  blocked: { stroke: "#f43f5e", strokeWidth: WORKFLOW_EDGE_DEFAULTS.strokeWidth, strokeDasharray: "4,4" },
  approved: { stroke: "#22c55e", strokeWidth: WORKFLOW_EDGE_DEFAULTS.strokeWidth },
  rejected: { stroke: "#f43f5e", strokeWidth: WORKFLOW_EDGE_DEFAULTS.strokeWidth, strokeDasharray: "4,4" },
} as const;

export const WORKFLOW_EDGE_SELECTED_STYLE: WorkflowEdgeStyle = {
  stroke: "#3b82f6",
  strokeWidth: WORKFLOW_EDGE_DEFAULTS.strokeWidth + 1,
};

export const WORKFLOW_EDGE_VISITED_STYLE: WorkflowEdgeStyle = {
  stroke: "#0ea5e9",
  strokeWidth: WORKFLOW_EDGE_DEFAULTS.strokeWidth + 1,
};

// =============================================================================
// HANDLE STYLING
// =============================================================================

/**
 * Handle styles for workflow nodes.
 * Handles are the connection points on nodes.
 */
export const WORKFLOW_HANDLE_STYLES = {
  // Default handle (single input/output)
  default: {
    size: "!w-1.5 !h-1.5",
    bg: "!bg-muted-foreground",
    border: "!border !border-background",
    shadow: "shadow-xs",
    interaction: "transition-all duration-200 hover:ring-1 hover:ring-primary/50",
  },
  // Branching handles (yes/no, pass/block)
  branching: {
    size: "!w-1.5 !h-1.5",
    border: "!border !border-background",
    shadow: "shadow-xs",
    interaction: "transition-transform duration-200 hover:ring-1 hover:ring-primary/50",
  },
  // Handle colors by type
  colors: {
    positive: "!bg-emerald-500", // yes, passed, approved
    negative: "!bg-rose-500",    // no, blocked, rejected
    neutral: "!bg-muted-foreground",
  },
  // Branching labels (PASS, BLOCK, YES, NO)
  label: {
    position: "absolute",
    rightOffset: "right-1.5", // Distance from right edge
    fontSize: "text-[4px]",
    font: "font-medium",
    color: "text-muted-foreground/60",
    transform: "uppercase tracking-wide",
    pointerEvents: "pointer-events-none",
  },
  // Positioning adjustments (in pixels)
  // Positive = move right, Negative = move left
  positioning: {
    branchingHandleOffset: 1 as number, // Horizontal offset for branching handles (px)
    branchingVerticalOffset: 0 as number, // Vertical offset for branching handles (px)
    labelRightOffset: 6 as number,      // Distance from right edge for labels (px) - use this instead of rightOffset class
  },
} as const;

/**
 * Get handle color class based on handle ID.
 * Green for positive/success paths, red for negative/blocked paths.
 */
export function getWorkflowHandleColor(handleId: string): string {
  const positiveHandles = ["yes", "passed", "approved"];
  const negativeHandles = ["no", "blocked", "rejected"];

  if (positiveHandles.includes(handleId)) {
    return WORKFLOW_HANDLE_STYLES.colors.positive;
  }
  if (negativeHandles.includes(handleId)) {
    return WORKFLOW_HANDLE_STYLES.colors.negative;
  }
  return WORKFLOW_HANDLE_STYLES.colors.neutral;
}

/**
 * Get combined handle classes for default handles.
 */
export function getDefaultHandleClasses(): string {
  const s = WORKFLOW_HANDLE_STYLES.default;
  return `${s.size} ${s.bg} ${s.border} ${s.shadow} ${s.interaction}`;
}

/**
 * Get combined handle classes for branching handles.
 */
export function getBranchingHandleClasses(handleId: string): string {
  const s = WORKFLOW_HANDLE_STYLES.branching;
  return `${s.size} ${s.border} ${s.shadow} ${s.interaction} ${getWorkflowHandleColor(handleId)}`;
}

/**
 * Get combined label classes for branching labels.
 */
export function getBranchingLabelClasses(): string {
  const s = WORKFLOW_HANDLE_STYLES.label;
  return `${s.position} ${s.rightOffset} ${s.fontSize} ${s.font} ${s.color} ${s.transform} ${s.pointerEvents}`;
}

/**
 * Get handle positioning values for fine-tuning.
 * Returns pixel values for handle offset adjustments.
 */
export function getHandlePositioning() {
  return WORKFLOW_HANDLE_STYLES.positioning;
}

// =============================================================================
// WORKFLOW STATES
// =============================================================================

export const WORKFLOW_STATES = {
  current: "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/20",
  visited: "ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getWorkflowNodeTheme(nodeType: string): WorkflowColorScheme {
  const color = WORKFLOW_NODE_COLORS[nodeType as WorkflowNodeType] || "slate";
  return WORKFLOW_THEMES[color] || WORKFLOW_THEMES.slate;
}

export function getWorkflowEdgeStyle(sourceHandle?: string | null): WorkflowEdgeStyle {
  if (!sourceHandle) return WORKFLOW_EDGE_STYLES.default;
  const style = WORKFLOW_EDGE_STYLES[sourceHandle as keyof typeof WORKFLOW_EDGE_STYLES];
  return style || WORKFLOW_EDGE_STYLES.default;
}
