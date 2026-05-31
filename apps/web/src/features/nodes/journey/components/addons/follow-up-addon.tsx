/**
 * FollowUpAddon Component
 *
 * Follow-up plugin specific addon content.
 * Displays the follow-up sequence configuration in a compact format.
 *
 * Features:
 * - Icon and title
 * - Step count badge
 * - Timer indicator
 * - Enabled/disabled state
 * - Generates handles for button and exit connections
 */

import { Clock, MessageCircle } from "lucide-react";
import { memo, useMemo } from "react";

import type { FollowUpPluginData } from "@journey/schemas";
import { PluginButtonEdgeId, PluginExitEdgeId } from "../../utils/plugin-edge-identity";
import { PluginAddon, type AddonHandle } from "./plugin-addon";

/**
 * Styling for follow-up addon content
 */
const FOLLOWUP_STYLES = {
  icon: {
    wrapper: "p-1.5 rounded-md bg-amber-500/10",
    size: "w-3.5 h-3.5",
    color: "text-amber-600 dark:text-amber-400",
  },
  title: "text-xs font-semibold text-foreground tracking-tight",
  badge: "text-[10px] font-medium text-amber-600 dark:text-amber-400",
  disabled: "px-1.5 py-0.5 text-[9px] font-medium rounded bg-muted text-muted-foreground",
  timer: {
    wrapper: "p-1 rounded-full bg-amber-500/15 border border-amber-200/20",
    icon: "w-2.5 h-2.5 text-amber-600 dark:text-amber-400",
  },
} as const;

interface FollowUpAddonProps {
  data: FollowUpPluginData;
  pluginId: string;
  isEditMode: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const FollowUpAddon = memo(function FollowUpAddon({ data, pluginId, isEditMode, isSelected = false, onSelect }: FollowUpAddonProps) {
  const stepCount = data.steps?.length ?? 0;
  const hasSteps = stepCount > 0;

  // Generate handles for follow-up buttons and exit path
  const handles = useMemo((): AddonHandle[] => {
    const result: AddonHandle[] = [];

    // Add handles for each step's buttons
    data.steps?.forEach((step, stepIdx) => {
      step.buttons?.forEach((button) => {
        result.push({
          id: PluginButtonEdgeId.getSourceHandle(stepIdx, button.id),
          label: button.text,
          type: "button",
        });
      });
    });

    // Add exit path handle if configured
    if (data.exitPath?.nodeId) {
      result.push({
        id: PluginExitEdgeId.getSourceHandle(),
        label: "Exit",
        type: "exit",
      });
    }

    return result;
  }, [data.steps, data.exitPath?.nodeId]);

  return (
    <PluginAddon pluginId={pluginId} isEditMode={isEditMode} isSelected={isSelected} handles={handles} onClick={onSelect}>
      <div className="flex items-center gap-2">
        {/* Icon */}
        <div className={FOLLOWUP_STYLES.icon.wrapper}>
          <MessageCircle className={`${FOLLOWUP_STYLES.icon.size} ${FOLLOWUP_STYLES.icon.color}`} />
        </div>

        {/* Title and step count */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className={FOLLOWUP_STYLES.title}>{data.label || "Follow-Up"}</span>
          <span className={FOLLOWUP_STYLES.badge}>
            {stepCount} step{stepCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Disabled badge */}
        {!data.enabled && <span className={FOLLOWUP_STYLES.disabled}>OFF</span>}

        {/* Timer indicator */}
        {hasSteps && data.enabled && (
          <div className={FOLLOWUP_STYLES.timer.wrapper}>
            <Clock className={FOLLOWUP_STYLES.timer.icon} />
          </div>
        )}
      </div>
    </PluginAddon>
  );
});
