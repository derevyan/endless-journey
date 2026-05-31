/**
 * Node Theme Configuration
 *
 * Single source of truth for all visual constants in the Journey Builder canvas.
 * This centralizes dimensions, colors, typography, spacing, shadows, and all
 * visual properties for nodes, edges, badges, and canvas elements.
 *
 * DO NOT hardcode visual constants in components - import from here.
 */

import type { EdgeStyle, EdgeType } from "@journey/schemas";

/**
 * Edge Connection Styles
 * Visual appearance of connection lines between nodes.
 * Maps edge types to their stroke, width, and dash patterns.
 *
 * Canonical source for edge style defaults used by the web app.
 */
export const EDGE_STYLE_DEFAULTS: Record<EdgeType, EdgeStyle> = {
  success: { stroke: "#22c55e", strokeWidth: 2 },
  default: { stroke: "#22c55e", strokeWidth: 2 },
  retry: { stroke: "#f97316", strokeWidth: 2, strokeDasharray: "6,6" },
  dropoff: { stroke: "#f97316", strokeWidth: 2, strokeDasharray: "2,4" },
  exit: { stroke: "#94a3b8", strokeWidth: 2.5, strokeDasharray: "6,4" },
  timer: { stroke: "#f97316", strokeWidth: 2, strokeDasharray: "8,4" },
};

export const EDGE_CONNECTION_STYLES = EDGE_STYLE_DEFAULTS;
/**
 * Selected Edge Style
 * Visual override for edges when they are selected
 */
export const EDGE_SELECTED_STYLE = {
  stroke: "#3b82f6", // blue-500
  strokeWidth: 3,
} as const;

/**
 * Managed Edge Style
 *
 * Auto-created edges from button.targetNodeId (stored in journey.edges).
 * These edges are protected from manual editing in the UI.
 */
export const MANAGED_EDGE_STYLE: EdgeStyle = {
  stroke: "#22c55e", // Green, same as default edges
  strokeWidth: 1.5,
} as const;

/**
 * Plugin Edge Styles
 *
 * Auto-created edges for plugin nodes (follow-up plugins, etc.).
 * Uses distinct styling to differentiate from embedded follow-ups.
 */
export const PLUGIN_EDGE_STYLES = {
  /** Plugin connection edge - parent to plugin attachment */
  connection: {
    stroke: "#f59e0b", // Amber-500 (Matches Timer Node body)
    strokeWidth: 1.5,
    strokeDasharray: "3,3",
  } as EdgeStyle,
  /** Plugin button connections - amber dashed (matches main connection) */
  button: {
    stroke: "#fcd34d", // Amber-300
    strokeWidth: 1,
    strokeDasharray: "3,3",
  } as EdgeStyle,
  /** Plugin exit path connections - slate dashed */
  exit: {
    stroke: "#94a3b8", // Slate-400
    strokeWidth: 1,
    strokeDasharray: "3,3",
  } as EdgeStyle,
} as const;

/**
 * Node Dimensions
 * Standard size constants for all node types
 */
/**
 * Node Dimensions
 * Standard size constants for all node types
 */
export const NODE_DIMENSIONS = {
  width: "w-64", // 256px - slightly wider for better content distribution
  borderRadius: "rounded-2xl", // More modern, rounded look
  shadow: {
    default: "shadow-sm border-border/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
    selected: "shadow-xl border-primary/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
    premium: "shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]",
  },
  border: {
    width: "border",
    widthDashed: "border-2",
  },
  hover: "hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out",
} as const;

/**
 * Node Layout & Spacing
 * Padding, margins, gaps, and positioning constants
 */
export const NODE_LAYOUT = {
  header: {
    padding: "px-4 py-3",
    gap: "gap-3",
    fontSize: "text-[14px] font-semibold tracking-tight",
    borderRadius: "rounded-t-2xl",
    iconWrapper: "size-8 rounded-full flex items-center justify-center shrink-0 shadow-inner ring-1 ring-inset ring-black/5 dark:ring-white/5",
  },
  body: {
    padding: "p-4",
    spacing: "space-y-3",
    bottomPadding: "pb-12", // Extra space for bottom badges
  },
  badge: {
    position: "bottom-3 left-4 right-4",
    gap: "gap-1.5",
  },
} as const;

/**
 * Typography Scale
 * Font sizes used across node components
 */
export const NODE_TYPOGRAPHY = {
  label: "text-[14px] font-semibold leading-tight tracking-tight",
  content: "text-[13px] leading-relaxed",
  contentSmall: "text-xs",
  contentTiny: "text-[10px]",
  metadata: "text-[10px] uppercase tracking-wider font-medium opacity-70",
  badge: "text-[10px] font-bold tracking-wide uppercase",
  badgeSmall: "text-[9px] font-bold",
  small: "text-xs",
  mono: "font-mono text-[11px]",
} as const;

