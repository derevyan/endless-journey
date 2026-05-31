/**
 * CRM Settings Dialog
 *
 * Settings dialog with sidebar navigation for Pipeline and Custom Fields.
 *
 * @module components/crm/crm-settings-dialog
 */

import type { LucideIcon } from "lucide-react";
import { Calendar, Hash, LayoutGrid, ListChecks, Loader2, Pencil, Plus, Settings2, Star, Text, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

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
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Separator } from "@/shared/components/ui/separator";
import { SettingsContent, SettingsDialog, SettingsSection, type SettingsNavItem } from "@/shared/components/ui/settings-dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  useCreateCrmField,
  useCrmFields,
  useCrmPipelines,
  useDeleteCrmField,
  useDeleteCrmPipeline,
  useSetDefaultPipeline,
  useUpdateCrmField,
  useUpdateCrmPipeline,
  type CreateFieldInput,
  type CustomFieldDefinition,
} from "@/features/crm/hooks/queries";
import type { Pipeline } from "@/shared/lib/api";
import { notify } from "@/shared/lib/ui/notify";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// CONSTANTS
// =============================================================================

const PIPELINE_COLORS = [
  "#6b7280", // gray
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // yellow
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
];

type FieldType = "text" | "number" | "date" | "select" | "multi_select";

const FIELD_TYPES: { value: FieldType; label: string; icon: LucideIcon }[] = [
  { value: "text", label: "Text", icon: Text },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: Calendar },
  { value: "select", label: "Single Select", icon: ListChecks },
  { value: "multi_select", label: "Multi Select", icon: ListChecks },
];

const NAV_ITEMS: SettingsNavItem[] = [
  { id: "pipeline", name: "Pipeline", icon: LayoutGrid },
  { id: "fields", name: "Custom Fields", icon: Settings2 },
];

// =============================================================================
// TYPES
// =============================================================================

interface CrmSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline: Pipeline | undefined;
  onPipelineDeleted?: () => void;
}

interface FieldFormData {
  name: string;
  key: string;
  fieldType: FieldType;
  description: string;
  isRequired: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CrmSettingsDialog({ open, onOpenChange, pipeline, onPipelineDeleted }: CrmSettingsDialogProps) {
  const [activeItem, setActiveItem] = useState("pipeline");

  // Reset to pipeline tab when dialog opens
  useEffect(() => {
    if (open) {
      setActiveItem("pipeline");
    }
  }, [open]);

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title="CRM Settings"
      description="Manage your pipeline settings and custom fields"
      navItems={NAV_ITEMS}
      activeItem={activeItem}
      onItemChange={setActiveItem}
    >
      <SettingsContent id="pipeline">
        {pipeline ? (
          <PipelineSettingsContent
            pipeline={pipeline}
            onDeleted={() => {
              onPipelineDeleted?.();
              onOpenChange(false);
            }}
          />
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">No pipeline selected</div>
        )}
      </SettingsContent>

      <SettingsContent id="fields">
        <CustomFieldsContent />
      </SettingsContent>
    </SettingsDialog>
  );
}

// =============================================================================
// PIPELINE SETTINGS CONTENT
// =============================================================================

interface PipelineSettingsContentProps {
  pipeline: Pipeline;
  onDeleted: () => void;
}

