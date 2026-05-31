/**
 * Prompt Version Sidebar
 *
 * Simple list of versions.
 *
 * @module features/prompts/components/prompt-version-sidebar
 */

import { memo } from "react";

import { History, Loader2 } from "lucide-react";

import type { PromptVersionResponse } from "@journey/schemas";

import { LabelBadge } from "@/shared/components/ui/badges";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface PromptVersionSidebarProps {
  versions: PromptVersionResponse[];
  selectedVersionId?: string;
  onSelectVersion: (versionId: string) => void;
  isLoading?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// =============================================================================
// COMPONENT
// =============================================================================

export const PromptVersionSidebar = memo(function PromptVersionSidebar({
  versions,
  selectedVersionId,
  onSelectVersion,
  isLoading,
}: PromptVersionSidebarProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center border-r bg-background/50 backdrop-blur-sm">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden border-r bg-muted/5">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b bg-background/50 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-tight">Version History</span>
        </div>
        <span className="rounded-sm bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {versions.length}
        </span>
      </div>

      {/* Version List */}
      <div className="flex-1 scrollbar-ghost p-2">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <div className="rounded-full bg-muted/30 p-3">
              <History className="size-6 text-muted-foreground/40" />
            </div>
            <p className="text-xs font-medium text-muted-foreground/60">No versions yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {versions.map((version) => {
              const isSelected = version.versionId === selectedVersionId;
              const versionNumber = version.versionId.replace("v", "").replace(/^0+/, "") || "0";

              return (
                <button
                  key={version.id}
                  onClick={() => onSelectVersion(version.versionId)}
                  className={cn(
                    "group relative w-full overflow-hidden rounded-sm p-3 text-left transition-all duration-200",
                    isSelected
                      ? "bg-blue-500/5 shadow-none"
                      : "bg-transparent hover:bg-muted/30"
                  )}
                >
                  {/* Selection Indicator Bar */}
                  <div
                    className={cn(
                      "absolute top-0 left-0 bottom-0 w-1 transition-all duration-300",
                      isSelected ? "bg-blue-500/60" : "bg-transparent"
                    )}
                  />

                  <div className="flex flex-col gap-1.5">
                    {/* Top Row: Version & Date */}
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "text-sm font-bold tracking-tight",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        v{versionNumber}
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground/60">
                        {formatDate(version.createdAt)}
                      </div>
                    </div>

                    {/* Notes Snippet */}
                    {version.notes && (
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">
                        {version.notes}
                      </p>
                    )}

                    {/* Labels Badge Row */}
                    {version.labels.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
                        {version.labels.map((label) => (
                          <LabelBadge key={label} label={label} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
