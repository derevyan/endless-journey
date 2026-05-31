/**
 * Journey Pipelines Settings Section
 *
 * Manage default CRM pipeline assignments for journeys.
 *
 * @module components/settings/sections/journey-pipelines-section
 */

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Route, Workflow } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useCrmPipelines } from "@/features/crm/hooks/queries";
import { useJourneyListManifest } from "@/hooks/queries";
import { journeysApi } from "@/shared/lib/api/journeys";
import { notify } from "@/shared/lib/ui/notify";
import { journeyKeys } from "@/shared/lib/query-keys";

interface JourneyRowProps {
  journey: {
    id: string;
    name: string;
    status: string | null;
    defaultPipelineId: string | null;
  };
  pipelines: Array<{
    id: string;
    name: string;
    color: string | null;
    isDefault: boolean | null;
  }>;
}

function JourneyRow({ journey, pipelines }: JourneyRowProps) {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const currentPipeline = pipelines.find((p) => p.id === journey.defaultPipelineId);
  const orgDefaultPipeline = pipelines.find((p) => p.isDefault);
  
  // When no explicit pipeline is set, use org default pipeline ID for Select value
  const selectValue = journey.defaultPipelineId ?? orgDefaultPipeline?.id ?? "";

  const handlePipelineChange = async (value: string) => {
    // If journey has no explicit pipeline (null) and user selects org default, keep it as null
    const newPipelineId = 
      journey.defaultPipelineId === null && value === orgDefaultPipeline?.id 
        ? null 
        : value;
    
    if (newPipelineId === journey.defaultPipelineId) return;

    setIsUpdating(true);
    try {
      await journeysApi.updateJourney(journey.id, {
        defaultPipelineId: newPipelineId,
      });
      queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
      queryClient.invalidateQueries({ queryKey: journeyKeys.detail(journey.id) });
      notify.success("Pipeline assignment updated");
    } catch (error) {
      notify.error("Failed to update pipeline", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{journey.name}</span>
          <Badge
            variant={journey.status === "active" ? "default" : "secondary"}
            className={
              journey.status === "active"
                ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
            }
          >
            {journey.status || "draft"}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <Select
          value={selectValue}
          onValueChange={handlePipelineChange}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-[200px]">
            {isUpdating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating...</span>
              </div>
            ) : (
              <SelectValue>
                {currentPipeline ? (
                  <div className="flex items-center gap-2">
                    {currentPipeline.color && (
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: currentPipeline.color }}
                      />
                    )}
                    <span>{currentPipeline.name}</span>
                  </div>
                ) : orgDefaultPipeline ? (
                  <div className="flex items-center gap-2">
                    {orgDefaultPipeline.color && (
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: orgDefaultPipeline.color }}
                      />
                    )}
                    <span>{orgDefaultPipeline.name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select pipeline</span>
                )}
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent>
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
      </TableCell>
      <TableCell className="text-muted-foreground">
        {currentPipeline ? (
          <div className="flex items-center gap-2">
            {currentPipeline.color && (
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: currentPipeline.color }}
              />
            )}
            <span>{currentPipeline.name}</span>
          </div>
        ) : orgDefaultPipeline ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            {orgDefaultPipeline.color && (
              <div
                className="h-3 w-3 rounded-full opacity-50"
                style={{ backgroundColor: orgDefaultPipeline.color }}
              />
            )}
            <span className="italic">{orgDefaultPipeline.name} (org default)</span>
          </div>
        ) : (
          <span className="italic">No default set</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function JourneyPipelinesSection() {
  const { data: journeys, isLoading: journeysLoading } = useJourneyListManifest();
  const { data: pipelines = [], isLoading: pipelinesLoading } = useCrmPipelines();

  const isLoading = journeysLoading || pipelinesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!journeys || journeys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Route className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No journeys found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Create a journey first to configure its default CRM pipeline.
        </p>
      </div>
    );
  }

  const orgDefaultPipeline = pipelines.find((p) => p.isDefault);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Workflow className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Pipeline Resolution Order</p>
            <p className="text-xs text-muted-foreground">
              When a CRM node executes, the system determines which pipeline to use:
            </p>
            <ol className="text-xs text-muted-foreground list-decimal list-inside mt-2 space-y-1">
              <li><strong>CRM Node's pipeline</strong> — If the node specifies a pipeline, use it</li>
              <li><strong>Journey's default pipeline</strong> — Otherwise, use the journey's default (configured below)</li>
              <li><strong>Organization default</strong> — Finally, fall back to the org default{orgDefaultPipeline && ` (${orgDefaultPipeline.name})`}</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Journeys Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Journey</TableHead>
              <TableHead>Default Pipeline</TableHead>
              <TableHead>Resolved To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {journeys.map((journey) => (
              <JourneyRow
                key={journey.id}
                journey={{
                  id: journey.id,
                  name: journey.name,
                  status: journey.status ?? null,
                  defaultPipelineId: journey.defaultPipelineId ?? null,
                }}
                pipelines={pipelines}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer Note */}
      <p className="text-xs text-muted-foreground">
        You can also set the default pipeline when creating a new journey or from the journey settings dialog.
      </p>
    </div>
  );
}

