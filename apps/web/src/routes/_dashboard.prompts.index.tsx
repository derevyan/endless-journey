/**
 * Prompts List Route
 *
 * Lists all prompts for the organization in a Langfuse-style table.
 * Links to /prompts/new for creating new prompts (full-page form).
 *
 * @module routes/_dashboard.prompts.index
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { FileText, Plus, X } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

import { PromptsTable, getPromptsColumns } from "@/features/prompts/components";
import { usePrompts, useDeletePrompt } from "@/features/prompts/hooks";
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
import { notify } from "@/shared/lib/ui/notify";
import type { PromptResponse } from "@journey/schemas";

export const Route = createFileRoute("/_dashboard/prompts/")({
  component: PromptsListPage,
});

function PromptsListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = usePrompts();
  const deletePrompt = useDeletePrompt();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);

  const prompts = data?.prompts ?? [];

  // Handle delete action from table
  const handleDeleteClick = useCallback((name: string) => {
    setPromptToDelete(name);
    setDeleteDialogOpen(true);
  }, []);

  // Memoized columns with delete handler
  const columns = useMemo(
    () => getPromptsColumns({ onDelete: handleDeleteClick }),
    [handleDeleteClick]
  );

  const handleDeleteConfirm = async () => {
    if (!promptToDelete) return;

    try {
      await deletePrompt.mutateAsync(promptToDelete);
      notify.success("Prompt deleted successfully");
      setDeleteDialogOpen(false);
      setPromptToDelete(null);
    } catch {
      notify.error("Failed to delete prompt");
    }
  };

  const handleRowClick = useCallback(
    (prompt: PromptResponse) => {
      navigate({
        to: "/prompts/$promptName",
        params: { promptName: prompt.name },
      });
    },
    [navigate]
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b bg-background/95 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight">Prompts</h1>
          <span className="text-xs text-muted-foreground">({prompts.length})</span>
        </div>
        <Button asChild size="sm" className="h-8 gap-1.5 px-3">
          <Link to="/prompts/new">
            <Plus className="size-3.5" />
            <span>New Prompt</span>
          </Link>
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{promptToDelete}"? This will delete all versions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Table Content */}
      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {prompts.length > 0 || isLoading ? (
          <PromptsTable
            columns={columns}
            data={prompts}
            isLoading={isLoading}
            onRowClick={handleRowClick}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 px-4 py-16">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="size-6" />
            </div>
            <h3 className="mb-1 text-sm font-semibold">No Prompts Found</h3>
            <p className="mb-6 max-w-xs text-center text-xs text-muted-foreground">
              Create versioned prompt templates for use in agent workflows.
            </p>
            <Button asChild size="sm" className="gap-2">
              <Link to="/prompts/new">
                <Plus className="size-3.5" />
                Create First Prompt
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
