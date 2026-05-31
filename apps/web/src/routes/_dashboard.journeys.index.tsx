/**
 * Journeys List Route
 *
 * Lists all journeys for the organization with cards.
 * Click a card to navigate to the journey builder.
 *
 * @module routes/_dashboard.journeys.index
 */

import type { JourneyStatus } from "@journey/schemas";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Circle, LayoutTemplate, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { DashboardItemCard } from "@/features/dashboard/components/dashboard-item-card";
import { NewJourneyDialog } from "@/features/journey/components/new-journey-dialog";
import { useCreateJourneyWithNavigation, useDeleteJourney, useUpdateJourneyStatus } from "@/features/journey/hooks/use-journey-mutations";
import { useJourneyListManifest } from "@/hooks/queries";
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
import { EntityStatusBadge } from "@/shared/components/ui/badges";
import { notify } from "@/shared/lib/ui/notify";

export const Route = createFileRoute("/_dashboard/journeys/")({
  component: JourneysListPage,
});

// =============================================================================
// STATUS OPTIONS
// =============================================================================

const STATUS_OPTIONS: { value: JourneyStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "bg-orange-500" },
  { value: "active", label: "Active", color: "bg-emerald-500" },
  { value: "archived", label: "Archived", color: "bg-slate-500" },
];

// =============================================================================
// COMPONENT
// =============================================================================

function JourneysListPage() {
  const { data: journeys, isLoading } = useJourneyListManifest();
  const createJourney = useCreateJourneyWithNavigation();
  const deleteJourney = useDeleteJourney();
  const updateJourneyStatus = useUpdateJourneyStatus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [journeyToDelete, setJourneyToDelete] = useState<{ id: string; name: string } | null>(null);

  const journeyList = journeys ?? [];

  const handleStatusChange = async (id: string, status: JourneyStatus) => {
    try {
      await updateJourneyStatus.mutateAsync({ id, status });
    } catch {
      // Error handled by mutation
    }
  };

  const handleCreate = async (values: { name: string; description?: string }) => {
    try {
      await createJourney.mutateAsync({
        name: values.name,
        description: values.description,
      });
      setDialogOpen(false);
    } catch {
      notify.error("Failed to create journey");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!journeyToDelete) return;

    try {
      await deleteJourney.mutateAsync(journeyToDelete.id);
      setDeleteDialogOpen(false);
      setJourneyToDelete(null);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Compact Header: One line, always on top */}
      <div className="flex shrink-0 items-center justify-between border-b bg-background/95 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight">Active Journeys</h1>
          <span className="text-xs text-muted-foreground">({journeyList.length})</span>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="h-8 gap-1.5 px-3">
          <Plus className="size-3.5" />
          <span>New Journey</span>
        </Button>
      </div>

      <NewJourneyDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={handleCreate} isLoading={createJourney.isPending} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journey</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{journeyToDelete?.name}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
        ) : journeyList.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {journeyList.map((journey) => (
              <DashboardItemCard
                key={journey.id}
                title={journey.name}
                subtitle={journey.slug}
                description={journey.description}
                href="/journeys/$journeySlug"
                params={{ journeySlug: journey.slug }}
                status={journey.status && <EntityStatusBadge status={journey.status} size="sm" className="px-0" entityType="journey" />}
                footer={
                  <>
                    <span>{journey.nodeCount} nodes</span>
                    <span className="size-1 rounded-full bg-border" />
                    <span>{journey.edgeCount} edges</span>
                  </>
                }
                actions={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-6 relative z-10 -mr-1 -mt-0.5" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem asChild>
                        <Link to="/journeys/$journeySlug" params={{ journeySlug: journey.slug }}>
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
                          {STATUS_OPTIONS.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(journey.id, option.value);
                              }}
                              disabled={journey.status === option.value}
                              className="text-xs"
                            >
                              <span className={`mr-2 size-1.5 rounded-full ${option.color}`} />
                              {option.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setJourneyToDelete({ id: journey.id, name: journey.name });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        Delete Journey
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
              <LayoutTemplate className="size-6" />
            </div>
            <h3 className="text-sm font-semibold mb-1">No Journeys Found</h3>
            <p className="text-xs text-muted-foreground text-center mb-6 max-w-xs">Start building your first conversational flow to see it listed here.</p>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="size-3.5" />
              Create First Journey
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
