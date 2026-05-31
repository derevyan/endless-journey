/**
 * Status Selector Component
 *
 * A premium segmented control for selecting status (draft/active/archived).
 * Features smooth transitions, a sliding indicator, and a stable layout.
 *
 * @module shared/components/status-selector
 */

import type { LucideIcon } from "lucide-react";
import { Archive, Pause, Play } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/shared/lib/utils";
import { createLogger } from "@journey/logger";

const log = createLogger("status-selector");

// =============================================================================
// TYPES
// =============================================================================

export type BuilderStatus = "draft" | "active" | "archived";

interface StatusOption {
  value: BuilderStatus;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface StatusSelectorProps {
  /** Currently selected status */
  value: BuilderStatus;
  /** Callback when status changes */
  onChange: (status: BuilderStatus) => void;
  /** Optional: Hide archived option */
  hideArchived?: boolean;
  /** Optional: Disable certain statuses */
  disabledStatuses?: BuilderStatus[];
  /** Optional: Additional class name */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "draft",
    label: "Draft",
    icon: Pause,
    description: "Work in progress",
  },
  {
    value: "active",
    label: "Active",
    icon: Play,
    description: "Live and running",
  },
  {
    value: "archived",
    label: "Archived",
    icon: Archive,
    description: "No longer active",
  },
];

const STATUS_THEMES: Record<
  BuilderStatus,
  {
    color: string;
    border: string;
    bg: string;
    indicator: string;
    glow: string;
  }
> = {
  draft: {
    color: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/20",
    bg: "bg-orange-500/5",
    indicator: "bg-orange-500",
    glow: "shadow-orange-500/20",
  },
  active: {
    color: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    indicator: "bg-emerald-500",
    glow: "shadow-emerald-500/30",
  },
  archived: {
    color: "text-slate-600 dark:text-slate-400",
    border: "border-slate-500/20",
    bg: "bg-slate-500/5",
    indicator: "bg-slate-500",
    glow: "shadow-slate-500/20",
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function StatusSelector({
  value,
  onChange,
  hideArchived = false,
  disabledStatuses = [],
  className,
}: StatusSelectorProps) {
  const options = useMemo(
    () => (hideArchived ? STATUS_OPTIONS.filter((opt) => opt.value !== "archived") : STATUS_OPTIONS),
    [hideArchived]
  );

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const theme = STATUS_THEMES[value];

  const handleStatusChange = (status: BuilderStatus) => {
    log.info({ from: value, to: status }, "status:changed");
    onChange(status);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="px-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Status</label>
      </div>

      <div className="relative flex p-1 bg-muted/40 dark:bg-muted/20 rounded-lg border border-border/50 backdrop-blur-sm overflow-hidden">
        {/* Sliding Indicator */}
        <div
          className={cn(
            "absolute inset-y-1 rounded-md transition-all duration-300 ease-out shadow-sm border",
            theme.bg,
            theme.border,
            theme.glow
          )}
          style={{
            left: `calc(${(selectedIndex / options.length) * 100}% + 4px)`,
            width: `calc(${100 / options.length}% - 8px)`,
          }}
        />

        {/* Options */}
        {options.map((option) => {
          const isSelected = value === option.value;
          const isDisabled = disabledStatuses.includes(option.value);
          const Icon = option.icon;
          const optionTheme = STATUS_THEMES[option.value];

          return (
            <button
              key={option.value}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && handleStatusChange(option.value)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 px-3 transition-all duration-300 outline-none",
                isSelected ? "opacity-100" : "opacity-60 hover:opacity-100",
                isDisabled && "cursor-not-allowed opacity-20"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-transform duration-300",
                  isSelected ? [optionTheme.color, "scale-110"] : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-sm font-semibold transition-colors duration-300",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Get the button text based on selected status
 */
export function getStatusButtonText(status: BuilderStatus): string {
  switch (status) {
    case "draft":
      return "Save as Draft";
    case "active":
      return "Publish Version";
    case "archived":
      return "Save and Archive";
  }
}

/**
 * Get the button icon based on selected status
 */
export function getStatusButtonIcon(status: BuilderStatus): LucideIcon {
  switch (status) {
    case "draft":
      return Pause;
    case "active":
      return Play;
    case "archived":
      return Archive;
  }
}
