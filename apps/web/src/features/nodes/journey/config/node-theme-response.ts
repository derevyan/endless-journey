/**
 * Response Type Theme
 *
 * Visual config for message node response types.
 * Separated to keep node-theme free of icon dependencies.
 */

import { MessageSquare, MousePointerClick } from "lucide-react";

/**
 * Response Type Configuration
 * For message node response handling
 */
export const RESPONSE_TYPES = {
  buttons: {
    label: "BTN",
    icon: MousePointerClick,
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    handleColor: "bg-emerald-500",
    iconSize: "size-3",
  },
  text: {
    label: "Text",
    icon: MessageSquare,
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    handleColor: "bg-blue-500",
    iconSize: "size-3",
  },
  any: {
    label: "Any",
    icon: null, // Composite of buttons + text
    badgeColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    handleColor: "bg-violet-500",
    iconSize: "size-3",
  },
} as const;

/**
 * Get response type badge configuration
 */
export function getResponseTypeBadge(responseType: "buttons" | "text" | "any" | "auto") {
  if (responseType === "auto") return null;
  return RESPONSE_TYPES[responseType];
}
