/**
 * Validation Dialog
 *
 * Self-managing dialog that shows journey validation errors and warnings.
 * Reads state from uiStore and uses store actions for navigation.
 *
 * Usage:
 * 1. Call uiActions.showValidationDialog(result) to show the dialog
 * 2. The dialog reads nodes from journeyNodesStore
 * 3. Navigation uses uiActions to select nodes
 * 4. Caller provides onProceedAnyway callback for custom proceed behavior
 */

import { getErrorMessage, type NodeForDisplay } from "@/features/journey/builder/hooks/use-journey-validation";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { journeyNodesStore } from "@/stores/journey-nodes-store";
import { uiActions, uiStore } from "@/stores/ui-store";
import type { JourneyValidationIssue } from "@journey/schemas";
import { useStore } from "@tanstack/react-store";
import { AlertTriangle, ArrowRight, XCircle } from "lucide-react";
import { useCallback } from "react";

interface ValidationDialogProps {
  /** Callback when user clicks "Proceed Anyway" - caller handles what happens next */
  onProceedAnyway?: () => void;
}

export function ValidationDialog({ onProceedAnyway }: ValidationDialogProps) {
  // Self-manage: read dialog state from store
  const dialogState = useStore(uiStore, (s) => s.validationDialog);
  const nodes = useStore(journeyNodesStore, (s) => s.nodes);

  const { open, validation, title, proceedLabel } = dialogState;

  // All hooks MUST be called before any early returns (React Rules of Hooks)
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      uiActions.hideValidationDialog();
    }
  }, []);

  const handleNavigate = useCallback((error: JourneyValidationIssue) => {
    if (error.nodeId) {
      const node = journeyNodesStore.state.nodes.find((n) => n.id === error.nodeId);
      if (node) {
        uiActions.setSelectedNode(node);
        uiActions.setMode("edit");
      }
      uiActions.hideValidationDialog();
    }
  }, []);

  const handleProceed = useCallback(() => {
    uiActions.hideValidationDialog();
    onProceedAnyway?.();
  }, [onProceedAnyway]);

  // Early return AFTER all hooks
  if (!validation) {
    return null;
  }

  const { errors, warnings } = validation;
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? <XCircle className="h-5 w-5 text-destructive" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
            {title}
          </DialogTitle>
          <DialogDescription>
            {hasErrors
              ? "Your journey has errors that may cause issues. You can still save, but the journey may not work correctly."
              : "These warnings won't prevent saving, but should be reviewed."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] pr-4">
          <div className="space-y-4">
            {hasErrors && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-destructive flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" />
                  Errors ({errors.length})
                </h4>
                <ul className="space-y-1.5">
                  {errors.map((error, index) => (
                    <ValidationItem key={`error-${index}`} error={error} nodes={nodes} variant="error" onNavigate={handleNavigate} />
                  ))}
                </ul>
              </div>
            )}

            {hasWarnings && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings ({warnings.length})
                </h4>
                <ul className="space-y-1.5">
                  {warnings.map((warning, index) => (
                    <ValidationItem key={`warning-${index}`} error={warning} nodes={nodes} variant="warning" onNavigate={handleNavigate} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => uiActions.hideValidationDialog()}>
            Cancel
          </Button>
          {onProceedAnyway && (
            <Button variant={hasErrors ? "destructive" : "default"} onClick={handleProceed}>
              {proceedLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ValidationItemProps {
  error: JourneyValidationIssue;
  nodes: NodeForDisplay[];
  variant: "error" | "warning";
  onNavigate: (error: JourneyValidationIssue) => void;
}

function ValidationItem({ error, nodes, variant, onNavigate }: ValidationItemProps) {
  const message = getErrorMessage(error, nodes);
  const hasNode = !!error.nodeId;

  const bgClass = variant === "error" ? "bg-destructive/10 border-destructive/20" : "bg-amber-500/10 border-amber-500/20";

  return (
    <li
      className={`flex items-center justify-between gap-2 p-2 text-sm rounded-md border ${bgClass} ${hasNode ? "cursor-pointer hover:opacity-80" : ""}`}
      onClick={hasNode ? () => onNavigate(error) : undefined}
    >
      <span className="flex-1">{message}</span>
      {hasNode && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </li>
  );
}
