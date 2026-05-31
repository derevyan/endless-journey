/**
 * Users Feature
 *
 * User management with table view, filtering, session selection, and impersonation.
 */

// Hooks
export { useUserImpersonation } from "./hooks";
export type { StartImpersonationResult } from "./hooks";

// Table components
export {
  DataTableColumnHeader,
  DataTableFacetedFilter,
  DataTableToolbar,
  DataTableViewOptions,
  getUsersColumns,
  UsersTable,
} from "./components";

// Impersonation components
export { SessionSelectionDialog, UserActions } from "./components";
