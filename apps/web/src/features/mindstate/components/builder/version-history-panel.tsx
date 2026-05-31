/**
 * Mindstate Version History Panel
 *
 * Modal showing version history with restore and export options.
 * Mirrors journey version history panel adapted for mindstate definitions.
 */

import { Download, History, Loader2, RotateCcw, X } from "lucide-react";
import { memo, useState } from "react";
import { useStore } from "@tanstack/react-store";

import { mindstateVersionActions, mindstateVersionStore, builderActions, builderStore } from "@/features/mindstate/stores";
import { mindstateVersionsApi } from "@/shared/lib/api";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { notify } from "@/shared/lib/ui/notify";
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("version-history-panel");

interface VersionHistoryPanelProps {
  onClose: () => void;
}

export const MindstateVersionHistoryPanel = memo(function MindstateVersionHistoryPanel({ onClose }: VersionHistoryPanelProps) {
  const { versions, definitionId } = useStore(mindstateVersionStore, (state) => ({
    versions: state.versions,
    definitionId: state.definitionId,
  }));
  const { definition } = useStore(builderStore, (state) => ({
    definition: state.definition,
  }));

  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [exportingVersionId, setExportingVersionId] = useState<string | null>(null);

  const isOperationInProgress = restoringVersionId !== null || exportingVersionId !== null;

  const handleRestore = async (versionId: string) => {
    if (!window.confirm(`Restore version ${versionId}? This will replace the current definition.`)) {
      return;
    }

    setRestoringVersionId(versionId);
    try {
      if (!definitionId) {
        notify.error("Definition not loaded");
        return;
      }

      const versionData = await mindstateVersionsApi.getVersion(definitionId, versionId);

      // Apply to builder store
      builderActions.setDefinition({
        ...definition!,
        mainAgentConfig: versionData.data.mainAgentConfig,
        defaultAgents: versionData.data.defaultAgents,
        defaultParameters: versionData.data.defaultParameters,
        analysisMode: versionData.data.analysisMode,
        categories: versionData.data.categories,
      });

      // Refresh version list
      await mindstateVersionActions.refreshVersions();

      notify.success(`Restored ${versionId}`);
      onClose();

      log.info({ versionId }, "versionHistoryPanel:restore:success");
    } catch (error) {
      log.error({ versionId, err: serializeError(error) }, "versionHistoryPanel:restore:error");
      notify.error("Failed to restore version");
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handleExport = async (versionId: string) => {
    if (!definitionId) {
      notify.error("Definition not loaded");
      return;
    }

    setExportingVersionId(versionId);
    try {
      const versionData = await mindstateVersionsApi.getVersion(definitionId, versionId);

      // Create JSON blob
      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        definition: versionData.data,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mindstate-${versionId}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify.success(`Exported ${versionId}`);
      log.info({ versionId }, "versionHistoryPanel:export:success");
    } catch (error) {
      log.error({ versionId, err: serializeError(error) }, "versionHistoryPanel:export:error");
      notify.error("Failed to export version");
    } finally {
      setExportingVersionId(null);
    }
  };

  const formatDate = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTime = (timestamp: string | Date) => {
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
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No versions saved yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {versions.map((version, index) => (
                  <div key={version.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors">
                    {/* Version info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-primary">{version.versionId}</span>
                        {index === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Latest</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground">{formatDate(version.createdAt)}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-xs text-muted-foreground">{formatTime(version.createdAt)}</span>
                        {version.notes && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="text-xs text-muted-foreground truncate">{version.notes}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions (hover to reveal) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleExport(version.versionId)}
                            disabled={isOperationInProgress}
                          >
                            {exportingVersionId === version.versionId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Export version</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRestore(version.versionId)}
                            disabled={isOperationInProgress}
                          >
                            {restoringVersionId === version.versionId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Restore version</TooltipContent>
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
});