/**
 * Handle Styles & Configuration
 * Visual appearance and positioning for connection handles
 */
export const HANDLE_STYLES = {
  size: "w-3 h-3", // Slightly larger hit area
  border: "border-2 border-background shadow-sm hover:ring-2 hover:ring-primary/50 hover:scale-110 transition-all duration-200",
  positions: {
    timer: {
      style: { top: "auto", bottom: "16px" },
    },
    error: {
      style: { top: "auto", bottom: "16px" },
      styleWithTimer: { top: "auto", bottom: "40px" },
    },
    // Virtual handle for follow-up sequences (center right)
    virtual: {
      style: { top: "50%" },
    },
    // Button handles appear on left side, evenly distributed vertically
    button: {
      offset: { left: 0 },
    },
  },
  colors: {
    default: "bg-muted-foreground/60",
    timer: "#f97316", // Orange
    error: "#ef4444", // Red for error is better
    virtual: "#94a3b8", // Slate-400
    buttons: "bg-emerald-500",
    text: "bg-blue-500",
    any: "bg-violet-500",
    orange: "bg-orange-400", // Wait node handles
    // Follow-up handles (right side) - distinct colors for visual hierarchy
    followupButton: "#f59e0b", // Amber-500
    followupExit: "#64748b", // Slate-500
  },
  hidden: "opacity-0 pointer-events-none",
} as const;

/**
 * Journey State Visualization
 * Ring styles for journey simulation states
 */
export const JOURNEY_STATES = {
  current: "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/20",
  visited: "ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
  dropped: "ring-2 ring-destructive/50 ring-offset-1 ring-offset-background",
} as const;

/**
 * Badge Styles
 * Reusable badge component styling
 */
export const BADGE_STYLES = {
  base: "inline-flex items-center rounded-md border transition-all duration-200",
  sizes: {
    default: "px-2 py-0.5 text-[10px] font-medium",
    small: "px-1.5 py-0.5 text-[9px]",
    tiny: "px-1 py-0 text-[8px]",
  },
  variants: {
    type: "border-border/50 bg-background/80 backdrop-blur-sm text-foreground/80 shadow-xs",
    timer: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold",
    media: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    tag: "bg-muted/50 border-border/40 text-muted-foreground",
  },
} as const;

/**
 * Button Preview Styles
 */
export const BUTTON_PREVIEW = {
  base: "text-[10px] px-2 py-0.5 rounded-md font-medium",
  variant: "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20",
} as const;

/**
 * Button Tab Styles
 */
export const BUTTON_TAB_STYLES = {
  stack: "flex flex-col items-start gap-1.5 -ml-4 mt-2",
  tab: {
    base: "relative inline-flex items-center pl-4 pr-3 py-1.5 text-xs font-medium border rounded-r-lg rounded-l-0 border-l-2 transition-all duration-200",
    label: "whitespace-nowrap",
    connected: "text-foreground border-border border-l-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10",
    disconnected: "text-muted-foreground border-border border-l-muted-foreground/30 hover:border-l-primary/40",
  },
  handle: {
    base: "w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full shadow-sm",
  },
} as const;

/**
 * HTTP Method Styling
 */
