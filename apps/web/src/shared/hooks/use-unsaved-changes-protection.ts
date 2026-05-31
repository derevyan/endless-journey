/**
 * Unsaved Changes Protection Hook
 *
 * Provides navigation protection when there are unsaved changes:
 * - Browser beforeunload: Shows native browser prompt on refresh/close
 * - TanStack Router blocking: Blocks internal navigation with custom dialog
 *
 * Uses TanStack Router's `useBlocker` with `enableBeforeUnload` option for
 * unified handling of both browser and router-level navigation.
 *
 * @module shared/hooks/use-unsaved-changes-protection
 */

import { useBlocker } from "@tanstack/react-router";

// =============================================================================
// TYPES
// =============================================================================

export interface UseUnsavedChangesProtectionOptions {
  /** Whether there are unsaved changes that should block navigation */
  isDirty: boolean;
  /** Enable browser beforeunload protection (default: true) */
  enableBeforeUnload?: boolean;
  /** Enable TanStack Router blocking (default: true) */
  enableRouterBlocker?: boolean;
}

export interface UseUnsavedChangesProtectionReturn {
  /** Current blocker status: 'idle' or 'blocked' */
  status: "idle" | "blocked";
  /** Proceed with the blocked navigation (when status is 'blocked') */
  proceed: () => void;
  /** Cancel the blocked navigation and stay on current page (when status is 'blocked') */
  reset: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for protecting pages with unsaved changes from accidental navigation.
 *
 * Features:
 * - Browser beforeunload event (refresh, close tab, navigate away)
 * - TanStack Router blocking (internal navigation)
 * - Returns status and controls for custom confirmation dialogs
 *
 * @example
 * ```tsx
 * function MyBuilder() {
 *   const isDirty = useStore(myStore, (s) => s.isDirty);
 *
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
export function useUnsavedChangesProtection({
  isDirty,
  enableBeforeUnload = true,
  enableRouterBlocker = true,
}: UseUnsavedChangesProtectionOptions): UseUnsavedChangesProtectionReturn {
  // TanStack Router's useBlocker handles both router navigation and beforeunload
  const blocker = useBlocker({
    shouldBlockFn: () => enableRouterBlocker && isDirty,
    withResolver: true,
    enableBeforeUnload: enableBeforeUnload && isDirty,
  });

  return {
    status: blocker.status,
    proceed: blocker.proceed ?? (() => {}),
    reset: blocker.reset ?? (() => {}),
  };
}
