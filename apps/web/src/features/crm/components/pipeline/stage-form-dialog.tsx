/**
 * Stage Form Dialog
 *
 * Modal for creating and editing pipeline stages.
 * Uses the generic NameColorFormDialog component.
 *
 * @module components/crm/pipeline/stage-form-dialog
 */

import { NameColorFormDialog, type NameColorFormData } from "@/shared/components/ui/name-color-form-dialog";

export type StageFormData = NameColorFormData;

interface StageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: StageFormData;
  onSubmit: (data: StageFormData) => void;
  isLoading?: boolean;
}

export function StageFormDialog(props: StageFormDialogProps) {
  return <NameColorFormDialog {...props} entityType="Stage" namePlaceholder="e.g., Lead, Qualified, Converted" />;
}
