/**
 * Users Page Route
 *
 * Dashboard page showing all telegram users.
 *
 * @module routes/_dashboard.users
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { notify } from "@/shared/lib/ui/notify";
import { userKeys } from "@/shared/lib/query-keys";

import { PageHeader } from "@/features/dashboard/components/page-header";
import { useJourneyListManifest } from "@/hooks/queries";
import { useUserImpersonation, SessionSelectionDialog } from "@/features/users";
import { UserDetailSheet } from "@/features/users/components/user-detail-sheet";
import { getUsersColumns } from "@/features/users/components/users-columns";
import { UsersTable } from "@/features/users/components/users-table";
import type { TelegramUserSession } from "@/shared/lib/api";
import { useTags } from "@/hooks/queries/use-tags";
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
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { apiClient, type TelegramUser } from "@/shared/lib/api";

export const Route = createFileRoute("/_dashboard/users")({
  component: UsersPage,
});

function UsersPage() {
  const [journeyFilter, setJourneyFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<TelegramUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<TelegramUser | null>(null);
  const [sessionDialog, setSessionDialog] = useState<{
    open: boolean;
    sessions: TelegramUserSession[];
  }>({ open: false, sessions: [] });
  const queryClient = useQueryClient();

  // Impersonation hook
  const { startImpersonation, loadSessionForPlayback, downloadSession } =
    useUserImpersonation();

  // Fetch journey list for filter
  const journeyListQuery = useJourneyListManifest();
  const journeys = journeyListQuery.data ?? [];

  // Fetch users with optional journey filter
  const usersQuery = useQuery({
    queryKey: userKeys.telegramUsers({ journeyId: journeyFilter === "all" ? undefined : journeyFilter }),
    queryFn: () => apiClient.getTelegramUsers({ journeyId: journeyFilter === "all" ? undefined : journeyFilter }),
  });

  const users = usersQuery.data?.users ?? [];

  // Fetch available tags for filter
  const userTagsQuery = useQuery({
    queryKey: userKeys.userTags(),
    queryFn: () => apiClient.getUserTags(),
  });

  const tagOptions = useMemo(() => {
    const tags = userTagsQuery.data ?? [];
    return tags.map((tag) => ({ label: tag, value: tag }));
  }, [userTagsQuery.data]);

  // Fetch tag definitions for colors
  const tagDefinitionsQuery = useTags();

  const tagDefinitions = useMemo(() => {
    const map = new Map<string, { color?: string | null; description?: string | null }>();
    const tags = tagDefinitionsQuery.data ?? [];
    for (const tag of tags) {
      map.set(tag.tag, { color: tag.color, description: tag.description });
    }
    return map;
  }, [tagDefinitionsQuery.data]);

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.deleteTelegramUser(userId),
    onSuccess: () => {
      notify.success("User deleted successfully");
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      setUserToDelete(null);
      setSelectedUser(null); // Close the sheet after delete
    },
    onError: (error) => {
      notify.error(error instanceof Error ? error.message : "Failed to delete user");
    },
  });

  // Row click opens the sheet
  const handleRowClick = useCallback((user: TelegramUser) => {
    setSelectedUser(user);
  }, []);

  // Delete from sheet
  const handleDeleteUser = useCallback(() => {
    if (selectedUser) {
      setUserToDelete(selectedUser);
    }
  }, [selectedUser]);

  const confirmDelete = useCallback(() => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  }, [userToDelete, deleteUserMutation]);

  // Handle impersonate button click
  const handleImpersonate = useCallback(async () => {
    if (!selectedUser) return;

    const result = await startImpersonation(selectedUser.id);

    if (result.showDialog && result.sessions) {
      setSessionDialog({
        open: true,
        sessions: result.sessions,
      });
    }
  }, [selectedUser, startImpersonation]);

  // Handle session selection from dialog
  const handleSessionSelect = useCallback(async (sessionId: string) => {
    setSessionDialog({ open: false, sessions: [] });
    await loadSessionForPlayback(sessionId);
  }, [loadSessionForPlayback]);

  // Handle session download from dialog
  const handleSessionDownload = useCallback(async (sessionId: string) => {
    await downloadSession(sessionId);
  }, [downloadSession]);

  // Memoize columns to prevent recreating on every render
  const columns = useMemo(
    () =>
      getUsersColumns({
        tagDefinitions,
      }),
    [tagDefinitions]
  );

  return (
    <div className="flex h-full flex-1 flex-col p-4">
      <PageHeader
        title="User List"
        description="View and manage all users in your journeys."
        actions={
          <>
            <Select value={journeyFilter} onValueChange={setJourneyFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by journey" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Journeys</SelectItem>
                {journeys.map((journey) => (
                  <SelectItem key={journey.id} value={journey.id}>
                    {journey.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => usersQuery.refetch()} disabled={usersQuery.isFetching}>
              <RefreshCw className={usersQuery.isFetching ? "animate-spin" : ""} />
            </Button>
          </>
        }
      />

      {/* Table Area */}
      <div className="flex-1 overflow-auto">
        <UsersTable
          columns={columns}
          data={users}
          isLoading={usersQuery.isLoading}
          tagOptions={tagOptions}
          onRowClick={handleRowClick}
          enableRowSelection={false}
        />
      </div>

      {/* User Detail Sheet */}
      <UserDetailSheet
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onDelete={handleDeleteUser}
        onImpersonate={handleImpersonate}
        tagDefinitions={tagDefinitions}
        isDeleting={deleteUserMutation.isPending}
      />

      {/* Session Selection Dialog */}
      <SessionSelectionDialog
        open={sessionDialog.open}
        onOpenChange={(open) => {
          if (!open) setSessionDialog({ open: false, sessions: [] });
        }}
        sessions={sessionDialog.sessions}
        onSelectSession={handleSessionSelect}
        onDownloadSession={handleSessionDownload}
        userName={
          selectedUser
            ? [selectedUser.firstName, selectedUser.lastName]
                .filter(Boolean)
                .join(" ") || "Unknown User"
            : "Unknown User"
        }
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete{" "}
                <strong>{userToDelete ? [userToDelete.firstName, userToDelete.lastName].filter(Boolean).join(" ") || "this user" : "this user"}</strong> and all
                associated data:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>
                  All sessions across all journeys ({userToDelete?.sessionCount ?? 0} session{(userToDelete?.sessionCount ?? 0) !== 1 ? "s" : ""})
                </li>
                <li>All interaction history and event logs</li>
                <li>All scheduled timers</li>
              </ul>
              <p className="text-sm font-medium text-destructive">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
