/**
 * Cleanup Controls
 *
 * Button to trigger bulk cleanup of all test data for the organization.
 * Shows a confirmation dialog before deleting.
 *
 * @module features/simulator/components/controls/cleanup-controls
 */

import { useState } from "react";
import { Trash2, X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

import { useCleanupAllTestData } from "../../hooks/use-personas";

interface CleanupControlsProps {
  disabled?: boolean;
}

export function CleanupControls({ disabled }: CleanupControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cleanup = useCleanupAllTestData();

  const handleCleanup = async () => {
    await cleanup.mutateAsync();
    setConfirmOpen(false);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={disabled || cleanup.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Clean up test data</p>
        </TooltipContent>
      </Tooltip>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clean Up All Test Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Reset all personas (clear tags, CRM data, sessions)</li>
                <li>Delete all anonymous test clients</li>
              </ul>
              <p className="mt-2 text-muted-foreground">
                Persona configurations will be preserved.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cleanup.isPending}
            >
              {cleanup.isPending ? "Cleaning..." : "Clean Up"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
