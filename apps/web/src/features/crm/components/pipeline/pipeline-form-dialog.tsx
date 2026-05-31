/**
 * Pipeline Form Dialog
 *
 * Modal for creating and editing pipelines.
 * Uses the generic NameColorFormDialog component.
 *
 * @module components/crm/pipeline/pipeline-form-dialog
 */

import { NameColorFormDialog, type NameColorFormData } from "@/shared/components/ui/name-color-form-dialog";

export type PipelineFormData = NameColorFormData;

interface PipelineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: PipelineFormData;
  onSubmit: (data: PipelineFormData) => void;
  isLoading?: boolean;
}

export function PipelineFormDialog(props: PipelineFormDialogProps) {
  return <NameColorFormDialog {...props} entityType="Pipeline" namePlaceholder="e.g., Sales, Support, Onboarding" />;
}
