/**
 * Journey Settings Dialog
 *
 * Dialog for editing journey properties: name, description, default CRM pipeline, and mindstate config.
 *
 * This dialog is self-managing - it consumes uiStore for open state and useJourneyData
 * for journey information. Only requires an onSaved callback from the parent.
 *
 * @example
 * ```tsx
 * <JourneySettingsDialog onSaved={handleSettingsSaved} />
 * ```
 *
 * @module components/journey/journey-settings-dialog
 */

import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { createLogger, serializeError } from "@journey/logger";
import type { AnalysisMode, AnalysisStartCondition, AnalyzableNodeType, JourneyStatus, NodeTypeRules } from "@journey/schemas";
import { Boxes, Loader2, Route, Settings, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCrmPipelines } from "@/features/crm/hooks/queries";
import { journeyHeaderStore } from "@/features/dashboard/store/journey-header-store";
import { useJourneyData } from "@/features/journey/builder/hooks/queries/use-journey-data";
import { useMindstateDefinitions } from "@/features/mindstate";
import { notify } from "@/shared/lib/ui/notify";
import { EntityStatusBadge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DeleteConfirmDialog } from "@/shared/components/ui/delete-confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { MindstateKeysEditor } from "@/shared/components/mindstate-keys-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Separator } from "@/shared/components/ui/separator";
import { Textarea } from "@/shared/components/ui/textarea";
import { journeysApi } from "@/shared/lib/api";
import { journeyKeys } from "@/shared/lib/query-keys";
import { uiActions, uiStore } from "@/stores/ui-store";

// Node types available for analysis rules
const ANALYZABLE_NODE_TYPES: { value: AnalyzableNodeType; label: string }[] = [
  { value: "MESSAGE", label: "Message" },
  { value: "CONDITION", label: "Condition" },
  { value: "WAIT", label: "Wait" },
  { value: "WEBHOOK", label: "Webhook" },
  { value: "CRM", label: "CRM" },
  { value: "TELEPORT", label: "Teleport" },
];

// Default node type rules
const DEFAULT_ANALYZE_TYPES: AnalyzableNodeType[] = ["MESSAGE", "CONDITION"];
const log = createLogger("journey-settings-dialog");

interface JourneySettingsDialogProps {
  /** Callback when settings are saved successfully */
  onSaved?: () => void;
}

