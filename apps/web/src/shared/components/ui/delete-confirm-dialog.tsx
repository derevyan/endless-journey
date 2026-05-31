/**
 * Delete Confirmation Dialog
 *
 * Reusable dialog for confirming destructive actions.
 * Shows warning when item is in use.
 *
 * @module components/ui/delete-confirm-dialog
 */

import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { buttonVariants } from "./button";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  /** List of items where this is being used (shows warning) */
  usedIn?: string[];
  /** Whether delete is in progress */
  isDeleting?: boolean;
  /** Custom confirm button text */
  confirmText?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Delete Item",
  description = "Are you sure you want to delete this item? This action cannot be undone.",
  usedIn = [],
  isDeleting = false,
  confirmText = "Delete",
}: DeleteConfirmDialogProps) {
  const isInUse = usedIn.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isInUse ? (
              <>
                <AlertTriangle className="size-5 text-amber-500" />
                <span>Cannot Delete - In Use</span>
              </>
            ) : (
              <>
                <Trash2 className="size-5 text-destructive" />
                <span>{title}</span>
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isInUse ? (
                <>
                  <p>This media is currently being used in the following journeys:</p>
                  <ul className="list-disc pl-5 space-y-1 text-foreground font-medium">
                    {usedIn.map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                  </ul>
                  <p className="text-amber-600 dark:text-amber-400">
                    Please remove the media from these journeys before deleting.
                  </p>
                </>
              ) : (
                <p>{description}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </AlertDialogCancel>
          {!isInUse && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              disabled={isDeleting}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                confirmText
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

