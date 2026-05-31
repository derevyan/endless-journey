/**
 * Unsaved Changes Dialog
 *
 * Confirmation dialog shown when user attempts to navigate away from a page
 * with unsaved changes. Used in conjunction with useUnsavedChangesProtection hook.
 *
 * @module shared/components/common/unsaved-changes-dialog
 */

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

// =============================================================================
// TYPES
// =============================================================================

export interface UnsavedChangesDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when user confirms leaving (proceed with navigation) */
  onProceed: () => void;
  /** Called when user cancels (stay on current page) */
  onCancel: () => void;
  /** Optional custom title (default: "Unsaved Changes") */
  title?: string;
  /** Optional custom description */
  description?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Dialog for confirming navigation away from unsaved changes.
 *
 * @example
 * ```tsx
 * function MyBuilder() {
 *   const { status, proceed, reset } = useUnsavedChangesProtection({ isDirty });
 *
 *   return (
 *     <>
 *       <BuilderContent />
 *       <UnsavedChangesDialog
 *         open={status === 'blocked'}
 *         onProceed={proceed}
 *         onCancel={reset}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function UnsavedChangesDialog({
  open,
  onProceed,
  onCancel,
  title = "Unsaved Changes",
  description = "You have unsaved changes that will be lost if you leave this page. Are you sure you want to continue?",
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={onProceed}>Leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
