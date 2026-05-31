/**
 * useDialogState - Standardized hook for dialog state management
 *
 * Eliminates inconsistent dialog patterns found across the codebase:
 * - Self-managing dialogs with form state in ui-store
 * - Mixed local + store state patterns
 * - 10+ useState calls in single dialogs
 *
 * Provides a clean, controlled dialog pattern with:
 * - Open/close state management
 * - Optional data payload for edit/view dialogs
 * - Loading state for async submissions
 * - Stable callbacks for onOpen/onClose/onSubmit
 *
 * @module shared/hooks/use-dialog-state
 */

import { useCallback, useState } from "react";

/**
 * Options for useDialogState hook
 */
interface UseDialogStateOptions<TData = void, TResult = void> {
  /** Called when dialog opens (optional) */
  onOpen?: (data?: TData) => void;
  /** Called when dialog closes (optional) */
  onClose?: () => void;
  /** Called when form is submitted successfully */
  onSubmit?: (data: TData) => Promise<TResult> | TResult;
  /** Initial data for the dialog (optional) */
  initialData?: TData;
}

/**
 * Return type for useDialogState hook
 */
interface UseDialogStateReturn<TData = void, TResult = void> {
  /** Whether dialog is open */
  open: boolean;
  /** Data passed to the dialog (for edit/view modes) */
  data: TData | undefined;
  /** Whether an async operation is in progress */
  isLoading: boolean;
  /** Open the dialog with optional data */
  openDialog: (data?: TData) => void;
  /** Close the dialog */
  closeDialog: () => void;
  /** Toggle dialog open state */
  toggleDialog: () => void;
  /** Set open state directly */
  setOpen: (open: boolean) => void;
  /** Update dialog data */
  setData: (data: TData | undefined) => void;
  /** Submit handler with loading state management */
  handleSubmit: (submitData: TData) => Promise<TResult | undefined>;
}

/**
 * Hook for managing dialog state with a standardized pattern.
 *
 * Provides controlled dialog state management that:
 * - Keeps form/dialog state local (not in global stores)
 * - Handles async submissions with loading state
 * - Provides stable callback references
 * - Supports both modal and non-modal patterns
 *
 * @example
 * ```tsx
 * // Simple dialog without data
 * function DeleteConfirmDialog() {
 *   const { open, openDialog, closeDialog, isLoading, handleSubmit } = useDialogState({
 *     onSubmit: async () => {
 *       await deleteItem();
 *     },
 *   });
 *
 *   return (
 *     <Dialog open={open} onOpenChange={closeDialog}>
 *       <Button onClick={openDialog}>Delete</Button>
 *       <DialogContent>
 *         <Button onClick={() => handleSubmit(undefined)} disabled={isLoading}>
 *           {isLoading ? "Deleting..." : "Confirm"}
 *         </Button>
 *       </DialogContent>
 *     </Dialog>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Edit dialog with data
 * interface User { name: string; email: string; }
 *
 * function EditUserDialog() {
 *   const { open, data, openDialog, closeDialog, handleSubmit, isLoading } = useDialogState<User>({
 *     onSubmit: async (user) => {
 *       await updateUser(user);
 *     },
 *   });
 *
 *   // Open with existing user data
 *   const handleEdit = (user: User) => openDialog(user);
 *
 *   return (
 *     <Dialog open={open} onOpenChange={closeDialog}>
 *       {data && (
 *         <EditForm
 *           initialValues={data}
 *           onSubmit={handleSubmit}
 *           isLoading={isLoading}
 *         />
 *       )}
 *     </Dialog>
 *   );
 * }
 * ```
 */
export function useDialogState<TData = void, TResult = void>(
  options: UseDialogStateOptions<TData, TResult> = {}
): UseDialogStateReturn<TData, TResult> {
  const { onOpen, onClose, onSubmit, initialData } = options;

  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TData | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(false);

  const openDialog = useCallback(
    (newData?: TData) => {
      setData(newData ?? initialData);
      setOpen(true);
      onOpen?.(newData ?? initialData);
    },
    [onOpen, initialData]
  );

  const closeDialog = useCallback(() => {
    setOpen(false);
    onClose?.();
    // Reset data after animation completes
    setTimeout(() => {
      setData(initialData);
    }, 200);
  }, [onClose, initialData]);

  const toggleDialog = useCallback(() => {
    if (open) {
      closeDialog();
    } else {
      openDialog();
    }
  }, [open, openDialog, closeDialog]);

  const handleSubmit = useCallback(
    async (submitData: TData): Promise<TResult | undefined> => {
      if (!onSubmit) return undefined;

      setIsLoading(true);
      try {
        const result = await onSubmit(submitData);
        closeDialog();
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [onSubmit, closeDialog]
  );

  return {
    open,
    data,
    isLoading,
    openDialog,
    closeDialog,
    toggleDialog,
    setOpen,
    setData,
    handleSubmit,
  };
}

/**
 * Simpler version for dialogs that don't need async submit handling.
 * Just manages open/close state with optional data.
 */
export function useSimpleDialogState<TData = void>() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TData | undefined>();

  const openDialog = useCallback((newData?: TData) => {
    setData(newData);
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setTimeout(() => setData(undefined), 200);
  }, []);

  return {
    open,
    data,
    openDialog,
    closeDialog,
    setOpen,
    setData,
  };
}