export function JourneySettingsDialog({ onSaved }: JourneySettingsDialogProps) {
  // Self-manage dialog open state from uiStore
  const { journeySettingsDialogOpen } = useStore(uiStore);

  // Get delete journey callback from journeyHeaderStore
  const { onDeleteJourney, canDeleteJourney } = useStore(journeyHeaderStore);

  // Get journey data directly via hook
  const journeyData = useJourneyData();
  const selectedJourney = journeyData.selectedJourneyMeta;

  // Extract initial values from selected journey
  const initialName = selectedJourney?.name ?? "";
  const initialDescription = selectedJourney?.description;
  const initialStatus = selectedJourney?.status ?? "draft";
  const initialPipelineId = selectedJourney?.defaultPipelineId ?? null;
  const initialMindstateConfig = selectedJourney?.mindstateConfig ?? null;
  const initialTransferAllowlist = useMemo(() => selectedJourney?.transferAllowlist ?? [], [selectedJourney?.transferAllowlist]);
  const journeyId = selectedJourney?.id ?? "";

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [status, setStatus] = useState<JourneyStatus>(initialStatus);
  const [pipelineId, setPipelineId] = useState<string | null>(initialPipelineId ?? null);
  const [mindstateKeys, setMindstateKeys] = useState<string[]>(initialMindstateConfig?.keys ?? []);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(initialMindstateConfig?.analysisMode ?? "automatic");
  const [startCondition, setStartCondition] = useState<AnalysisStartCondition | undefined>(initialMindstateConfig?.startCondition);
  const [startMessageCount, setStartMessageCount] = useState<number>(
    initialMindstateConfig?.startCondition?.type === "after_messages" ? initialMindstateConfig.startCondition.count : 3
  );
  const [startNodeId, setStartNodeId] = useState<string>(
    initialMindstateConfig?.startCondition?.type === "after_node" ? initialMindstateConfig.startCondition.nodeId : ""
  );
  const [analyzeTypes, setAnalyzeTypes] = useState<AnalyzableNodeType[]>(
    initialMindstateConfig?.nodeTypeRules?.analyzeTypes ?? DEFAULT_ANALYZE_TYPES
  );
  const [transferAllowlist, setTransferAllowlist] = useState<string[]>(initialTransferAllowlist);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: pipelines = [], isLoading: pipelinesLoading } = useCrmPipelines();
  const { data: mindstateDefinitions = [] } = useMindstateDefinitions();

  // Fetch all journeys for the transfer allowlist selector
  const { data: allJourneys = [] } = useQuery({
    queryKey: journeyKeys.list(),
    queryFn: () => journeysApi.getJourneys(),
    select: (data) => data.filter((j) => j.status === "active" && j.id !== journeyId),
  });

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (journeySettingsDialogOpen && selectedJourney) {
      setName(selectedJourney.name ?? "");
      setDescription(selectedJourney.description ?? "");
      setStatus(selectedJourney.status ?? "draft");
      setPipelineId(selectedJourney.defaultPipelineId ?? null);
      setMindstateKeys(selectedJourney.mindstateConfig?.keys ?? []);
      setAnalysisMode(selectedJourney.mindstateConfig?.analysisMode ?? "automatic");
      setStartCondition(selectedJourney.mindstateConfig?.startCondition);
      setStartMessageCount(
        selectedJourney.mindstateConfig?.startCondition?.type === "after_messages"
          ? selectedJourney.mindstateConfig.startCondition.count
          : 3
      );
      setStartNodeId(
        selectedJourney.mindstateConfig?.startCondition?.type === "after_node"
          ? selectedJourney.mindstateConfig.startCondition.nodeId
          : ""
      );
      setAnalyzeTypes(selectedJourney.mindstateConfig?.nodeTypeRules?.analyzeTypes ?? DEFAULT_ANALYZE_TYPES);
      setTransferAllowlist(selectedJourney.transferAllowlist ?? []);
    }
  }, [journeySettingsDialogOpen, selectedJourney]);

  const handleAddMindstateKey = (key: string) => {
    if (!mindstateKeys.includes(key)) {
      setMindstateKeys((prev) => [...prev, key]);
    }
  };

  const handleRemoveMindstateKey = (key: string) => {
    setMindstateKeys((prev) => prev.filter((k) => k !== key));
  };

  // Build the start condition based on current selection
  const buildStartCondition = (): AnalysisStartCondition | undefined => {
    if (!startCondition) return undefined;

    switch (startCondition.type) {
      case "immediate":
        return { type: "immediate" };
      case "after_messages":
        return { type: "after_messages", count: startMessageCount };
      case "after_node":
        return startNodeId ? { type: "after_node", nodeId: startNodeId } : undefined;
      default:
        return undefined;
    }
  };

  // Build node type rules for selective mode
  const buildNodeTypeRules = (): NodeTypeRules | undefined => {
    if (analysisMode !== "selective") return undefined;

    // Calculate skip types as the inverse of analyze types
    const skipTypes = ANALYZABLE_NODE_TYPES.map((t) => t.value).filter(
      (type) => !analyzeTypes.includes(type)
    ) as AnalyzableNodeType[];

    return {
      analyzeTypes,
      skipTypes,
    };
  };

  const handleSave = async () => {
    if (!name.trim()) {
      notify.error("Journey name is required");
      return;
    }

    setIsSaving(true);
    log.info({ journeyId }, "journeySettings:save:start");

    try {
      const builtStartCondition = buildStartCondition();
      const builtNodeTypeRules = buildNodeTypeRules();

      await journeysApi.updateJourney(journeyId, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        defaultPipelineId: pipelineId,
        mindstateConfig:
          mindstateKeys.length > 0
            ? {
                keys: mindstateKeys,
                analysisMode,
                startCondition: builtStartCondition,
                nodeTypeRules: builtNodeTypeRules,
              }
            : null,
        transferAllowlist: transferAllowlist.length > 0 ? transferAllowlist : null,
      });
      log.info({ journeyId, mindstateKeys, analysisMode, startCondition: builtStartCondition }, "journeySettings:save:success");
      notify.success("Journey settings saved");
      onSaved?.();
      uiActions.closeJourneySettings();
    } catch (error) {
      log.error({ err: serializeError(error), journeyId }, "journeySettings:save:failed");
      notify.error("Failed to save journey settings", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Compare arrays for mindstate keys change (without mutating)
  const keysChanged = useMemo(() => {
    const sorted1 = [...mindstateKeys].sort();
    const sorted2 = [...(initialMindstateConfig?.keys ?? [])].sort();
    return JSON.stringify(sorted1) !== JSON.stringify(sorted2);
  }, [mindstateKeys, initialMindstateConfig?.keys]);

  const modeChanged = analysisMode !== (initialMindstateConfig?.analysisMode ?? "automatic");

  const startConditionChanged = useMemo(() => {
    const initial = initialMindstateConfig?.startCondition;
    if (!startCondition && !initial) return false;
    if (!startCondition || !initial) return true;
    if (startCondition.type !== initial.type) return true;
    if (startCondition.type === "after_messages" && initial.type === "after_messages") {
      return startMessageCount !== initial.count;
    }
    if (startCondition.type === "after_node" && initial.type === "after_node") {
      return startNodeId !== initial.nodeId;
    }
    return false;
  }, [startCondition, startMessageCount, startNodeId, initialMindstateConfig?.startCondition]);

  const nodeTypeRulesChanged = useMemo(() => {
    const initial = initialMindstateConfig?.nodeTypeRules?.analyzeTypes ?? DEFAULT_ANALYZE_TYPES;
    const sorted1 = [...analyzeTypes].sort();
    const sorted2 = [...initial].sort();
    return JSON.stringify(sorted1) !== JSON.stringify(sorted2);
  }, [analyzeTypes, initialMindstateConfig?.nodeTypeRules?.analyzeTypes]);

  const transferAllowlistChanged = useMemo(() => {
    const sorted1 = [...transferAllowlist].sort();
    const sorted2 = [...initialTransferAllowlist].sort();
    return JSON.stringify(sorted1) !== JSON.stringify(sorted2);
  }, [transferAllowlist, initialTransferAllowlist]);

  const hasChanges =
    name !== initialName ||
    description !== (initialDescription ?? "") ||
    status !== initialStatus ||
    pipelineId !== (initialPipelineId ?? null) ||
    keysChanged ||
    modeChanged ||
    startConditionChanged ||
    (analysisMode === "selective" && nodeTypeRulesChanged) ||
    transferAllowlistChanged;

  // Only return null for missing journey data, NOT for closed state
  // Dialog must stay mounted for Radix to animate the close transition
  if (!selectedJourney) return null;

  return (
    <>
    <Dialog open={journeySettingsDialogOpen} onOpenChange={(open) => !open && uiActions.closeJourneySettings()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Journey Settings
          </DialogTitle>
          <DialogDescription>Edit journey properties and default CRM pipeline.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="journey-name">Name</Label>
            <Input id="journey-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Journey name" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="journey-description">Description</Label>
            <Textarea
              id="journey-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of this journey"
              rows={3}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="journey-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as JourneyStatus)}>
              <SelectTrigger id="journey-status">
                <SelectValue>
                  <EntityStatusBadge status={status} entityType="journey" />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">
                  <div className="flex items-center gap-2">
                    <EntityStatusBadge status="draft" entityType="journey" />
                    <span className="text-xs text-muted-foreground">Work in progress</span>
                  </div>
                </SelectItem>
                <SelectItem value="active">
                  <div className="flex items-center gap-2">
                    <EntityStatusBadge status="active" entityType="journey" />
                    <span className="text-xs text-muted-foreground">Live and running</span>
                  </div>
                </SelectItem>
                <SelectItem value="archived">
                  <div className="flex items-center gap-2">
                    <EntityStatusBadge status="archived" entityType="journey" />
                    <span className="text-xs text-muted-foreground">No longer active</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls whether this journey can accept new sessions.
            </p>
          </div>

          {/* Default Pipeline */}
          <div className="space-y-2">
            <Label htmlFor="journey-pipeline">Default CRM Pipeline</Label>
            <Select value={pipelineId ?? ""} onValueChange={(value) => setPipelineId(value || null)}>
              <SelectTrigger id="journey-pipeline">
                {pipelinesLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading pipelines...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="Select a pipeline" />
                )}
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    <div className="flex items-center gap-2">
                      {pipeline.color && <div className="h-3 w-3 rounded-full" style={{ backgroundColor: pipeline.color }} />}
                      <span>{pipeline.name}</span>
                      {pipeline.isDefault && <span className="text-xs text-muted-foreground">(default)</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">CRM nodes in this journey will use this pipeline by default when not explicitly set.</p>
          </div>

          {/* Transfer Permissions */}
          {allJourneys.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4 text-muted-foreground" />
                  <Label>Transfer Permissions</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select which journeys AI agents can transfer users to from this journey.
                  No selections = transfers blocked (secure by default).
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                  {allJourneys.map((journey) => (
                    <div key={journey.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`journey-${journey.id}`}
                        checked={transferAllowlist.includes(journey.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTransferAllowlist((prev) => [...prev, journey.id]);
                          } else {
                            setTransferAllowlist((prev) => prev.filter((id) => id !== journey.id));
                          }
                        }}
                        disabled={isSaving}
                      />
                      <Label
                        htmlFor={`journey-${journey.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {journey.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* MindState Tracking */}
          {mindstateDefinitions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                  <Label>MindState Tracking</Label>
                </div>

                {/* Tracked States */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tracked States</Label>
                  <MindstateKeysEditor
                    keys={mindstateKeys}
                    availableDefinitions={mindstateDefinitions}
                    onAdd={handleAddMindstateKey}
                    onRemove={handleRemoveMindstateKey}
                    disabled={isSaving}
                  />
                </div>

                {/* Analysis Mode */}
                {mindstateKeys.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Analysis Mode</Label>
                      <Select value={analysisMode} onValueChange={(v) => setAnalysisMode(v as AnalysisMode)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="automatic">Automatic</SelectItem>
                          <SelectItem value="selective">Selective</SelectItem>
                          <SelectItem value="node-triggered">Node Triggered</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {analysisMode === "automatic" && "Analyze on every user message."}
                        {analysisMode === "selective" && "Analyze based on node type rules."}
                        {analysisMode === "node-triggered" && "Only analyze when triggered by a node."}
                        {analysisMode === "manual" && "No automatic analysis, API-only."}
                      </p>
                    </div>

                    {/* Node Type Rules (for selective mode) */}
                    {analysisMode === "selective" && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Analyze at Node Types</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {ANALYZABLE_NODE_TYPES.map((nodeType) => (
                            <div key={nodeType.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`node-type-${nodeType.value}`}
                                checked={analyzeTypes.includes(nodeType.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setAnalyzeTypes((prev) => [...prev, nodeType.value]);
                                  } else {
                                    setAnalyzeTypes((prev) => prev.filter((t) => t !== nodeType.value));
                                  }
                                }}
                                disabled={isSaving}
                              />
                              <Label
                                htmlFor={`node-type-${nodeType.value}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {nodeType.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Start Condition */}
                    {(analysisMode === "automatic" || analysisMode === "selective") && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Start Analysis</Label>
                        <Select
                          value={startCondition?.type ?? "immediate"}
                          onValueChange={(v) => {
                            if (v === "immediate") {
                              setStartCondition({ type: "immediate" });
                            } else if (v === "after_messages") {
                              setStartCondition({ type: "after_messages", count: startMessageCount });
                            } else if (v === "after_node") {
                              setStartCondition({ type: "after_node", nodeId: startNodeId });
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">Immediate</SelectItem>
                            <SelectItem value="after_messages">After N Messages</SelectItem>
                            <SelectItem value="after_node">After Reaching Node</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* After N Messages input */}
                        {startCondition?.type === "after_messages" && (
                          <div className="flex items-center gap-2">
                            <Label className="text-sm whitespace-nowrap">Start after</Label>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={startMessageCount}
                              onChange={(e) => setStartMessageCount(Number(e.target.value) || 1)}
                              className="w-20"
                              disabled={isSaving}
                            />
                            <Label className="text-sm">messages</Label>
                          </div>
                        )}

                        {/* After Node input */}
                        {startCondition?.type === "after_node" && (
                          <div className="flex items-center gap-2">
                            <Label className="text-sm whitespace-nowrap">Node ID:</Label>
                            <Input
                              type="text"
                              value={startNodeId}
                              onChange={(e) => setStartNodeId(e.target.value)}
                              placeholder="Enter node ID"
                              className="flex-1"
                              disabled={isSaving}
                            />
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          {(!startCondition || startCondition.type === "immediate") && "Start analyzing from the first message."}
                          {startCondition?.type === "after_messages" && `Wait for ${startMessageCount} message(s) before starting analysis.`}
                          {startCondition?.type === "after_node" && "Start analyzing after the user reaches the specified node (inclusive)."}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Danger Zone - Delete Journey */}
          {canDeleteJourney && onDeleteJourney && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <Label className="text-destructive">Danger Zone</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Permanently delete this journey. This action cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isSaving}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Journey
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => uiActions.closeJourneySettings()} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <DeleteConfirmDialog
      open={showDeleteDialog}
      onOpenChange={setShowDeleteDialog}
      onConfirm={() => {
        uiActions.setPendingChanges(false); // Clear pending changes to prevent unsaved dialog
        onDeleteJourney?.();
        setShowDeleteDialog(false);
        uiActions.closeJourneySettings();
      }}
      title={`Delete "${name}"`}
      description="This will permanently delete the journey and all its configuration. This action cannot be undone."
      confirmText="Delete Journey"
    />
    </>
  );
}
