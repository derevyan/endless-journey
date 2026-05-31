import { useStore } from "@tanstack/react-store";
import { Loader2, Workflow } from "lucide-react";
import React, { useEffect } from "react";

import { useCrmPipelines } from "@/features/crm/hooks/queries";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { uiActions, uiStore } from "@/stores/ui-store";

/**
 * NewJourneyDialog - Self-managing dialog for creating new journeys.
 *
 * This dialog consumes uiStore directly for its state (open, name, description, pipelineId)
 * and only requires an onCreate callback from the parent (which needs crud.handleCreateJourney).
 *
 * @example
 * ```tsx
 * <NewJourneyDialog onCreate={handleCreateJourney} />
 * ```
 */
interface NewJourneyDialogProps {
  /** Callback when Create button is clicked (parent handles API call) */
  onCreate: () => void;
}

const NONE_VALUE = "__none__";

export function NewJourneyDialog({ onCreate }: NewJourneyDialogProps) {
  // Self-manage state from uiStore
  const {
    isNewJourneyDialogOpen,
    newJourneyName,
    newJourneyDescription,
    newJourneyDefaultPipelineId,
  } = useStore(uiStore);

  const { data: pipelines = [], isLoading: pipelinesLoading } = useCrmPipelines();

  // Auto-select single pipeline to avoid confusing user with dropdown
  const hasSinglePipeline = !pipelinesLoading && pipelines.length === 1;
  useEffect(() => {
    if (hasSinglePipeline && newJourneyDefaultPipelineId !== pipelines[0].id) {
      uiActions.setJourneyDefaultPipelineId(pipelines[0].id);
    }
  }, [hasSinglePipeline, pipelines, newJourneyDefaultPipelineId]);

  if (!isNewJourneyDialogOpen) return null;

  const handlePipelineChange = (value: string) => {
    uiActions.setJourneyDefaultPipelineId(value === NONE_VALUE ? null : value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl backdrop-blur">
        <h2 className="text-lg font-semibold text-foreground mb-4">Create a new journey</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-journey-name" className="text-sm text-muted-foreground">
              Name
            </Label>
            <input
              id="new-journey-name"
              className="w-full rounded-lg border border-border/70 bg-card/80 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={newJourneyName}
              onChange={(e) => uiActions.setJourneyName(e.target.value)}
              placeholder="My New Journey"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-journey-description" className="text-sm text-muted-foreground">
              Description
            </Label>
            <textarea
              id="new-journey-description"
              className="w-full rounded-lg border border-border/70 bg-card/80 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={newJourneyDescription}
              onChange={(e) => uiActions.setJourneyDescription(e.target.value)}
              placeholder="Short summary of this journey"
              rows={3}
            />
          </div>
          {/* Only show pipeline selector if there are multiple pipelines */}
          {!hasSinglePipeline && (
            <div className="space-y-2">
              <Label htmlFor="new-journey-pipeline" className="text-sm text-muted-foreground">
                Default CRM Pipeline
              </Label>
              <Select value={newJourneyDefaultPipelineId ?? NONE_VALUE} onValueChange={handlePipelineChange}>
                <SelectTrigger id="new-journey-pipeline" className="w-full">
                  {pipelinesLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading pipelines...</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Select a pipeline (optional)" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>
                    <div className="flex items-center gap-2">
                      <Workflow className="h-4 w-4 text-muted-foreground" />
                      <span>Organization default</span>
                    </div>
                  </SelectItem>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      <div className="flex items-center gap-2">
                        {pipeline.color && (
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: pipeline.color }}
                          />
                        )}
                        <span>{pipeline.name}</span>
                        {pipeline.isDefault && (
                          <span className="text-xs text-muted-foreground">(org default)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                CRM nodes in this journey will use this pipeline by default
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => uiActions.resetNewJourneyDialog()}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={onCreate}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              type="button"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
