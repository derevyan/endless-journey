/**
 * TeleportNodeEditor Component
 *
 * Editor for Teleport node type:
 * - Name
 * - Target journey selector (cascading)
 * - Target node selector (loads after journey selected)
 * - Preserve context toggle
 * - Common sections (tags, variables, metadata)
 */

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { apiClient } from "@/shared/lib/api";
import { useJourneyListManifest } from "@/hooks/queries";
import { useNodeEditorForm } from "../../hooks/use-node-editor-form";
import type { StringFieldApi, BooleanFieldApi } from "../../forms/form-types";
import { versionStore } from "@/stores/version-store";
import { useStore } from "@tanstack/react-store";

import { EditorBase } from "../../editors/editor-base";
import { EditorNameField, getErrorMessage } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import type { NodeEditorProps } from "../../editors/types";

export function TeleportNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);
  const journeyUuid = useStore(versionStore, (state) => state.journeyUuid);
  const startNodeValue = "__start__";

  // Get list of all journeys
  const { data: journeys = [], isLoading: journeysLoading } = useJourneyListManifest();

  // Filter out current journey
  const availableJourneys = journeys.filter((j) => j.id !== journeyUuid);

  // Get selected target journey ID
  const targetJourneyId = form.getFieldValue("targetJourneyId") as string | undefined;

  // Load target journey config when selected (for node list)
  const { data: targetJourneyConfig, isLoading: nodesLoading } = useQuery({
    queryKey: ["journey", targetJourneyId, "config"],
    queryFn: () => apiClient.getJourneyById(targetJourneyId!),
    enabled: !!targetJourneyId,
  });

  // Get nodes from target journey (exclude start node as it's auto-included)
  const targetNodes = targetJourneyConfig?.nodes || [];

  // Cancel handler: reset form (does not close editor)
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  return (
    <EditorBase
      title={readOnly ? "Teleport Node Info" : "Edit Teleport Node"}
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

      {/* 2. Target Journey */}
      <form.Field name="targetJourneyId">
        {(field: StringFieldApi) => {
          const selectedJourney = availableJourneys.find((j) => j.id === field.state.value);

          return (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Target Journey</Label>
              <Select
                value={field.state.value || ""}
                onValueChange={(value) => {
                  field.handleChange(value);
                  // Clear target node when journey changes
                  form.setFieldValue("targetNodeId", undefined);
                }}
                disabled={readOnly || journeysLoading}
              >
                <SelectTrigger size="sm" id="targetJourneyId" hasError={field.state.meta.errors?.length > 0}>
                  <SelectValue placeholder={journeysLoading ? "Loading..." : "Select target journey"}>
                    {selectedJourney?.name || (journeysLoading ? "Loading..." : "Select target journey")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableJourneys.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No other journeys available
                    </div>
                  ) : (
                    availableJourneys.map((journey) => (
                      <SelectItem key={journey.id} value={journey.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{journey.name}</span>
                          {journey.description && (
                            <span className="text-[10px] text-muted-foreground line-clamp-1">
                              {journey.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {field.state.meta.errors?.length > 0 && (
                <p className="text-xs text-destructive">{getErrorMessage(field.state.meta.errors[0])}</p>
              )}
            </div>
          );
        }}
      </form.Field>

      {/* 3. Target Node (shown after journey selected) */}
      {targetJourneyId && (
        <form.Field name="targetNodeId">
          {(field: StringFieldApi) => {
            const selectedNode = targetNodes.find((n) => n.id === field.state.value);
            const currentValue = field.state.value ?? startNodeValue;

            return (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Target Node</Label>
                <p className="text-[10px] text-muted-foreground">
                  Leave empty to start from the beginning (start node)
                </p>
                <Select
                  value={currentValue}
                  onValueChange={(value) =>
                    (field.handleChange as (v: string | undefined) => void)(
                      value === startNodeValue ? undefined : value
                    )
                  }
                  disabled={readOnly || nodesLoading}
                >
                  <SelectTrigger size="sm" id="targetNodeId">
                    <SelectValue placeholder={nodesLoading ? "Loading nodes..." : "Start from beginning"}>
                      {selectedNode?.data?.label || (nodesLoading ? "Loading..." : "Start from beginning")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={startNodeValue}>
                      <span className="text-muted-foreground">Start from beginning</span>
                    </SelectItem>
                    {targetNodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {node.data?.type}
                          </span>
                          <span>{node.data?.label || node.id}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }}
        </form.Field>
      )}

      {/* 4. Preserve Context Toggle */}
      <form.Field name="preserveContext">
        {(field: BooleanFieldApi) => (
          <div className="flex items-center justify-between gap-2 py-2">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium">Preserve Context</Label>
              <p className="text-[10px] text-muted-foreground">
                Carry over user data to the target journey
              </p>
            </div>
            <Switch
              checked={field.state.value !== false}
              onCheckedChange={(checked) => field.handleChange(checked)}
              disabled={readOnly}
            />
          </div>
        )}
      </form.Field>

      {/* 5. Common Sections (Tags, Variables, Metadata, Advanced) */}
      <EditorCommonSections form={form} nodeId={node.id} nodeType={node.data.type} readOnly={readOnly} validationErrors={validationErrors} />
    </EditorBase>
  );
}