function PipelineSettingsContent({ pipeline, onDeleted }: PipelineSettingsContentProps) {
  const [name, setName] = useState(pipeline.name);
  const [description, setDescription] = useState(pipeline.description || "");
  const [color, setColor] = useState(pipeline.color || PIPELINE_COLORS[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: pipelines = [] } = useCrmPipelines();
  const updateMutation = useUpdateCrmPipeline();
  const deleteMutation = useDeleteCrmPipeline();
  const setDefaultMutation = useSetDefaultPipeline();

  const isLastPipeline = pipelines.length <= 1;
  const hasChanges = name !== pipeline.name || description !== (pipeline.description || "") || color !== (pipeline.color || PIPELINE_COLORS[0]);

  // Sync state when pipeline changes
  useEffect(() => {
    setName(pipeline.name);
    setDescription(pipeline.description || "");
    setColor(pipeline.color || PIPELINE_COLORS[0]);
  }, [pipeline]);

  const handleSave = () => {
    if (!name.trim()) {
      notify.error("Name is required");
      return;
    }
    updateMutation.mutate({
      pipelineId: pipeline.id,
      input: {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      },
    });
  };

  const handleSetDefault = () => {
    setDefaultMutation.mutate(pipeline.id);
  };

  const handleDelete = () => {
    deleteMutation.mutate(pipeline.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        onDeleted();
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Form */}
      <SettingsSection title="General" description="Basic pipeline information">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pipeline-name" className="text-xs">
              Name
            </Label>
            <Input id="pipeline-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Sales Pipeline" className="h-8" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pipeline-description" className="text-xs">
              Description
            </Label>
            <Textarea
              id="pipeline-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="min-h-[60px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5">
              {PIPELINE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "size-6 rounded-full border-2 transition-all",
                    color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          Save Changes
        </Button>

        {!pipeline.isDefault && (
          <Button variant="outline" size="sm" onClick={handleSetDefault} disabled={setDefaultMutation.isPending}>
            {setDefaultMutation.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Star className="mr-1.5 size-3.5" />}
            Set as Default
          </Button>
        )}

        {pipeline.isDefault && (
          <Badge variant="secondary" className="text-xs">
            <Star className="mr-1 size-2.5 fill-current" />
            Default
          </Badge>
        )}
      </div>

      <Separator />

      {/* Danger Zone */}
      <SettingsSection title="Danger Zone" description="Deleting a pipeline will remove all its stages and unassign all clients.">
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={isLastPipeline}>
            <Trash2 className="mr-1.5 size-3.5" />
            Delete Pipeline
          </Button>
          {isLastPipeline && <span className="text-xs text-muted-foreground">Cannot delete the last pipeline</span>}
        </div>
      </SettingsSection>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{pipeline.name}"? All stages and client assignments within this pipeline will be removed. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// CUSTOM FIELDS CONTENT
// =============================================================================

function CustomFieldsContent() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [deletingField, setDeletingField] = useState<CustomFieldDefinition | null>(null);

  const { data: fields = [], isLoading } = useCrmFields();
  const createMutation = useCreateCrmField();
  const updateMutation = useUpdateCrmField();
  const deleteMutation = useDeleteCrmField();

  const sortedFields = [...fields].sort((a, b) => a.position - b.position);

  const handleCreate = (data: FieldFormData) => {
    const input: CreateFieldInput = {
      name: data.name,
      key: data.key,
      fieldType: data.fieldType,
      description: data.description || undefined,
      isRequired: data.isRequired,
    };
    createMutation.mutate(input, {
      onSuccess: () => setIsCreateOpen(false),
    });
  };

  const handleUpdate = (data: FieldFormData) => {
    if (!editingField) return;
    updateMutation.mutate(
      {
        fieldId: editingField.id,
        input: {
          name: data.name,
          description: data.description || undefined,
          isRequired: data.isRequired,
        },
      },
      { onSuccess: () => setEditingField(null) }
    );
  };

  const handleDelete = () => {
    if (!deletingField) return;
    deleteMutation.mutate(deletingField.id, {
      onSuccess: () => setDeletingField(null),
    });
  };

  const getFieldTypeIcon = (type: string) => {
    const fieldType = FIELD_TYPES.find((t) => t.value === type);
    return fieldType?.icon || Text;
  };

  const getFieldTypeLabel = (type: string) => {
    const fieldType = FIELD_TYPES.find((t) => t.value === type);
    return fieldType?.label || type;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Track additional client data with custom fields</p>
        <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-1.5 size-3.5" />
          Add Field
        </Button>
      </div>

      {sortedFields.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8">
          <p className="mb-3 text-sm text-muted-foreground">No custom fields yet</p>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />
            Create First Field
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          {sortedFields.map((field, index) => {
            const Icon = getFieldTypeIcon(field.fieldType);
            return (
              <div key={field.id} className={cn("flex items-center gap-3 px-3 py-2", index !== sortedFields.length - 1 && "border-b")}>
                <div className="flex size-7 items-center justify-center rounded bg-muted">
                  <Icon className="size-3.5 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{field.name}</span>
                    {field.isRequired && <span className="text-[10px] text-destructive">*</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1">{field.key}</code>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{getFieldTypeLabel(field.fieldType)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingField(field)}>
                    <Pencil className="size-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => setDeletingField(field)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <FieldFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} mode="create" onSubmit={handleCreate} isLoading={createMutation.isPending} />

      {/* Edit Dialog */}
      {editingField && (
        <FieldFormDialog
          open={!!editingField}
          onOpenChange={(open) => !open && setEditingField(null)}
          mode="edit"
          initialData={{
            name: editingField.name,
            key: editingField.key,
            fieldType: editingField.fieldType as FieldType,
            description: editingField.description || "",
            isRequired: editingField.isRequired || false,
          }}
          onSubmit={handleUpdate}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingField} onOpenChange={() => setDeletingField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingField?.name}"? All values for this field will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// FIELD FORM DIALOG
// =============================================================================

interface FieldFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: FieldFormData;
  onSubmit: (data: FieldFormData) => void;
  isLoading?: boolean;
}

function FieldFormDialog({ open, onOpenChange, mode, initialData, onSubmit, isLoading }: FieldFormDialogProps) {
  const [formData, setFormData] = useState<FieldFormData>(initialData || { name: "", key: "", fieldType: "text", description: "", isRequired: false });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      notify.error("Name is required");
      return;
    }
    if (!formData.key.trim()) {
      notify.error("Key is required");
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(formData.key)) {
      notify.error("Key must start with a letter and contain only lowercase letters, numbers, and underscores");
      return;
    }
    onSubmit(formData);
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => {
      const newData = { ...prev, name };
      if (mode === "create" && !prev.key) {
        const key = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
        newData.key = key;
      }
      return newData;
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (open && initialData) {
      setFormData(initialData);
    } else if (open) {
      setFormData({ name: "", key: "", fieldType: "text", description: "", isRequired: false });
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Custom Field" : "Edit Field"}</DialogTitle>
          <DialogDescription>{mode === "create" ? "Add a new field to track client data" : "Update field settings"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="field-name" className="text-xs">
                Name
              </Label>
              <Input
                id="field-name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Company Name"
                className="h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-key" className="text-xs">
                Key
              </Label>
              <Input
                id="field-key"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="e.g., company_name"
                disabled={mode === "edit"}
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="field-type" className="text-xs">
              Type
            </Label>
            <Select
              value={formData.fieldType}
              onValueChange={(value) => setFormData({ ...formData, fieldType: value as FieldType })}
              disabled={mode === "edit"}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select field type" />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="size-3.5" />
                      <span>{type.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="field-description" className="text-xs">
              Description (optional)
            </Label>
            <Textarea
              id="field-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this field for?"
              className="min-h-[60px] resize-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="field-required"
              checked={formData.isRequired}
              onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked === true })}
            />
            <Label htmlFor="field-required" className="text-sm font-normal">
              Required field
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
