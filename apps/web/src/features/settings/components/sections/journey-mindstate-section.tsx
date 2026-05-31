/**
 * Journey MindState Settings Section
 *
 * Manage mindstate tracking configuration for journeys.
 *
 * @module components/settings/sections/journey-mindstate-section
 */

import { createLogger, serializeError } from "@journey/logger";
import type { AnalysisMode, JourneyMindstateConfig, MindstateDefinition } from "@journey/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { Boxes, Loader2, Route } from "lucide-react";
import { useState } from "react";

import { useMindstateDefinitions } from "@/features/mindstate";
import { useJourneyListManifest } from "@/hooks/queries";
import { notify } from "@/shared/lib/ui/notify";
import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { MindstateKeysEditor } from "@/shared/components/mindstate-keys-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { journeysApi } from "@/shared/lib/api";
import { journeyKeys } from "@/shared/lib/query-keys";

const log = createLogger("journey-mindstate-section");

interface JourneyRowProps {
  journey: {
    id: string;
    name: string;
    status: string | null;
    mindstateConfig: JourneyMindstateConfig | null;
  };
  definitions: MindstateDefinition[];
}

function JourneyRow({ journey, definitions }: JourneyRowProps) {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const currentKeys = journey.mindstateConfig?.keys ?? [];
  const currentMode = journey.mindstateConfig?.analysisMode ?? "automatic";

  const handleAddKey = async (key: string) => {
    if (currentKeys.includes(key)) return;

    setIsUpdating(true);
    log.info({ journeyId: journey.id, key }, "mindstateSection:addKey:start");

    try {
      await journeysApi.updateJourney(journey.id, {
        mindstateConfig: {
          keys: [...currentKeys, key],
          analysisMode: currentMode,
        },
      });
      queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
      queryClient.invalidateQueries({ queryKey: journeyKeys.detail(journey.id) });
      log.info({ journeyId: journey.id, key }, "mindstateSection:addKey:success");
      notify.success("MindState added");
    } catch (error) {
      log.error({ err: serializeError(error), journeyId: journey.id, key }, "mindstateSection:addKey:failed");
      notify.error("Failed to update mindstate", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveKey = async (key: string) => {
    setIsUpdating(true);
    log.info({ journeyId: journey.id, key }, "mindstateSection:removeKey:start");

    try {
      const newKeys = currentKeys.filter((k) => k !== key);
      await journeysApi.updateJourney(journey.id, {
        mindstateConfig:
          newKeys.length > 0
            ? {
                keys: newKeys,
                analysisMode: currentMode,
              }
            : null,
      });
      queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
      queryClient.invalidateQueries({ queryKey: journeyKeys.detail(journey.id) });
      log.info({ journeyId: journey.id, key }, "mindstateSection:removeKey:success");
      notify.success("MindState removed");
    } catch (error) {
      log.error({ err: serializeError(error), journeyId: journey.id, key }, "mindstateSection:removeKey:failed");
      notify.error("Failed to update mindstate", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleModeChange = async (mode: AnalysisMode) => {
    if (mode === currentMode) return;

    setIsUpdating(true);
    log.info({ journeyId: journey.id, mode }, "mindstateSection:changeMode:start");

    try {
      // Preserve existing start condition and node type rules when changing mode
      const existingConfig = journey.mindstateConfig;
      await journeysApi.updateJourney(journey.id, {
        mindstateConfig: {
          keys: currentKeys,
          analysisMode: mode,
          startCondition: existingConfig?.startCondition,
          nodeTypeRules: existingConfig?.nodeTypeRules,
        },
      });
      queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
      queryClient.invalidateQueries({ queryKey: journeyKeys.detail(journey.id) });
      log.info({ journeyId: journey.id, mode }, "mindstateSection:changeMode:success");
      notify.success("Analysis mode updated");
    } catch (error) {
      log.error({ err: serializeError(error), journeyId: journey.id, mode }, "mindstateSection:changeMode:failed");
      notify.error("Failed to update mindstate", {
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
        <MindstateKeysEditor
          keys={currentKeys}
          availableDefinitions={definitions}
          onAdd={handleAddKey}
          onRemove={handleRemoveKey}
          isLoading={isUpdating}
          emptyText="None"
        />
      </TableCell>
      <TableCell>
        <Select
          value={currentKeys.length > 0 ? currentMode : ""}
          onValueChange={(v) => handleModeChange(v as AnalysisMode)}
          disabled={isUpdating || currentKeys.length === 0}
        >
          <SelectTrigger className="w-[140px]">
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : currentKeys.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="automatic">Automatic</SelectItem>
            <SelectItem value="selective">Selective</SelectItem>
            <SelectItem value="node-triggered">Node Triggered</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  );
}

export function JourneyMindstateSection() {
  const { data: journeys, isLoading: journeysLoading } = useJourneyListManifest();
  const { data: definitions = [], isLoading: definitionsLoading } = useMindstateDefinitions();

  const isLoading = journeysLoading || definitionsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!definitions || definitions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Boxes className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No mindstate definitions found</p>
        <p className="text-xs text-muted-foreground mt-1">Create mindstate definitions first to configure journey tracking.</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <a href="/mindstate">Go to MindState Builder</a>
        </Button>
      </div>
    );
  }

  if (!journeys || journeys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Route className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No journeys found</p>
        <p className="text-xs text-muted-foreground mt-1">Create a journey first to configure mindstate tracking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Boxes className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">MindState Tracking</p>
            <p className="text-xs text-muted-foreground">When enabled, the journey engine will analyze user messages to track psychological states:</p>
            <ul className="text-xs text-muted-foreground list-disc list-inside mt-2 space-y-1">
              <li>
                <strong>Automatic</strong> — Analyze on every user message
              </li>
              <li>
                <strong>Selective</strong> — Analyze based on node type rules
              </li>
              <li>
                <strong>Node Triggered</strong> — Only analyze when triggered by a node
              </li>
              <li>
                <strong>Manual</strong> — No automatic analysis, API-only
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Tracked states become available as variables:{" "}
              <code className="bg-muted px-1 rounded">
                mindstate.{"key"}.{"param"}
              </code>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Use Journey Settings dialog for advanced options (start conditions, node type rules).
            </p>
          </div>
        </div>
      </div>

      {/* Journeys Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Journey</TableHead>
              <TableHead>MindState</TableHead>
              <TableHead>Analysis Mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Sort journeys: those with mindstate configured appear first */}
            {[...journeys]
              .sort((a, b) => {
                const aHasMindstate = (a.mindstateConfig?.keys?.length ?? 0) > 0;
                const bHasMindstate = (b.mindstateConfig?.keys?.length ?? 0) > 0;
                if (aHasMindstate && !bHasMindstate) return -1;
                if (!aHasMindstate && bHasMindstate) return 1;
                return 0;
              })
              .map((journey) => (
                <JourneyRow
                  key={journey.id}
                  journey={{
                    id: journey.id,
                    name: journey.name,
                    status: journey.status ?? null,
                    mindstateConfig: journey.mindstateConfig ?? null,
                  }}
                  definitions={definitions}
                />
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer Note */}
      <p className="text-xs text-muted-foreground">You can also configure mindstate tracking from the journey settings dialog in the editor.</p>
    </div>
  );
}
