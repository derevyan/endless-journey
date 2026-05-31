/**
 * Agent Workflow Version Panel
 *
 * Displays version history for an agent workflow with restore and export actions.
 * Follows the same pattern as journey version-history-panel.
 *
 * @module features/agent-workflows/components/version-panel
 */

import { Download, History, Loader2, RotateCcw, X } from "lucide-react";
import { useState } from "react";

import {
  useAgentWorkflowVersions,
  useDeleteAgentWorkflowVersion,
} from "@/features/agent-workflows/hooks";
import { workflowVersionsApi } from "@/shared/lib/api/workflow-versions";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { notify } from "@/shared/lib/ui/notify";
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("workflow-version-panel");

interface AgentWorkflowVersionPanelProps {
  workflowKey: string;
  workflowName: string;
  onClose: () => void;
  onRestore: (versionId: string) => Promise<boolean>;
}

export function AgentWorkflowVersionPanel({
  workflowKey,
  workflowName,
  onClose,
  onRestore,
}: AgentWorkflowVersionPanelProps) {
  const { data: versions = [], isLoading } = useAgentWorkflowVersions(workflowKey);
  const deleteVersion = useDeleteAgentWorkflowVersion();

  // Loading states for async operations
  const [exportingVersionId, setExportingVersionId] = useState<string | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

  const handleRestore = async (versionId: string) => {
    if (!window.confirm(`Restore version ${versionId}? This will replace the current workflow data.`)) {
      return;
    }

    setRestoringVersionId(versionId);
    try {
      const success = await onRestore(versionId);
      if (success) {
        notify.success(`Restored ${versionId}`);
        onClose();
      } else {
        notify.error("Failed to restore version");
      }
    } catch (error) {
      log.error({ versionId, err: serializeError(error) }, "workflowVersionPanel:restore:error");
      notify.error("Failed to restore version");
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handleExport = async (versionId: string) => {
    setExportingVersionId(versionId);
    try {
      const versionData = await workflowVersionsApi.get(workflowKey, versionId);
      if (versionData) {
        // Create and download JSON file
        const exportData = {
          workflow: workflowName,
          version: versionId,
          exportedAt: new Date().toISOString(),
          ...versionData.data,
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${workflowKey}-${versionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        notify.success(`Exported ${versionId}`);
      }
    } catch (error) {
      log.error({ versionId, workflowKey, err: serializeError(error) }, "workflowVersionPanel:export:error");
      notify.error("Failed to export version");
    } finally {
      setExportingVersionId(null);
    }
  };

  // Check if any operation is in progress
  const isOperationInProgress = restoringVersionId !== null || exportingVersionId !== null || deleteVersion.isPending;

  const formatDate = (timestamp: string | Date) => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTime = (timestamp: string | Date) => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <TooltipProvider>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={isOperationInProgress ? undefined : onClose}
      >
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              disabled={isOperationInProgress}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 scrollbar-ghost">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No versions saved yet</p>
                <p className="text-xs mt-1">Use "Publish Version" to create snapshots</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors group"
                  >
                    {/* Version info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-primary">
                          {version.versionId}
                        </span>
                        {index === 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(version.createdAt)}
                        </span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(version.createdAt)}
                        </span>
                        {version.notes && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {version.notes}
                            </span>
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
                        <TooltipContent side="bottom">Export</TooltipContent>
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