export const HTTP_METHOD_STYLES = {
  GET: { color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10" },
  POST: { color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10" },
  PUT: { color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10" },
  PATCH: { color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-500/10" },
  DELETE: { color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-500/10" },
} as const;

/**
 * CRM Action Styling
 */
export const CRM_ACTION_STYLES = {
  create: {
    label: "Add to Pipeline",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  move: {
    label: "Move Stage",
    color: "text-blue-600 dark:text-blue-400",
  },
  remove: {
    label: "Remove from Pipeline",
    color: "text-rose-600 dark:text-rose-400",
  },
} as const;

/**
 * Wait Node Special Styles
 */
export const WAIT_NODE_STYLES = {
  shape: "rounded-full",
  border: "border-2 border-dashed",
  padding: "px-6 py-3",
  background: "bg-background/90 backdrop-blur-md",
  shadow: "shadow-sm",
  colors: {
    border: {
      default: "border-amber-400/50 dark:border-amber-600/50",
      hover: "hover:border-amber-500",
      selected: "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
    },
    shadow: {
      selected: "shadow-md shadow-amber-500/20",
    },
    icon: "text-amber-500 dark:text-amber-400",
    handle: "bg-amber-400",
  },
  icon: { size: "w-4 h-4" },
  label: { size: "text-sm font-bold tracking-tight" },
} as const;

/**
 * Edge Label Stack Offset
 * Vertical spacing between stacked edge labels from the same source node.
 * Labels are ~16px tall, so 22px provides comfortable spacing.
 */
export const EDGE_LABEL_STACK_OFFSET = 16;

/**
 * Edge Label Accent Colors
 * Maps edge types to their accent colors for dot indicators.
 * Uses the same colors as edge strokes for visual consistency.
 */
export const EDGE_LABEL_ACCENT_COLORS: Record<EdgeType, string> = {
  success: "#22c55e", // green-500
  default: "#22c55e", // green-500
  retry: "#f97316", // orange-500
  dropoff: "#f97316", // orange-500
  exit: "#94a3b8", // slate-400
  timer: "#f97316", // orange-500
};

/**
 * Get edge label accent color based on edge type.
 * Returns the color for the left-border indicator on edge labels.
 */
export function getEdgeLabelAccentColor(edgeType?: EdgeType): string {
  return edgeType ? EDGE_LABEL_ACCENT_COLORS[edgeType] : EDGE_LABEL_ACCENT_COLORS.default;
}

/**
 * Edge Label & Button Styles
 */
export const EDGE_STYLES = {
  label: {
    base: "edge-label-glass px-2 py-0.5 rounded-full",
    text: "text-[8px] font-mono tracking-wide uppercase",
    decoration: "shadow-sm select-none",
    /** Dot indicator for edge type - shown before label text */
    dot: "size-[3px] rounded-full mr-1 shrink-0",
  },
  deleteButton: {
    base: "bg-card/95 backdrop-blur-sm p-1.5 rounded-full shadow-lg border border-border/50",
    colors: "text-destructive hover:bg-destructive hover:text-destructive-foreground",
    transition: "hover:scale-110 transition-all duration-200 active:scale-95",
    iconSize: "w-3 h-3",
  },
  container: {
    positioning: "flex items-center gap-2",
  },
} as const;

/**
 * Media Preview Styles
 */
export const MEDIA_PREVIEW_STYLES = {
  base: "text-xs text-muted-foreground bg-muted/40 border border-border/30 rounded-lg px-3 py-1.5",
  icon: { size: "size-3.5 shrink-0" },
  layout: "flex items-center gap-2",
  badge: {
    colors: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
} as const;

/**
 * Tag Preview Configuration
 */
export const TAG_PREVIEW = {
  maxVisible: 2,
  badge: {
    base: "text-[10px] px-2 py-0.5 rounded-md font-medium",
    colors: "bg-primary/10 text-primary border border-primary/20",
  },
} as const;

/**
 * Animation & Transition
 */
export const TRANSITIONS = {
  default: "transition-all duration-200 ease-in-out",
  fast: "transition-all duration-100 ease-out",
  slow: "transition-all duration-400 ease-in-out",
} as const;

/**
 * Focus & Accessibility
 */
export const FOCUS_STYLES = {
  ring: "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background",
} as const;

/**
 * Helper Functions
 */

export function getHandleColor(responseType?: "auto" | "buttons" | "text" | "any"): string {
  switch (responseType) {
    case "buttons":
      return HANDLE_STYLES.colors.buttons;
    case "text":
      return HANDLE_STYLES.colors.text;
    case "any":
      return HANDLE_STYLES.colors.any;
    default:
      return HANDLE_STYLES.colors.default;
  }
}

export function getJourneyStateClasses(isJourneyVisited?: boolean, isJourneyCurrent?: boolean, isJourneyDropped?: boolean): string {
  if (isJourneyCurrent) return JOURNEY_STATES.current;
  if (isJourneyDropped) return JOURNEY_STATES.dropped;
  if (isJourneyVisited) return JOURNEY_STATES.visited;
  return "";
}

export function getHttpMethodStyle(method: string) {
  return HTTP_METHOD_STYLES[method as keyof typeof HTTP_METHOD_STYLES] || HTTP_METHOD_STYLES.GET;
}

export function getCrmActionStyle(action: keyof typeof CRM_ACTION_STYLES) {
  return CRM_ACTION_STYLES[action];
}

/**
 * Node Colors
 */
export const NODE_COLORS: Record<string, string> = {
  start: "emerald",
  end: "rose",
  message: "blue",
  questionnaire: "sky",
  condition: "violet",
  wait: "amber",
  webhook: "green",
  crm: "orange",
  teleport: "indigo",
  agent: "violet",
  plugin: "amber", // Plugin nodes use amber theme (matches Timer/Wait)
} as const;

/**
 * Node Color Scheme Type
 */
export interface NodeColorScheme {
  icon: string;
  iconBg: string;
  border: string;
  header: string;
  selected: string;
  badge: string;
  glow: string;
}

/**
 * Theme V2 Definitions - Refined for "Premium" Look
 * Uses subtle gradients, better glassmorphism, and colored shadows.
 */
const THEMES_V2: Record<string, NodeColorScheme> = {
  emerald: {
    icon: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-500/20 dark:bg-emerald-500/30",
    border: "border-border hover:border-emerald-500/50 dark:hover:border-emerald-400/50",
    header: "bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/10",
    selected: "border-emerald-500/80 ring-2 ring-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
  },
  rose: {
    icon: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-500/20 dark:bg-rose-500/30",
    border: "border-border hover:border-rose-500/50 dark:hover:border-rose-400/50",
    header: "bg-gradient-to-b from-rose-500/10 to-rose-500/5 dark:from-rose-500/20 dark:to-rose-500/10",
    selected: "border-rose-500/80 ring-2 ring-rose-500/20",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)]",
  },
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/20 dark:bg-blue-500/30",
    border: "border-border hover:border-blue-500/50 dark:hover:border-blue-400/50",
    header: "bg-gradient-to-b from-blue-500/10 to-blue-500/5 dark:from-blue-500/20 dark:to-blue-500/10",
    selected: "border-blue-500/80 ring-2 ring-blue-500/20",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]",
  },
  sky: {
    icon: "text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-500/20 dark:bg-sky-500/30",
    border: "border-border hover:border-sky-500/50 dark:hover:border-sky-400/50",
    header: "bg-gradient-to-b from-sky-500/10 to-sky-500/5 dark:from-sky-500/20 dark:to-sky-500/10",
    selected: "border-sky-500/80 ring-2 ring-sky-500/20",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
    glow: "shadow-[0_0_20px_rgba(14,165,233,0.15)]",
  },
  violet: {
    icon: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-500/20 dark:bg-violet-500/30",
    border: "border-border hover:border-violet-500/50 dark:hover:border-violet-400/50",
    header: "bg-gradient-to-b from-violet-500/10 to-violet-500/5 dark:from-violet-500/20 dark:to-violet-500/10",
    selected: "border-violet-500/80 ring-2 ring-violet-500/20",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)]",
  },
  amber: {
    icon: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/20 dark:bg-amber-500/30",
    border: "border-border hover:border-amber-500/50 dark:hover:border-amber-400/50",
    header: "bg-gradient-to-b from-amber-500/10 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/10",
    selected: "border-amber-500/80 ring-2 ring-amber-500/20",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
  },
  pink: {
    icon: "text-pink-600 dark:text-pink-400",
    iconBg: "bg-pink-500/20 dark:bg-pink-500/30",
    border: "border-border hover:border-pink-500/50 dark:hover:border-pink-400/50",
    header: "bg-gradient-to-b from-pink-500/10 to-pink-500/5 dark:from-pink-500/20 dark:to-pink-500/10",
    selected: "border-pink-500/80 ring-2 ring-pink-500/20",
    badge: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20",
    glow: "shadow-[0_0_20px_rgba(236,72,153,0.15)]",
  },
  green: {
    icon: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-500/20 dark:bg-green-500/30",
    border: "border-border hover:border-green-500/50 dark:hover:border-green-400/50",
    header: "bg-gradient-to-b from-green-500/10 to-green-500/5 dark:from-green-500/20 dark:to-green-500/10",
    selected: "border-green-500/80 ring-2 ring-green-500/20",
    badge: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
    glow: "shadow-[0_0_20px_rgba(34,197,94,0.15)]",
  },
  indigo: {
    icon: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-500/20 dark:bg-indigo-500/30",
    border: "border-border hover:border-indigo-500/50 dark:hover:border-indigo-400/50",
    header: "bg-gradient-to-b from-indigo-500/10 to-indigo-500/5 dark:from-indigo-500/20 dark:to-indigo-500/10",
    selected: "border-indigo-500/80 ring-2 ring-indigo-500/20",
    badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
    glow: "shadow-[0_0_20px_rgba(79,70,229,0.15)]",
  },
  orange: {
    icon: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-500/20 dark:bg-orange-500/30",
    border: "border-border hover:border-orange-500/50 dark:hover:border-orange-400/50",
    header: "bg-gradient-to-b from-orange-500/10 to-orange-500/5 dark:from-orange-500/20 dark:to-orange-500/10",
    selected: "border-orange-500/80 ring-2 ring-orange-500/20",
    badge: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.15)]",
  },
  gray: {
    icon: "text-slate-600 dark:text-slate-400",
    iconBg: "bg-slate-500/20 dark:bg-slate-500/30",
    border: "border-border hover:border-slate-500/50 dark:hover:border-slate-400/50",
    header: "bg-gradient-to-b from-slate-500/10 to-slate-500/5 dark:from-slate-500/20 dark:to-slate-500/10",
    selected: "border-slate-500/80 ring-2 ring-slate-500/20",
    badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
    glow: "shadow-[0_0_20px_rgba(100,116,139,0.15)]",
  },
};

export function getNodeTheme(nodeType: string): NodeColorScheme {
  const color = NODE_COLORS[nodeType] || "gray";
  return THEMES_V2[color] || THEMES_V2.gray;
}
