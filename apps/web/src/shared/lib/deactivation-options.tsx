/**
 * Deactivation Options
 *
 * Shared constants for journey/workflow deactivation mode selection.
 * Used in SaveVersionDialog and DeactivationDialog.
 *
 * @module shared/lib/deactivation-options
 */

import type { DeactivationMode } from "@journey/schemas";
import { Pause, Play, Trash2 } from "lucide-react";

export interface DeactivationOption {
  value: DeactivationMode;
  label: string;
  icon: React.ReactNode;
  description: string;
  warning?: string;
}

/**
 * Standard deactivation options for session handling.
 *
 * Used when changing status from "active" to another status.
 */
export const DEACTIVATION_OPTIONS: DeactivationOption[] = [
  {
    value: "pause",
    label: "Pause Sessions",
    icon: <Pause className="size-4" />,
    description: "Freeze all active sessions and their timers. Sessions can be resumed when reactivated.",
  },
  {
    value: "complete",
    label: "Let Sessions Finish",
    icon: <Play className="size-4" />,
    description: "Existing sessions continue normally until completion. Only new sessions are blocked.",
  },
  {
    value: "terminate",
    label: "Terminate All",
    icon: <Trash2 className="size-4" />,
    description: "Immediately stop all active sessions and cancel all timers.",
    warning: "This action cannot be undone.",
  },
];
