/**
 * Journey Deactivation Dialog
 *
 * Shows when changing journey status from "active" to another status.
 * Allows user to choose how to handle active sessions.
 *
 * @module components/journey/deactivation-dialog
 */

import type { DeactivationMode } from "@journey/schemas";
import { AlertTriangle, Loader2, Users, X } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { buttonVariants } from "@/shared/components/ui/button";
import { DeactivationOptionsSelector } from "@/shared/components/deactivation-options-selector";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface DeactivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mode: DeactivationMode) => void;
  activeSessionCount: number;
  isLoading?: boolean;
  targetStatus?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DeactivationDialog({ open, onOpenChange, onConfirm, activeSessionCount, isLoading = false, targetStatus = "draft" }: DeactivationDialogProps) {
  const [selectedMode, setSelectedMode] = useState<DeactivationMode>("pause");

  const handleConfirm = () => {
    onConfirm(selectedMode);
  };

  const hasActiveSessions = activeSessionCount > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            <span>Change Journey Status</span>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                You are about to change this journey to <strong>{targetStatus}</strong>.
              </p>

              {hasActiveSessions && (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
                    <Users className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-300">
                      <strong>{activeSessionCount}</strong> active {activeSessionCount === 1 ? "session" : "sessions"} will be affected
                    </span>
                  </div>

                  <DeactivationOptionsSelector
                    value={selectedMode}
                    onChange={setSelectedMode}
                    label="How should active sessions be handled?"
                  />
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isLoading}
            className={cn(buttonVariants({ variant: selectedMode === "terminate" ? "destructive" : "default" }))}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Confirm"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
