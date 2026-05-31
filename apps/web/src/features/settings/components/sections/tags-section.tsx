/**
 * Tags Section
 *
 * Manage organization-wide tags.
 * Tags are stored in client_tags table and follow users across all journeys.
 * Displays tags in a data table with CRUD operations.
 *
 * @module components/settings/sections/tags-section
 */

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Loader2, MoreHorizontal, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
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
import { ColorPicker, TagBadge } from "@/shared/components/ui/badges";
import {
  useAddTag,
  useTags,
  useRemoveTag,
  useUpdateTag,
  type GlobalTag,
} from "@/hooks/queries/use-tags";

// =============================================================================
// TAG FORM DIALOG
// =============================================================================

interface TagFormData {
  tag: string;
  description: string;
  color: string;
}

interface TagFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: TagFormData;
  onSubmit: (tag: string, description?: string, color?: string) => void;
  isLoading?: boolean;
}

function TagFormDialog({ open, onOpenChange, mode, initialData, onSubmit, isLoading }: TagFormDialogProps) {
  const [formData, setFormData] = useState<TagFormData>(initialData || { tag: "", description: "", color: "slate-500" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tag.trim()) {
      notify.error("Tag is required");
      return;
    }
    onSubmit(formData.tag.trim(), formData.description.trim() || undefined, formData.color);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Tag" : "Edit Tag"}</DialogTitle>
          <DialogDescription>{mode === "create" ? "Add a new tag for segmentation and filtering." : "Update tag color and description."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag">Tag</Label>
            <Input
              id="tag"
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
              placeholder="e.g., premium, vip, engaged"
              disabled={mode === "edit"}
            />
          </div>

          <ColorPicker label="Color" value={formData.color} onChange={(color) => setFormData({ ...formData, color })} />

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this tag used for?"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add Tag" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TagsSection() {
  const { data: tags = [], isLoading } = useTags();
  const addTagMutation = useAddTag();
  const updateTagMutation = useUpdateTag();
  const removeTagMutation = useRemoveTag();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<GlobalTag | null>(null);
  const [deleteTag, setDeleteTag] = useState<string | null>(null);

  const handleCreate = (tag: string, description?: string, color?: string) => {
    addTagMutation.mutate(
      { tag, description, color },
      {
        onSuccess: () => {
          setShowCreateDialog(false);
        },
        onError: () => notify.error("Failed to add tag"),
      }
    );
  };

  const handleEdit = (tag: string, description?: string, color?: string) => {
    updateTagMutation.mutate(
      { tag, description, color },
      {
        onSuccess: () => {
          notify.success("Tag updated");
          setEditingTag(null);
        },
        onError: () => notify.error("Failed to update tag"),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTag) return;
    removeTagMutation.mutate(deleteTag, {
      onSuccess: () => {
        setDeleteTag(null);
      },
      onError: () => notify.error("Failed to delete tag"),
    });
  };

  const columns: ColumnDef<GlobalTag>[] = [
    {
      accessorKey: "tag",
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Tag
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <TagBadge tag={row.getValue("tag")} color={row.original.color} />
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue("description") || "-"}</span>,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const tag = row.original;
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
              <DropdownMenuItem onClick={() => setEditingTag(tag)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteTag(tag.tag)} className="text-destructive focus:text-destructive">
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
          <Tags className="h-4 w-4" />
          <span>Organization-wide tags that follow users across all journeys</span>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tag
        </Button>
      </div>

      <DataTable columns={columns} data={tags} searchKey="tag" />

      {/* Create Dialog */}
      <TagFormDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} mode="create" onSubmit={handleCreate} isLoading={addTagMutation.isPending} />

      {/* Edit Dialog */}
      {editingTag && (
        <TagFormDialog
          open={!!editingTag}
          onOpenChange={(open) => !open && setEditingTag(null)}
          mode="edit"
          initialData={{
            tag: editingTag.tag,
            description: editingTag.description || "",
            color: editingTag.color || "slate-500",
          }}
          onSubmit={handleEdit}
          isLoading={updateTagMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTag} onOpenChange={(open) => !open && setDeleteTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag <code className="rounded bg-muted px-1">{deleteTag}</code>? This will remove it from all users. This action cannot be undone.
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
