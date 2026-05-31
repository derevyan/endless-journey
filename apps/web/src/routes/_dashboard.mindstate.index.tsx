/**
 * MindState Definitions List Route
 *
 * Lists all mindstate definitions for the organization.
 *
 * @module routes/_dashboard.mindstate.index
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Circle, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import type { MindstateStatus } from "@journey/schemas";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { StatusDotBadge } from "@/shared/components/ui/badges";
import { notify } from "@/shared/lib/ui/notify";

import { DashboardItemCard } from "@/features/dashboard/components/dashboard-item-card";
import { useMindstateDefinitionDialogNavigation, useMindstateDefinitions } from "@/features/mindstate";
import { useDeleteDefinition, useUpdateDefinition } from "@/features/mindstate/hooks/mutations/use-mindstate-mutations";
import { NewDefinitionDialog } from "@/features/mindstate/components/new-definition-dialog";
import { uiActions } from "@/stores/ui-store";

export const Route = createFileRoute("/_dashboard/mindstate/")({
  component: MindstateListPage,
});

function MindstateListPage() {
  const { data: definitions, isLoading } = useMindstateDefinitions();
  const { handleCreate } = useMindstateDefinitionDialogNavigation();
  const updateDefinition = useUpdateDefinition();
  const deleteDefinition = useDeleteDefinition();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [definitionToDelete, setDefinitionToDelete] = useState<{ key: string; name: string } | null>(null);

  const definitionList = definitions ?? [];

  const handleStatusChange = async (key: string, status: MindstateStatus) => {
    try {
      await updateDefinition.mutateAsync({ key, input: { status } });
      notify.success(`Status changed to ${status}`);
    } catch {
      notify.error("Failed to change status");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!definitionToDelete) return;

    try {
      await deleteDefinition.mutateAsync(definitionToDelete.key);
      notify.success("Definition deleted successfully");
      setDeleteDialogOpen(false);
      setDefinitionToDelete(null);
    } catch {
      notify.error("Failed to delete definition");
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Compact Header: One line, always on top */}
      <div className="flex shrink-0 items-center justify-between border-b bg-background/95 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight">MindState Definitions</h1>
          <span className="text-xs text-muted-foreground">({definitionList.length})</span>
        </div>
        <Button size="sm" onClick={() => uiActions.openNewDefinitionDialog()} className="h-8 gap-1.5 px-3">
          <Plus className="size-3.5" />
          <span>New Definition</span>
        </Button>
      </div>

      {/* New Definition Dialog - Self-managing, only needs onCreate callback */}
      <NewDefinitionDialog onCreate={handleCreate} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Definition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{definitionToDelete?.name}"? This action cannot be undone.
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

      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[100px] animate-pulse rounded-md border bg-muted/20 px-3 py-2 flex flex-col gap-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded mt-auto" />
              </div>
            ))}
          </div>
        ) : definitionList.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {definitionList.map((definition) => (
              <DashboardItemCard
                key={definition.key}
                title={definition.name}
                description={definition.description || `Key: ${definition.key}`}
                href="/mindstate/$definitionKey"
                params={{ definitionKey: definition.key }}
                status={
                  <StatusDotBadge
                    label={definition.status === "active" ? "Active" : definition.status === "draft" ? "Draft" : "Archived"}
                    dotClassName={definition.status === "active" ? "bg-emerald-500" : definition.status === "draft" ? "bg-amber-500" : "bg-slate-500"}
                    size="sm"
                    className="px-0"
                  />
                }
                footer={
                  <>
                    <span>{definition.defaultParameters?.length ?? 0} params</span>
                    <span className="size-1 rounded-full bg-border" />
                    <span>{definition.defaultAgents?.length ?? 0} agents</span>
                  </>
                }
                actions={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 relative z-10 -mr-1 -mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem asChild>
                        <Link to="/mindstate/$definitionKey" params={{ definitionKey: definition.key }}>
                          <Pencil className="mr-2 size-3.5" />
                          <span className="text-xs">Open Builder</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Circle className="mr-2 size-3.5" />
                          <span className="text-xs">Set Status</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(definition.key, "draft");
                            }}
                            disabled={definition.status === "draft"}
                            className="text-xs"
                          >
                            <span className="mr-2 size-1.5 rounded-full bg-amber-500" />
                            Draft
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(definition.key, "active");
                            }}
                            disabled={definition.status === "active"}
                            className="text-xs"
                          >
                            <span className="mr-2 size-1.5 rounded-full bg-emerald-500" />
                            Active
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(definition.key, "archived");
                            }}
                            disabled={definition.status === "archived"}
                            className="text-xs"
                          >
                            <span className="mr-2 size-1.5 rounded-full bg-slate-500" />
                            Archived
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDefinitionToDelete({ key: definition.key, name: definition.name });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        Delete Definition
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            ))}
          </div>
        ) : (
          <div className="border-dashed border rounded-lg bg-muted/10 flex flex-col items-center justify-center py-16 px-4">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
              <Boxes className="size-6" />
            </div>
            <h3 className="text-sm font-semibold mb-1">No MindState Definitions</h3>
            <p className="text-xs text-muted-foreground text-center mb-6 max-w-xs">
              MindState definitions let you create AI-powered state tracking for your journey users. Create your first definition to get started.
            </p>
            <Button size="sm" onClick={() => uiActions.openNewDefinitionDialog()} className="gap-2">
              <Plus className="size-3.5" />
              Create First Definition
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
