/**
 * CrmActionSection Component
 *
 * Collapsible section for configuring inline CRM actions on any node.
 * Allows any node to trigger CRM stage updates as a side effect.
 * This is similar to tagAction - CRM updates happen when the node is executed.
 *
 * Features:
 * - Pipeline selection (auto-selects default if only one exists)
 * - Stage selection (dependent on selected pipeline)
 * - Optional notes for CRM activity log
 */

import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { TemplateProvider } from "@/shared/components/ui/template-context";
import { TemplateTextarea } from "@/shared/components/ui/template-textarea";
import { crmApi } from "@/shared/lib/api/crm";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import type { NodeEditorFormApi } from "../../forms/form-types";
import { useNodeEditorContext } from "../../hooks/use-node-editor-context";
import { sectionRegistry, type SectionDefinition } from "../../registry/section-registry";
import type { CrmActionFormValue } from "../../forms/node-form-builders";

// =============================================================================
// TYPES
// =============================================================================

interface CrmActionSectionProps {
  form: NodeEditorFormApi;
  nodeId: string;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CrmActionSection({ form, nodeId, readOnly = false }: CrmActionSectionProps) {
  const { nodes, edges, journeyUuid } = useNodeEditorContext();

  // Check initial state for default open
  const [open, setOpen] = useState(() => {
    const crmAction = form.getFieldValue("crmAction") as CrmActionFormValue | undefined;
    if (!crmAction) return false;
    return !!(crmAction.pipelineId || crmAction.stageId || crmAction.notes);
  });

  // Fetch pipelines
  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: () => crmApi.pipelines.getPipelines(),
  });

  // Find default pipeline
  const defaultPipeline = useMemo(() => {
    return pipelines.find((p) => p.isDefault) || pipelines[0];
  }, [pipelines]);

  return (
    <form.Field name="crmAction">
      {(field: { state: { value: CrmActionFormValue | undefined }; handleChange: (value: CrmActionFormValue | undefined) => void }) => {
        // Use form.getFieldValue as fallback when field.state.value is undefined
        const crmAction = field.state.value ?? (form.getFieldValue("crmAction") as CrmActionFormValue | undefined);
        const pipelineId = crmAction?.pipelineId;
        const stageId = crmAction?.stageId;
        const notes = crmAction?.notes;

        // Check if section has any configuration
        const hasConfig = !!(pipelineId || stageId || notes);

        // Helper to update crmAction field
        const updateCrmAction = (updates: Partial<CrmActionFormValue>) => {
          const current = crmAction || {};
          const updated = { ...current, ...updates };
          // Remove undefined values
          const cleaned: CrmActionFormValue = {};
          if (updated.pipelineId) cleaned.pipelineId = updated.pipelineId;
          if (updated.stageId) cleaned.stageId = updated.stageId;
          if (updated.notes) cleaned.notes = updated.notes;
          field.handleChange(Object.keys(cleaned).length > 0 ? cleaned : undefined);
        };

        // Clear stage when pipeline changes
        const handlePipelineChange = (value: string) => {
          if (value === "_none") {
            field.handleChange(undefined);
          } else {
            updateCrmAction({ pipelineId: value, stageId: undefined });
          }
        };

        const handleStageChange = (value: string) => {
          updateCrmAction({ stageId: value === "_default" ? undefined : value });
        };

        const handleNotesChange = (value: string) => {
          updateCrmAction({ notes: value || undefined });
        };

        // Fetch stages for selected pipeline
        const effectivePipelineId = pipelineId || defaultPipeline?.id;

        return (
          <CollapsibleSection
            icon={Users}
            label="CRM Action"
            open={open}
            onOpenChange={setOpen}
            badge={hasConfig ? "Configured" : undefined}
          >
            <CrmActionContent
              nodeId={nodeId}
              pipelineId={pipelineId}
              stageId={stageId}
              notes={notes}
              pipelines={pipelines}
              pipelinesLoading={pipelinesLoading}
              effectivePipelineId={effectivePipelineId}
              readOnly={readOnly}
              onPipelineChange={handlePipelineChange}
              onStageChange={handleStageChange}
              onNotesChange={handleNotesChange}
              nodes={nodes}
              edges={edges}
              journeyId={journeyUuid}
            />
          </CollapsibleSection>
        );
      }}
    </form.Field>
  );
}

