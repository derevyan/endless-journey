import { Download, History, Loader2, RotateCcw, X } from "lucide-react";
import React, { useState } from "react";

import { useEditorActions } from "@/features/journey/builder/hooks/use-editor-actions";
import { useEditorJourneyData, useEditorVersions } from "@/features/journey/builder/hooks/selectors/editor-selectors";
import { exportVersion } from "@/features/journey/builder/lib/journey/journey-export";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { apiClient } from "@/shared/lib/api";
import { notify } from "@/shared/lib/ui/notify";
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("version-history-panel");

interface VersionHistoryPanelProps {
  onClose: () => void;
}

export function VersionHistoryPanel({ onClose }: VersionHistoryPanelProps) {
  const { journeyId } = useEditorJourneyData();
  const { versions, journeyUuid } = useEditorVersions();
  const { loadVersionById, refreshVersions } = useEditorActions();

  // Loading states for async operations
  const [exportingVersionId, setExportingVersionId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async (versionId: string) => {
    if (!window.confirm(`Restore version ${versionId}? This will replace the current journey data.`)) {
      return;
    }

    setIsRestoring(true);
    try {
      const success = await loadVersionById(versionId);
      if (success) {
        notify.success(`Restored ${versionId}`);
        await refreshVersions();
        onClose();
      } else {
        notify.error("Failed to restore version");
      }
    } catch (error) {
      log.error({ versionId, err: serializeError(error) }, "versionHistoryPanel:restore:error");
      notify.error("Failed to restore version");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExport = async (versionId: string) => {
    if (!journeyUuid || !journeyId) {
      notify.error("Cannot export", { description: "Journey not loaded" });
      return;
    }

    setExportingVersionId(versionId);
    try {
      const versionData = await apiClient.getVersion(journeyUuid, versionId);
      if (versionData) {
        exportVersion(journeyId, versionId, versionData);
        notify.success(`Exported ${versionId}`);
      }
    } catch (error) {
      log.error({ versionId, journeyUuid, err: serializeError(error) }, "versionHistoryPanel:export:error");
      notify.error("Failed to export version");
    } finally {
      setExportingVersionId(null);
    }
  };

  // Check if any operation is in progress
  const isOperationInProgress = isRestoring || exportingVersionId !== null;

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <TooltipProvider>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={isOperationInProgress ? undefined : onClose}>
        <div
          className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Version History</h2>
              <span className="text-xs text-muted-foreground">({versions.length})</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} disabled={isOperationInProgress}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 scrollbar-ghost">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No versions saved yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {versions.map((version, index) => (
                  <div key={version.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors group">
                    {/* Version info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-primary">{version.id}</span>
                        {index === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Latest</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground">{formatDate(version.timestamp)}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-xs text-muted-foreground">{formatTime(version.timestamp)}</span>
                        {version.notes && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="text-xs text-muted-foreground truncate">{version.notes}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleExport(version.id)}
                            disabled={isOperationInProgress}
                          >
                            {exportingVersionId === version.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Export</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRestore(version.id)}
                            disabled={isOperationInProgress}
                          >
                            {isRestoring ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Restore</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
