/**
 * CRM Pipeline Kanban View
 *
 * Drag-and-drop kanban board for managing clients across pipeline stages.
 *
 * @module components/crm/pipeline/pipeline-kanban
 */

import type { DragEndEvent, DragStartEvent, UniqueIdentifier } from "@dnd-kit/core";
import { GripVertical, MoreVertical, Pencil, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import * as Kanban from "@/shared/components/ui/kanban";
import { ScrollArea, ScrollBar } from "@/shared/components/ui/scroll-area";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { CrmClient, PipelineStage } from "@/shared/lib/api";

import { ClientDetailSheet } from "../client-detail";
import { AssignUsersDialog } from "./assign-users-dialog";
import { ClientCard } from "./client-card";
import { StageFormDialog, type StageFormData } from "./stage-form-dialog";

// =============================================================================
// TYPES
// =============================================================================

interface PipelineKanbanProps {
  stages: PipelineStage[];
  clients: CrmClient[];
  isLoading?: boolean;
  isFetching?: boolean;
  onClientStageChange?: (clientId: string, stageId: string | null) => void;
  onStageReorder?: (stageIds: string[]) => void;
  onCreateStage?: (data: { name: string; description?: string; color: string }) => void;
  onUpdateStage?: (stageId: string, data: { name: string; description?: string; color: string }) => void;
  onDeleteStage?: (stageId: string) => void;
  isCreatingStage?: boolean;
  isUpdatingStage?: boolean;
  isDeletingStage?: boolean;
  tagColorMap?: Record<string, string>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PipelineKanban({
  stages,
  clients,
  isLoading = false,
  isFetching: _isFetching = false,
  onClientStageChange,
  onStageReorder,
  onCreateStage,
  onUpdateStage,
  onDeleteStage,
  isCreatingStage = false,
  isUpdatingStage = false,
  isDeletingStage: _isDeletingStage = false,
  tagColorMap = {},
}: PipelineKanbanProps) {
  // State for client detail sheet
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  // State for assign dialog
  const [assignDialogStage, setAssignDialogStage] = useState<PipelineStage | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  // State for create stage dialog
  const [isCreateStageOpen, setIsCreateStageOpen] = useState(false);
  // State for edit stage dialog
  const [editStage, setEditStage] = useState<PipelineStage | null>(null);
  // State for delete confirmation
  const [deleteStage, setDeleteStage] = useState<PipelineStage | null>(null);

  // State for tracking drag origin (to fire API only on drop)
  const [dragOrigin, setDragOrigin] = useState<{
    clientId: string;
    originalStageId: string;
  } | null>(null);

  // Sort stages by position for display (initial sort)
  const sortedStagesFromProps = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);

  // Local state for immediate UI updates during drag
  const [sortedStages, setSortedStages] = useState<PipelineStage[]>(sortedStagesFromProps);

  // Sync from props when server data changes
  useEffect(() => {
    setSortedStages(sortedStagesFromProps);
  }, [sortedStagesFromProps]);

  // Find the default/system stage (Unassigned) for fallback
  const defaultStage = useMemo(() => stages.find((s) => s.isDefault || s.isSystem), [stages]);

  // Helper to group clients by stage
  const groupClientsByStage = useCallback(
    (clientList: CrmClient[], stageList: PipelineStage[]) => {
      const grouped: Record<UniqueIdentifier, CrmClient[]> = {};

      // Initialize columns for each stage
      for (const stage of stageList) {
        grouped[stage.id] = [];
      }

      // Group clients
      for (const client of clientList) {
        // Use client's stageId, or fall back to default stage
        const stageId = client.stageId || defaultStage?.id;
        if (stageId && grouped[stageId]) {
          grouped[stageId].push(client);
        } else if (defaultStage) {
          // Client has a stage that doesn't exist anymore - put in default stage
          grouped[defaultStage.id].push(client);
        }
      }

      return grouped;
    },
    [defaultStage]
  );

  // Use state for columns (enables optimistic updates)
  const [columns, setColumns] = useState<Record<UniqueIdentifier, CrmClient[]>>(() => groupClientsByStage(clients, stages));

  // Sync columns when clients or stages change (from server data)
  useEffect(() => {
    setColumns(groupClientsByStage(clients, stages));
  }, [clients, stages, groupClientsByStage]);

  // Handle column value changes (drag and drop items) - ONLY for optimistic UI updates
  const handleValueChange = useCallback((newColumns: Record<UniqueIdentifier, CrmClient[]>) => {
    // Only update local state for optimistic UI - API calls happen in handleDragEnd
    setColumns(newColumns);
  }, []);

  // Handle drag start - capture original position
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const clientId = event.active.id as string;

      // Check if this is a client (not a column)
      const isColumn = sortedStages.some((s) => s.id === clientId);
      if (isColumn) return;

      // Find the client's current stage
      for (const [stageId, stageClients] of Object.entries(columns)) {
        if (stageClients.some((c) => c.id === clientId)) {
          setDragOrigin({
            clientId,
            originalStageId: stageId,
          });
          break;
        }
      }
    },
    [columns, sortedStages]
  );

  // Handle drag end - fire API call only when drop is complete
  const handleDragEnd = useCallback(
    (_event: DragEndEvent) => {
      // Check if this is a client drag (not column reorder)
      if (!dragOrigin) {
        return;
      }

      if (!onClientStageChange) {
        setDragOrigin(null);
        return;
      }

      // Find where the client ended up
      const clientId = dragOrigin.clientId;
      let finalStageId: string | null = null;

      for (const [stageId, stageClients] of Object.entries(columns)) {
        if (stageClients.some((c) => c.id === clientId)) {
          finalStageId = stageId;
          break;
        }
      }

      // Only call API if stage actually changed
      if (finalStageId && finalStageId !== dragOrigin.originalStageId) {
        onClientStageChange(clientId, finalStageId);
      }

      setDragOrigin(null);
    },
    [columns, dragOrigin, onClientStageChange]
  );

  // Handle column move (reorder stages)
  const handleMove = useCallback(
    (event: { active: { id: UniqueIdentifier }; over: { id: UniqueIdentifier } | null; activeIndex: number; overIndex: number }) => {
      if (!onStageReorder || !event.over) return;

      const activeId = event.active.id;
      const overId = event.over.id;

      // Only reorder if both are stage columns (not item moves)
      const isActiveStage = sortedStages.some((s) => s.id === activeId);
      const isOverStage = sortedStages.some((s) => s.id === overId);

      if (!isActiveStage || !isOverStage) return;

      const activeIndex = sortedStages.findIndex((s) => s.id === activeId);
      const overIndex = sortedStages.findIndex((s) => s.id === overId);

      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return;

      // Create new order
      const newOrder = [...sortedStages];
      const [moved] = newOrder.splice(activeIndex, 1);
      newOrder.splice(overIndex, 0, moved);

      // Update local state immediately for instant UI response
      setSortedStages(newOrder);

      // Then call mutation (matches client card pattern)
      // Mutation's onMutate will also update React Query cache for server sync
      onStageReorder(newOrder.map((s) => s.id));
    },
    [onStageReorder, sortedStages]
  );

  // Get unassigned clients for the "Assign Users" dialog
  // These are clients in the default/system stage (the "Unassigned" stage)
  const unassignedClients = defaultStage ? columns[defaultStage.id] || [] : [];

  // Handle bulk assign
  const handleBulkAssign = useCallback(
    async (clientIds: string[]) => {
      if (!onClientStageChange || !assignDialogStage) return;

      setIsAssigning(true);
      try {
        // Assign each client to the stage
        for (const clientId of clientIds) {
          onClientStageChange(clientId, assignDialogStage.id);
        }
        setAssignDialogStage(null);
      } finally {
        setIsAssigning(false);
      }
    },
    [onClientStageChange, assignDialogStage]
  );

  // Handle edit stage
  const handleEditStage = useCallback(
    (data: StageFormData) => {
      if (!onUpdateStage || !editStage) return;
      onUpdateStage(editStage.id, data);
      setEditStage(null);
    },
    [onUpdateStage, editStage]
  );

  // Handle delete stage
  const handleDeleteStage = useCallback(() => {
    if (!onDeleteStage || !deleteStage) return;
    onDeleteStage(deleteStage.id);
    setDeleteStage(null);
  }, [onDeleteStage, deleteStage]);

  // Only show skeleton on initial load (no data yet)
  if (isLoading && clients.length === 0) {
    return <PipelineKanbanSkeleton columnCount={Math.max(stages.length, 3)} />;
  }

  return (
    <ScrollArea className="w-full">
      <div>
      <Kanban.Root
        value={columns}
        onValueChange={handleValueChange}
        onMove={handleMove}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        getItemValue={(item) => item.id}
      >
        <Kanban.Board className="pb-4">
          {/* All stage columns - including Unassigned (now a real stage) */}
          {sortedStages.map((stage) => (
            <StageColumn
              key={stage.id}
              columnId={stage.id}
              name={stage.name}
              color={stage.color || "#6b7280"}
              clients={columns[stage.id] || []}
              onAddClick={!stage.isSystem ? () => setAssignDialogStage(stage) : undefined}
              onEditClick={onUpdateStage ? () => setEditStage(stage) : undefined}
              onDeleteClick={onDeleteStage && !stage.isSystem ? () => setDeleteStage(stage) : undefined}
              onClientClick={setSelectedClientId}
              hasUnassignedClients={unassignedClients.length > 0}
              isDraggableColumn
              isSystemStage={stage.isSystem ?? false}
              tagColorMap={tagColorMap}
            />
          ))}

          {/* Add stage button */}
          {onCreateStage && (
            <div className="flex w-72 shrink-0 items-start">
              <Button variant="outline" className="w-full border-dashed" onClick={() => setIsCreateStageOpen(true)}>
                <Plus className="mr-2 size-4" />
                Add Stage
              </Button>
            </div>
          )}
        </Kanban.Board>

        {/* Dynamic drag overlay */}
        <Kanban.Overlay>
          {({ value, variant }) => {
            if (variant === "column") {
              // Dragging a stage column
              const stage = sortedStages.find((s) => s.id === value);
              if (!stage) return null;

              const columnClients = columns[value] || [];
              return <StageColumn columnId={stage.id} name={stage.name} color={stage.color || "#6b7280"} clients={columnClients} tagColorMap={tagColorMap} />;
            }

            // Dragging a client card
            const client = Object.values(columns)
              .flat()
              .find((c) => c.id === value);

            if (!client) return null;

            return <ClientCard client={client} tagColorMap={tagColorMap} />;
          }}
        </Kanban.Overlay>

        <ScrollBar orientation="horizontal" />
      </Kanban.Root>
      </div>

      {/* Assign Users Dialog */}
      {assignDialogStage && (
        <AssignUsersDialog
          open={!!assignDialogStage}
          onOpenChange={(open) => !open && setAssignDialogStage(null)}
          stageName={assignDialogStage.name}
          stageColor={assignDialogStage.color || "#6b7280"}
          unassignedClients={unassignedClients}
          onAssign={handleBulkAssign}
          isAssigning={isAssigning}
        />
      )}

      {/* Create Stage Dialog */}
      {onCreateStage && (
        <StageFormDialog
          open={isCreateStageOpen}
          onOpenChange={setIsCreateStageOpen}
          mode="create"
          onSubmit={(data) => {
            onCreateStage(data);
            setIsCreateStageOpen(false);
          }}
          isLoading={isCreatingStage}
        />
      )}

      {/* Edit Stage Dialog */}
      {editStage && (
        <StageFormDialog
          open={!!editStage}
          onOpenChange={(open) => !open && setEditStage(null)}
          mode="edit"
          initialData={{
            name: editStage.name,
            description: editStage.description || undefined,
            color: editStage.color || "#6b7280",
          }}
          onSubmit={handleEditStage}
          isLoading={isUpdatingStage}
        />
      )}

      {/* Delete Stage Confirmation */}
      {deleteStage && (
        <AlertDialog open={!!deleteStage} onOpenChange={(open) => !open && setDeleteStage(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Stage?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteStage.name}"? All clients in this stage will be moved to Unassigned.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteStage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Client Detail Sheet */}
      <ClientDetailSheet
        clientId={selectedClientId}
        onClose={() => setSelectedClientId(null)}
        tagColorMap={tagColorMap}
      />
    </ScrollArea>
  );
}

// =============================================================================
// STAGE COLUMN
// =============================================================================

interface StageColumnProps {
  columnId: string;
  name: string;
  color: string;
  clients: CrmClient[];
  onAddClick?: () => void;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  onClientClick?: (clientId: string) => void;
  hasUnassignedClients?: boolean;
  isDraggableColumn?: boolean;
  isSystemStage?: boolean;
  tagColorMap?: Record<string, string>;
}

function StageColumn({
  columnId,
  name,
  color,
  clients,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onClientClick,
  hasUnassignedClients,
  tagColorMap = {},
  isDraggableColumn,
  isSystemStage: _isSystemStage = false,
}: StageColumnProps) {
  return (
    <Kanban.Column value={columnId} className="w-76 shrink-0 bg-muted/20 px-2.5">
      {/* Column Header */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="font-semibold text-sm">{name}</h3>
          <Badge variant="secondary" className="pointer-events-none rounded-sm text-xs">
            {clients.length}
          </Badge>
        </div>
        <div className="flex items-center">
          {onAddClick && hasUnassignedClients && (
            <Button variant="ghost" size="icon" className="size-7" onClick={onAddClick} title="Add clients to this stage">
              <UserPlus className="size-4" />
            </Button>
          )}
          {(onEditClick || onDeleteClick) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEditClick && (
                  <DropdownMenuItem onClick={onEditClick}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onEditClick && onDeleteClick && <DropdownMenuSeparator />}
                {onDeleteClick && (
                  <DropdownMenuItem onClick={onDeleteClick} className="text-destructive">
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isDraggableColumn && (
            <Kanban.ColumnHandle asChild>
              <Button variant="ghost" size="icon" className="size-7 cursor-grab">
                <GripVertical className="size-4" />
              </Button>
            </Kanban.ColumnHandle>
          )}
        </div>
      </div>

      {/* Column Content */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-2">
          {clients.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center">
              <Users className="mx-auto mb-2 size-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Drag clients here</p>
            </div>
          ) : (
            clients.map((client) => (
              <Kanban.Item key={client.id} value={client.id} asHandle asChild>
                <div>
                  <ClientCard client={client} tagColorMap={tagColorMap} onClientClick={onClientClick} />
                </div>
              </Kanban.Item>
            ))
          )}
        </div>
      </ScrollArea>
    </Kanban.Column>
  );
}

// =============================================================================
// SKELETON
// =============================================================================

function PipelineKanbanSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columnCount }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-2 rounded-lg border bg-muted/50 p-2.5">
          <div className="flex items-center gap-2 px-1 pb-2">
            <Skeleton className="size-3 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-28 w-full rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