// =============================================================================
// CONTENT COMPONENT (to handle stage query)
// =============================================================================

interface CrmActionContentProps {
  nodeId: string;
  pipelineId: string | undefined;
  stageId: string | undefined;
  notes: string | undefined;
  pipelines: Array<{ id: string; name: string; color?: string | null; isDefault?: boolean | null }>;
  pipelinesLoading: boolean;
  effectivePipelineId: string | undefined;
  readOnly: boolean;
  onPipelineChange: (value: string) => void;
  onStageChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  journeyId: string | null;
}

function CrmActionContent({
  nodeId,
  pipelineId,
  stageId,
  notes,
  pipelines,
  pipelinesLoading,
  effectivePipelineId,
  readOnly,
  onPipelineChange,
  onStageChange,
  onNotesChange,
  nodes,
  edges,
  journeyId,
}: CrmActionContentProps) {
  // Fetch stages for selected pipeline
  const { data: stages = [], isLoading: stagesLoading } = useQuery({
    queryKey: ["crm-stages", effectivePipelineId],
    queryFn: () => crmApi.stages.getStages(effectivePipelineId),
    enabled: !!effectivePipelineId,
  });

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        Update user's CRM position when this node is executed. Leave empty to skip CRM update.
      </p>

      {/* Pipeline Selection */}
      <div className="space-y-1.5">
        <Label htmlFor={`crmAction-pipeline-${nodeId}`} className="text-[11px] text-muted-foreground">
          Pipeline
        </Label>
        <Select value={pipelineId || "_none"} onValueChange={onPipelineChange} disabled={readOnly || pipelinesLoading}>
          <SelectTrigger size="sm" id={`crmAction-pipeline-${nodeId}`}>
            <SelectValue placeholder={pipelinesLoading ? "Loading..." : "Select pipeline"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">
              <span className="text-muted-foreground">No CRM action</span>
            </SelectItem>
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
      </div>

      {/* Stage Selection - only show when pipeline is selected */}
      {pipelineId && (
        <div className="space-y-1.5">
          <Label htmlFor={`crmAction-stage-${nodeId}`} className="text-[11px] text-muted-foreground">
            Stage <span className="font-normal">(optional)</span>
          </Label>
          <Select value={stageId || "_default"} onValueChange={onStageChange} disabled={readOnly || stagesLoading}>
            <SelectTrigger size="sm" id={`crmAction-stage-${nodeId}`}>
              <SelectValue placeholder={stagesLoading ? "Loading..." : "Select stage"} />
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

      {/* Notes - only show when pipeline is selected */}
      {pipelineId && (
        <div className="space-y-1.5">
          <Label htmlFor={`crmAction-notes-${nodeId}`} className="text-[11px] text-muted-foreground">
            Notes <span className="font-normal">(optional)</span>
          </Label>
          <TemplateProvider nodeId={nodeId} nodes={nodes} edges={edges} journeyId={journeyId}>
            <TemplateTextarea
              id={`crmAction-notes-${nodeId}`}
              value={notes || ""}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Reason for stage change..."
              className="min-h-[80px] resize-y text-xs"
              disabled={readOnly}
            />
          </TemplateProvider>
          <p className="text-[10px] text-muted-foreground">Recorded in CRM activity log. Type {"{{" } for variables.</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SECTION DEFINITION
// =============================================================================

export const crmActionSectionDefinition = {
  id: "crm-actions",
  label: "CRM Actions",
  component: CrmActionSection,
  scope: "common",
  shouldRender: (_node, caps) => caps.hasCrmAction === true,
  order: 30,
} as const satisfies SectionDefinition;

// Self-register on import
sectionRegistry.register(crmActionSectionDefinition);
