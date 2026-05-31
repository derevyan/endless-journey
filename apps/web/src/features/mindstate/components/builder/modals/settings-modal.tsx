/**
 * Settings Modal
 *
 * Dialog for managing categories and import/export functionality.
 * Uses SettingsDialog pattern for consistent styling with app settings.
 */

import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CircleDot, Download, FileJson, Loader2, Plus, RotateCcw, Route, Tags, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { useJourneyListManifest } from "@/hooks/queries";
import { notify } from "@/shared/lib/ui/notify";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Separator } from "@/shared/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { SettingsContent, SettingsDialog, SettingsSection, type SettingsNavItem } from "@/shared/components/ui/settings-dialog";
import { EntityStatusBadge } from "@/shared/components/ui/badges";
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("mindstate:settings");

import { useStore } from "@tanstack/react-store";
import { AnalysisModeSchema } from "@journey/schemas";
import type { MindstateStatus } from "@journey/schemas";
import { mindstateDefinitionsApi } from "../../../lib";
import { DEFAULT_CATEGORIES, DEFAULT_MAIN_AGENT, DEFAULT_PARAMETERS, DEFAULT_SYSTEM_AGENTS } from "../../../lib/defaults";
import { builderActions, builderSelectors, builderStore } from "../../../stores/builder-store";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NAV_ITEMS: SettingsNavItem[] = [
  { id: "general", name: "General", icon: CircleDot },
  { id: "categories", name: "Categories", icon: Tags },
  { id: "data", name: "Data Management", icon: FileJson },
  { id: "danger", name: "Danger Zone", icon: AlertTriangle },
];

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const navigate = useNavigate();
  const categories = useStore(builderStore, builderSelectors.categories);
  const definition = useStore(builderStore, builderSelectors.definition);

  // Fetch journeys to check connections
  const { data: journeys = [] } = useJourneyListManifest();

  const [activeItem, setActiveItem] = useState("general");
  const [newCategory, setNewCategory] = useState("");
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Find journeys connected to this mindstate definition
  const connectedJourneys = definition ? journeys.filter((j) => j.mindstateConfig?.keys?.includes(definition.key)) : [];

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      builderActions.addCategory(newCategory.trim());
      setNewCategory("");
    }
  };

  const handleExport = () => {
    if (!definition) return;

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      definition: {
        key: definition.key,
        name: definition.name,
        description: definition.description,
        mainAgentConfig: definition.mainAgentConfig,
        defaultAgents: definition.defaultAgents,
        defaultParameters: definition.defaultParameters,
        analysisMode: definition.analysisMode,
        categories: definition.categories,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindstate-${definition.key}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    notify.success("Configuration exported successfully");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        let data;

        // Parse JSON
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Invalid JSON file");
        }

        // Validate structure
        if (!data.definition) {
          throw new Error("Invalid configuration file: missing 'definition' field");
        }

        // Create validation schema for the imported definition
        const importDefinitionSchema = z.object({
          key: z.string().optional(),
          name: z.string().optional(),
          description: z.string().optional(),
          mainAgentConfig: z.any().optional(),
          defaultAgents: z.array(z.any()).optional(),
          defaultParameters: z.array(z.any()).optional(),
          analysisMode: z.string().optional(),
          categories: z.array(z.string()).optional(),
        });

        // Validate the definition structure
        const validatedDef = importDefinitionSchema.parse(data.definition);

        // Merge imported data with current definition
        if (definition) {
          const analysisModeResult = AnalysisModeSchema.safeParse(validatedDef.analysisMode);
          const analysisMode = analysisModeResult.success ? analysisModeResult.data : definition.analysisMode;

          builderActions.setDefinition({
            ...definition,
            mainAgentConfig: validatedDef.mainAgentConfig || definition.mainAgentConfig,
            defaultAgents: validatedDef.defaultAgents || definition.defaultAgents,
            defaultParameters: validatedDef.defaultParameters || definition.defaultParameters,
            analysisMode,
            categories: validatedDef.categories || definition.categories,
          });
        }

        notify.success("Configuration imported successfully");
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
          log.error({ err: serializeError(error), issues }, "settings:import:validation:failed");
          notify.error("Invalid configuration file", {
            description: `Validation error: ${issues}`,
          });
        } else if (error instanceof SyntaxError) {
          log.error({ err: serializeError(error) }, "settings:import:json:failed");
          notify.error("Invalid JSON file");
        } else {
          log.error({ err: serializeError(error) }, "settings:import:failed");
          notify.error("Failed to import configuration", {
            description: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    };
    input.click();
  };

  const handleResetToDefaults = () => {
    if (!definition) return;

    builderActions.setDefinition({
      ...definition,
      mainAgentConfig: DEFAULT_MAIN_AGENT,
      defaultAgents: DEFAULT_SYSTEM_AGENTS,
      defaultParameters: DEFAULT_PARAMETERS,
      categories: [...DEFAULT_CATEGORIES],
    });

    setConfirmResetOpen(false);
    notify.success("Reset to defaults successfully");
  };

  const handleDelete = async () => {
    if (!definition || !definition.createdAt) {
      // Can't delete unsaved definition
      notify.error("Cannot delete unsaved definition");
      return;
    }

    setIsDeleting(true);
    try {
      await mindstateDefinitionsApi.delete(definition.key);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      // SSE handles the "deleted" toast notification
      navigate({ to: "/mindstate" });
    } catch (error) {
      log.error({ definitionKey: definition.key, err: serializeError(error) }, "settings:delete:failed");
      notify.error("Failed to delete definition");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <SettingsDialog
        open={open}
        onOpenChange={onOpenChange}
        title="MindState Settings"
        description="Manage categories, import/export configurations"
        navItems={NAV_ITEMS}
        activeItem={activeItem}
        onItemChange={setActiveItem}
      >
        {/* General Section */}
        <SettingsContent id="general">
          <SettingsSection title="Status" description="Control the visibility and availability of this mindstate definition.">
            <div className="space-y-2 max-w-sm">
              <Select
                value={definition?.status ?? "draft"}
                onValueChange={(value) => {
                  if (definition) {
                    builderActions.setDefinition({ ...definition, status: value as MindstateStatus });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    <EntityStatusBadge status={definition?.status ?? "draft"} entityType="mindstate" />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">
                    <div className="flex items-center gap-2">
                      <EntityStatusBadge status="draft" entityType="mindstate" />
                      <span className="text-xs text-muted-foreground">Work in progress</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <EntityStatusBadge status="active" entityType="mindstate" />
                      <span className="text-xs text-muted-foreground">Ready for production</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="archived">
                    <div className="flex items-center gap-2">
                      <EntityStatusBadge status="archived" entityType="mindstate" />
                      <span className="text-xs text-muted-foreground">No longer in use</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls whether this definition is available for use in journeys.
              </p>
            </div>
          </SettingsSection>
        </SettingsContent>

        {/* Categories Section */}
        <SettingsContent id="categories">
          <SettingsSection title="State Categories" description="Categories help organize state parameters into logical groups.">
            <div className="flex gap-2 mb-4">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name..."
                className="max-w-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <Button onClick={handleAddCategory} disabled={!newCategory.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {categories.map((cat) => (
                <div key={cat} className="flex items-center justify-between p-1.5 rounded-md border bg-card hover:bg-accent/50 transition-colors group">
                  <div className="flex items-center gap-2">
                    <Tags className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{cat}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => builderActions.removeCategory(cat)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </SettingsSection>
        </SettingsContent>

        {/* Data Management Section */}
        <SettingsContent id="data">
          <SettingsSection title="Configuration Management" description="Import or export your MindState configuration.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </CardTitle>
                  <CardDescription>Save current configuration to a JSON file.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={handleExport} className="w-full">
                    Export Configuration
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Import
                  </CardTitle>
                  <CardDescription>Load configuration from a JSON file.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={handleImport} className="w-full">
                    Import Configuration
                  </Button>
                </CardContent>
              </Card>
            </div>
          </SettingsSection>
        </SettingsContent>

        {/* Danger Zone Section */}
        <SettingsContent id="danger">
          <div className="grid gap-6">
            <SettingsSection title="Reset Configuration" description="Reset agents, parameters, and categories to default values.">
              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-destructive flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Reset to Defaults
                  </CardTitle>
                  <CardDescription>This will replace all agents, parameters, and categories with default values. Your saved data will be lost.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="destructive" onClick={() => setConfirmResetOpen(true)}>
                    Reset to Defaults
                  </Button>
                </CardContent>
              </Card>
            </SettingsSection>

            <Separator />

            <SettingsSection title="Delete Definition" description="Permanently remove this mindstate definition.">
              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-destructive flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete MindState Definition
                  </CardTitle>
                  <CardDescription>
                    This will permanently delete this mindstate definition and all its configuration.
                    {connectedJourneys.length > 0 && (
                      <span className="block mt-2 text-destructive font-medium">
                        Warning: {connectedJourneys.length} journey{connectedJourneys.length > 1 ? "s are" : " is"} currently using this definition.
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {connectedJourneys.length > 0 && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                      <p className="text-sm font-medium text-destructive mb-2">Connected Journeys:</p>
                      <div className="space-y-1">
                        {connectedJourneys.map((journey) => (
                          <div key={journey.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Route className="w-3 h-3" />
                            <span>{journey.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={!definition?.createdAt}>
                    {!definition?.createdAt ? "Save First to Delete" : "Delete Definition"}
                  </Button>
                </CardContent>
              </Card>
            </SettingsSection>
          </div>
        </SettingsContent>
      </SettingsDialog>

      {/* Confirm Reset Dialog */}
      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Reset to Defaults?
            </DialogTitle>
            <DialogDescription>This will replace all agents, parameters, and categories with their default values. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setConfirmResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetToDefaults}>
              Yes, Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete MindState Definition?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will permanently delete <strong>{definition?.name}</strong> and all its configuration.
                </p>
                {connectedJourneys.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                    <p className="text-sm font-medium text-destructive mb-2">
                      The following {connectedJourneys.length} journey{connectedJourneys.length > 1 ? "s" : ""} will lose this mindstate tracking:
                    </p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {connectedJourneys.map((journey) => (
                        <div key={journey.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Route className="w-3 h-3 shrink-0" />
                          <span className="truncate">{journey.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-destructive font-medium">This action cannot be undone.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Yes, Delete Definition"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
