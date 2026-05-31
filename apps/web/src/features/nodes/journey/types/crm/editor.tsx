/**
 * CrmNodeEditor Component
 *
 * Editor for CRM node type with simplified logic:
 * - Just select pipeline and/or stage
 * - Pipeline only → Move to that pipeline (default stage)
 * - Pipeline + stage → Move to specific stage
 * - Engine figures out if create or move is needed
 */

import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { TemplateProvider } from "@/shared/components/ui/template-context";
import { TemplateTextarea } from "@/shared/components/ui/template-textarea";
import { crmApi } from "@/shared/lib/api/crm";
import { useNodeEditorContext } from "../../hooks/use-node-editor-context";
import { useNodeEditorForm, useFormFieldValue } from "../../hooks/use-node-editor-form";
import type { StringFieldApi } from "../../forms/form-types";
import { EditorBase } from "../../editors/editor-base";
import { EditorNameField } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import type { NodeEditorProps } from "../../editors/types";

export function CrmNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);
  const { nodes, edges, journeyUuid } = useNodeEditorContext();

  // Fetch pipelines
  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: () => crmApi.pipelines.getPipelines(),
  });

  // Subscribe to form state for pipelineId to trigger re-renders when it changes
  const selectedPipelineId = useFormFieldValue(form, "pipelineId") as string | undefined;

  // Determine if we should hide the pipeline selector (only when exactly 1 pipeline exists)
  const hasSinglePipeline = !pipelinesLoading && pipelines.length === 1;

  // Find default pipeline to auto-select
  const defaultPipeline = pipelines.find((p) => p.isDefault) || pipelines[0];

  // Auto-select default pipeline when no pipeline is selected
  useEffect(() => {
    if (!pipelinesLoading && pipelines.length > 0 && !selectedPipelineId) {
      const defaultToSelect = pipelines.find((p) => p.isDefault) || pipelines[0];
      if (defaultToSelect) {
        form.setFieldValue("pipelineId", defaultToSelect.id);
      }
    }
  }, [pipelinesLoading, pipelines, selectedPipelineId, form]);

  // For stages query: use selectedPipelineId, or fall back to default pipeline's ID if auto-selecting
  const effectivePipelineId = selectedPipelineId || defaultPipeline?.id;

  // Fetch stages for selected pipeline
  const { data: stages = [], isLoading: stagesLoading } = useQuery({
    queryKey: ["crm-stages", effectivePipelineId],
    queryFn: () => crmApi.stages.getStages(effectivePipelineId),
    enabled: !!effectivePipelineId,
  });

  // Cancel handler: reset form (does not close editor)
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  return (
    <EditorBase
      title={readOnly ? "CRM Node Info" : "Edit CRM Node"}
      nodeId={node.id}
      onClose={onClose}
      onDelete={onDelete}
      onAutoSaveClose={validateAndSave}
      onSave={validateAndSave}
      onCancel={handleCancel}
      isSaving={isSaving}
      isDirty={isDirty}
      readOnly={readOnly}
    >
      {/* 1. Name */}
      <EditorNameField form={form} nodeId={node.id} readOnly={readOnly} />

      {/* 2. Pipeline Selection - hidden when only one pipeline exists */}
      {!hasSinglePipeline && (
        <form.Field name="pipelineId">
          {(field: StringFieldApi) => (
            <div className="space-y-1.5">
              <Label htmlFor={`pipelineId-${node.id}`} className="text-[11px] text-muted-foreground">
                Pipeline
              </Label>
              <Select
                value={field.state.value || ""}
                onValueChange={(value) => {
                  field.handleChange(value);
                  // Clear stage when pipeline changes
                  form.setFieldValue("stageId", undefined);
                }}
                disabled={readOnly || pipelinesLoading}
              >
                <SelectTrigger size="sm" id={`pipelineId-${node.id}`}>
                  <SelectValue placeholder={pipelinesLoading ? "Loading..." : "Select pipeline"} />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      <div className="flex items-center gap-2">
                        {pipeline.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pipeline.color }} />}
                        <span>{pipeline.name}</span>
                        {pipeline.isDefault && <span className="text-[10px] text-muted-foreground">(default)</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Target pipeline for this CRM action</p>
            </div>
          )}
        </form.Field>
      )}

      {/* 3. Stage Selection */}
      <form.Field name="stageId">
        {(field: StringFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={`stageId-${node.id}`} className="text-[11px] text-muted-foreground">
              Stage <span className="font-normal">(optional)</span>
            </Label>
            <Select
              value={field.state.value || "_default"}
              onValueChange={(value) => (field.handleChange as (v: string | undefined) => void)(value === "_default" ? undefined : value)}
              disabled={readOnly || stagesLoading || (!effectivePipelineId && stages.length === 0)}
            >
              <SelectTrigger size="sm" id={`stageId-${node.id}`}>
                <SelectValue placeholder={!effectivePipelineId ? "Select pipeline first" : stagesLoading ? "Loading..." : "Select stage"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_default">
                  <span className="text-muted-foreground">Default Stage (Unassigned)</span>
                </SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      {stage.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />}
                      <span>{stage.name}</span>
                      {stage.isSystem && <span className="text-[10px] text-muted-foreground">(system)</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">If not set, client will be added to the "Unassigned" stage</p>
          </div>
        )}
      </form.Field>

      {/* 4. Notes */}
      <form.Field name="crmNotes">
        {(field: StringFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={`crmNotes-${node.id}`} className="text-[11px] text-muted-foreground">
              Notes <span className="font-normal">(optional)</span>
            </Label>
            <TemplateProvider nodeId={node.id} nodes={nodes} edges={edges} journeyId={journeyUuid}>
              <TemplateTextarea
                id={`crmNotes-${node.id}`}
                value={field.state.value || ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Reason for stage change..."
                className="min-h-[80px] resize-y text-sm"
                disabled={readOnly}
              />
            </TemplateProvider>
            <p className="text-[10px] text-muted-foreground">Recorded in CRM activity timeline. Type {"{{" } for variables.</p>
          </div>
        )}
      </form.Field>

      {/* Common Sections (Tags, Variables, Metadata, Advanced) */}
      <EditorCommonSections form={form} nodeId={node.id} nodeType={node.data.type} readOnly={readOnly} validationErrors={validationErrors} />
    </EditorBase>
  );
}
