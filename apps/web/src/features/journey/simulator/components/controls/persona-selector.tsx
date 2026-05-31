/**
 * Persona Selector
 *
 * Dropdown component for selecting a test persona before starting simulation.
 * Supports creating new personas and selecting anonymous mode.
 *
 * @module features/simulator/components/controls/persona-selector
 */

import { useState } from "react";
import { Check, ChevronDown, Plus, User, UserCircle, RotateCcw, Trash2, X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
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

import {
  usePersonas,
  useCreatePersona,
  useDeletePersona,
  useResetPersona,
  useCleanupAllTestData,
} from "../../hooks/use-personas";

interface PersonaSelectorProps {
  selectedPersonaId: string | null;
  onSelect: (personaId: string | null) => void;
  disabled?: boolean;
}

export function PersonaSelector({ selectedPersonaId, onSelect, disabled }: PersonaSelectorProps) {
  const { data: personas = [], isLoading } = usePersonas();
  const createPersona = useCreatePersona();
  const deletePersona = useDeletePersona();
  const resetPersona = useResetPersona();
  const cleanup = useCleanupAllTestData();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newPersonaName, setNewPersonaName] = useState("");

  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

  const handleCreate = async () => {
    if (!newPersonaName.trim()) return;

    const result = await createPersona.mutateAsync({ name: newPersonaName.trim() });
    onSelect(result.id);
    setNewPersonaName("");
    setCreateDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    await deletePersona.mutateAsync(deleteConfirmId);
    if (selectedPersonaId === deleteConfirmId) {
      onSelect(null);
    }
    setDeleteConfirmId(null);
  };

  const handleReset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await resetPersona.mutateAsync(id);
  };

  const handleCleanup = async () => {
    await cleanup.mutateAsync();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled} className="h-7 gap-1 min-w-[140px] justify-between">
            {selectedPersona ? (
              <>
                <UserCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{selectedPersona.name}</span>
              </>
            ) : (
              <>
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">Anonymous</span>
              </>
            )}
            <ChevronDown className="w-3 h-3 shrink-0 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Test Persona
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Anonymous option */}
          <DropdownMenuItem onClick={() => onSelect(null)}>
            <User className="w-4 h-4 mr-2" />
            <span className="flex-1">Anonymous</span>
            {selectedPersonaId === null && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>

          {/* Personas list */}
          {isLoading ? (
            <DropdownMenuItem disabled>
              <span className="text-muted-foreground">Loading...</span>
            </DropdownMenuItem>
          ) : (
            personas.map((persona) => (
              <DropdownMenuItem
                key={persona.id}
                onClick={() => onSelect(persona.id)}
                className="group"
              >
                <UserCircle className="w-4 h-4 mr-2" />
                <span className="flex-1 truncate">{persona.name}</span>
                {selectedPersonaId === persona.id && (
                  <Check className="w-4 h-4 text-primary" />
                )}
                {/* Action buttons (visible on hover) */}
                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 ml-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => handleReset(persona.id, e)}
                    disabled={resetPersona.isPending}
                    title="Reset persona data"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(persona.id);
                    }}
                    disabled={deletePersona.isPending}
                    title="Delete persona"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          )}

          <DropdownMenuSeparator />

          {/* Create new persona */}
          <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create new persona
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Clean up test data */}
          <DropdownMenuItem
            onClick={handleCleanup}
            disabled={cleanup.isPending}
            className="text-muted-foreground"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clean up test data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Persona Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create Test Persona</DialogTitle>
            <DialogDescription>
              Create a reusable test identity for simulator sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newPersonaName}
                onChange={(e) => setNewPersonaName(e.target.value)}
                placeholder="e.g., Sales Lead, VIP Customer"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newPersonaName.trim() || createPersona.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Persona?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the persona and its associated client data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
