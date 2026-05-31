/**
 * Variables Section
 *
 * Manage global and journey-scoped variables.
 * Displays variables in a data table with CRUD operations.
 *
 * @module components/settings/sections/variables-section
 */

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Globe, Loader2, MoreHorizontal, Pencil, Plus, Route, Trash2, X } from "lucide-react";
import { useState } from "react";

import { notify } from "@/shared/lib/ui/notify";

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
import { DataTable } from "@/shared/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";
import { VariableTypeBadge, inferVariableType, type VariableType } from "@/shared/components/ui/badges";
import { useJourneyListManifest } from "@/hooks/queries";
import {
  useDeleteGlobalVariable,
  useDeleteJourneyVariable,
  useGlobalVariables,
  useJourneyVariables,
  useSetGlobalVariable,
  useSetJourneyVariable,
  type GlobalVariable,
  type JourneyVariable,
} from "@/hooks/queries/use-variables";

// =============================================================================
// TYPES
// =============================================================================

interface VariableFormData {
  key: string;
  value: string;
  type: VariableType;
  description: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function parseValue(value: string, type: VariableType): unknown {
  switch (type) {
    case "number":
      return Number(value);
    case "boolean":
      return value === "true";
    case "array":
    case "object":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function formatDisplayValue(value: unknown): string {
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

// =============================================================================
// VARIABLE FORM DIALOG
// =============================================================================

interface VariableFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: VariableFormData;
  onSubmit: (data: VariableFormData) => void;
  isLoading?: boolean;
}

function VariableFormDialog({ open, onOpenChange, mode, initialData, onSubmit, isLoading }: VariableFormDialogProps) {
  const [formData, setFormData] = useState<VariableFormData>(initialData || { key: "", value: "", type: "string", description: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.key.trim()) {
      notify.error("Key is required");
      return;
    }
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Variable" : "Edit Variable"}</DialogTitle>
          <DialogDescription>{mode === "create" ? "Add a new variable to store data." : "Update the variable value or description."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="e.g., points, badges, counter"
              disabled={mode === "edit"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={formData.type} onValueChange={(value: VariableType) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="array">Array (JSON)</SelectItem>
                <SelectItem value="object">Object (JSON)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            {formData.type === "boolean" ? (
              <Select value={String(formData.value === "true")} onValueChange={(value) => setFormData({ ...formData, value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">true</SelectItem>
                  <SelectItem value="false">false</SelectItem>
                </SelectContent>
              </Select>
            ) : formData.type === "array" || formData.type === "object" ? (
              <Textarea
                id="value"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder={formData.type === "array" ? '["item1", "item2"]' : '{"key": "value"}'}
                className="font-mono text-sm"
                rows={4}
              />
            ) : (
              <Input
                id="value"
                type={formData.type === "number" ? "number" : "text"}
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="Enter value"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this variable used for?"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// GLOBAL VARIABLES TAB
// =============================================================================

function GlobalVariablesTab() {
  const { data: variables = [], isLoading } = useGlobalVariables();
  const setVariableMutation = useSetGlobalVariable();
  const deleteVariableMutation = useDeleteGlobalVariable();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingVariable, setEditingVariable] = useState<GlobalVariable | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const handleCreate = (data: VariableFormData) => {
    const parsedValue = parseValue(data.value, data.type);
    setVariableMutation.mutate(
      { key: data.key, value: parsedValue, description: data.description || undefined },
      {
        onSuccess: () => {
          notify.success("Variable created");
          setShowCreateDialog(false);
        },
        onError: () => notify.error("Failed to create variable"),
      }
    );
  };

  const handleEdit = (data: VariableFormData) => {
    const parsedValue = parseValue(data.value, data.type);
    setVariableMutation.mutate(
      { key: data.key, value: parsedValue, description: data.description || undefined },
      {
        onSuccess: () => {
          notify.success("Variable updated");
          setEditingVariable(null);
        },
        onError: () => notify.error("Failed to update variable"),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteKey) return;
    deleteVariableMutation.mutate(deleteKey, {
      onSuccess: () => {
        notify.success("Variable deleted");
        setDeleteKey(null);
      },
      onError: () => notify.error("Failed to delete variable"),
    });
  };

  const columns: ColumnDef<GlobalVariable>[] = [
    {
      accessorKey: "key",
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Key
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm font-medium">{row.getValue("key")}</code>,
    },
    {
      accessorKey: "value",
      header: "Value",
      cell: ({ row }) => {
        const value = row.original.value;
        const displayValue = formatDisplayValue(value);
        const truncatedValue = displayValue.length > 50 ? displayValue.slice(0, 50) + "..." : displayValue;
        return <span className="font-mono text-sm text-muted-foreground">{truncatedValue}</span>;
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <VariableTypeBadge value={row.original.value} size="sm" />,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue("description") || "-"}</span>,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const variable = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setEditingVariable(variable)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteKey(variable.key)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span>Organization-wide variables shared across all journeys</span>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Variable
        </Button>
      </div>

      <DataTable columns={columns} data={variables} searchKey="key" />

      {/* Create Dialog */}
      <VariableFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        mode="create"
        onSubmit={handleCreate}
        isLoading={setVariableMutation.isPending}
      />

      {/* Edit Dialog */}
      {editingVariable && (
        <VariableFormDialog
          open={!!editingVariable}
          onOpenChange={(open) => !open && setEditingVariable(null)}
          mode="edit"
          initialData={{
            key: editingVariable.key,
            value: formatValue(editingVariable.value),
            type: inferVariableType(editingVariable.value),
            description: editingVariable.description || "",
          }}
          onSubmit={handleEdit}
          isLoading={setVariableMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteKey} onOpenChange={(open) => !open && setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Variable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the variable <code className="rounded bg-muted px-1">{deleteKey}</code>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// JOURNEY VARIABLES TAB
// =============================================================================

function JourneyVariablesTab() {
  const { data: journeys = [], isLoading: journeysLoading } = useJourneyListManifest();
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>("");

  const { data: variables = [], isLoading: variablesLoading } = useJourneyVariables(selectedJourneyId || undefined);
  const setVariableMutation = useSetJourneyVariable();
  const deleteVariableMutation = useDeleteJourneyVariable();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingVariable, setEditingVariable] = useState<JourneyVariable | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const handleCreate = (data: VariableFormData) => {
    if (!selectedJourneyId) return;
    const parsedValue = parseValue(data.value, data.type);
    setVariableMutation.mutate(
      { journeyId: selectedJourneyId, key: data.key, value: parsedValue, description: data.description || undefined },
      {
        onSuccess: () => {
          notify.success("Variable created");
          setShowCreateDialog(false);
        },
        onError: () => notify.error("Failed to create variable"),
      }
    );
  };

  const handleEdit = (data: VariableFormData) => {
    if (!selectedJourneyId) return;
    const parsedValue = parseValue(data.value, data.type);
    setVariableMutation.mutate(
      { journeyId: selectedJourneyId, key: data.key, value: parsedValue, description: data.description || undefined },
      {
        onSuccess: () => {
          notify.success("Variable updated");
          setEditingVariable(null);
        },
        onError: () => notify.error("Failed to update variable"),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteKey || !selectedJourneyId) return;
    deleteVariableMutation.mutate(
      { journeyId: selectedJourneyId, key: deleteKey },
      {
        onSuccess: () => {
          notify.success("Variable deleted");
          setDeleteKey(null);
        },
        onError: () => notify.error("Failed to delete variable"),
      }
    );
  };

  const isLoading = journeysLoading || (selectedJourneyId && variablesLoading);

  const columns: ColumnDef<JourneyVariable>[] = [
    {
      accessorKey: "key",
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Key
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm font-medium">{row.getValue("key")}</code>,
    },
    {
      accessorKey: "value",
      header: "Value",
      cell: ({ row }) => {
        const value = row.original.value;
        const displayValue = formatDisplayValue(value);
        const truncatedValue = displayValue.length > 50 ? displayValue.slice(0, 50) + "..." : displayValue;
        return <span className="font-mono text-sm text-muted-foreground">{truncatedValue}</span>;
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <VariableTypeBadge value={row.original.value} size="sm" />,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue("description") || "-"}</span>,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const variable = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setEditingVariable(variable)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteKey(variable.key)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Route className="h-4 w-4" />
          <span>Variables scoped to a specific journey</span>
        </div>
      </div>

      {/* Journey Selector */}
      <div className="flex items-center gap-4">
        <Select value={selectedJourneyId} onValueChange={setSelectedJourneyId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a journey" />
          </SelectTrigger>
          <SelectContent>
            {journeys.map((journey) => (
              <SelectItem key={journey.id} value={journey.id}>
                {journey.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedJourneyId && (
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Variable
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedJourneyId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Route className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-1 font-medium">Select a journey</h3>
          <p className="text-sm text-muted-foreground">Choose a journey to view and manage its variables.</p>
        </div>
      ) : (
        <DataTable columns={columns} data={variables} searchKey="key" />
      )}

      {/* Create Dialog */}
      <VariableFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        mode="create"
        onSubmit={handleCreate}
        isLoading={setVariableMutation.isPending}
      />

      {/* Edit Dialog */}
      {editingVariable && (
        <VariableFormDialog
          open={!!editingVariable}
          onOpenChange={(open) => !open && setEditingVariable(null)}
          mode="edit"
          initialData={{
            key: editingVariable.key,
            value: formatValue(editingVariable.value),
            type: inferVariableType(editingVariable.value),
            description: editingVariable.description || "",
          }}
          onSubmit={handleEdit}
          isLoading={setVariableMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteKey} onOpenChange={(open) => !open && setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Variable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the variable <code className="rounded bg-muted px-1">{deleteKey}</code>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VariablesSection() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="global" className="gap-2">
            <Globe className="h-4 w-4" />
            Global
          </TabsTrigger>
          <TabsTrigger value="journey" className="gap-2">
            <Route className="h-4 w-4" />
            Journey
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-6">
          <GlobalVariablesTab />
        </TabsContent>

        <TabsContent value="journey" className="mt-6">
          <JourneyVariablesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
