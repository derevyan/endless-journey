/**
 * NameColorFormDialog Component
 *
 * Generic dialog for creating/editing entities with name, description, and color.
 * Used for pipelines, stages, and other similar entities.
 *
 * @module components/ui/name-color-form-dialog
 */

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { ColorPicker } from "@/shared/components/ui/badges";
import { Textarea } from "@/shared/components/ui/textarea";
import { ENTITY_COLORS } from "@/shared/lib/app-config";
import { notify } from "@/shared/lib/ui/notify";

export interface NameColorFormData {
  name: string;
  description?: string;
  color: string;
}

interface NameColorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Entity type for display text (e.g., "Pipeline", "Stage") */
  entityType: string;
  initialData?: NameColorFormData;
  onSubmit: (data: NameColorFormData) => void;
  isLoading?: boolean;
  /** Custom placeholder for name field */
  namePlaceholder?: string;
  /** Custom colors array (defaults to ENTITY_COLORS) */
  colors?: readonly string[];
}

/**
 * Generic form dialog for entities with name, description, and color.
 *
 * @example Pipeline usage
 * ```tsx
 * <NameColorFormDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   mode="create"
 *   entityType="Pipeline"
 *   namePlaceholder="e.g., Sales, Support, Onboarding"
 *   onSubmit={handleCreate}
 * />
 * ```
 *
 * @example Stage usage
 * ```tsx
 * <NameColorFormDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   mode="edit"
 *   entityType="Stage"
 *   initialData={stageData}
 *   namePlaceholder="e.g., Lead, Qualified, Converted"
 *   onSubmit={handleUpdate}
 * />
 * ```
 */
export function NameColorFormDialog({
  open,
  onOpenChange,
  mode,
  entityType,
  initialData,
  onSubmit,
  isLoading,
  namePlaceholder = "Enter name...",
  colors = ENTITY_COLORS,
}: NameColorFormDialogProps) {
  const defaultColor = colors[0];
  const [formData, setFormData] = useState<NameColorFormData>(initialData || { name: "", description: "", color: defaultColor });

  // Reset form when dialog opens with initial data
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({ name: "", description: "", color: defaultColor });
      }
    }
  }, [open, initialData, defaultColor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      notify.error("Name is required");
      return;
    }
    onSubmit({
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      color: formData.color,
    });
  };

  const entityLower = entityType.toLowerCase();
  const title = mode === "create" ? `Create ${entityType}` : `Edit ${entityType}`;
  const description = mode === "create" ? `Create a new ${entityLower} with name and color` : `Update ${entityLower} settings`;
  const submitLabel = mode === "create" ? "Create" : "Save";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${entityLower}-name`}>Name</Label>
            <Input
              id={`${entityLower}-name`}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={namePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${entityLower}-description`}>Description</Label>
            <Textarea
              id={`${entityLower}-description`}
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
            />
          </div>

          <ColorPicker label="Color" value={formData.color} onChange={(color) => setFormData({ ...formData, color })} colors={colors} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { NameColorFormDialogProps };
