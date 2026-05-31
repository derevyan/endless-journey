/**
 * Import / Export Settings Section
 *
 * Import and export journey, workflow, and prompt configurations.
 * Uses tabs to organize different export types.
 *
 * @module components/settings/sections/import-export-section
 */

import { useQueryClient } from "@tanstack/react-query";
import { Archive, Download, FileJson, Loader2, MessageSquareText, Route as RouteIcon, Upload, Workflow } from "lucide-react";
import { useRef, useState } from "react";

import { notify } from "@/shared/lib/ui/notify";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useJourneyListManifest } from "@/hooks/queries";
import { journeysApi } from "@/shared/lib/api/journeys";
import { workflowsApi } from "@/shared/lib/api/workflows";
import { exportJourneyAsArchive, importJourneyFromArchive } from "@/features/journey/builder/lib/journey/journey-export";
import { exportWorkflowAsJson, importWorkflowFromJson } from "@/features/agent-workflows/lib/workflow-export";
import { exportPromptsAsArchive, importPromptsFromArchive } from "@/features/prompts/lib/prompt-export";
import { journeyKeys, agentWorkflowKeys, promptKeys } from "@/shared/lib/query-keys";
import { useAgentWorkflows } from "@/features/agent-workflows/hooks";

type ExportTab = "journeys" | "agents" | "prompts";

export function ImportExportSection() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ExportTab>("journeys");

  const { data: journeys, isLoading: journeysLoading } = useJourneyListManifest();
  const { data: workflowListData, isLoading: workflowsLoading } = useAgentWorkflows();
  const workflows = workflowListData?.workflows ?? [];

  // Journey export state
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  // Journey import state
  const [isImporting, setIsImporting] = useState(false);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workflow export state
  const [selectedWorkflowKey, setSelectedWorkflowKey] = useState<string>("");
  const [isExportingWorkflow, setIsExportingWorkflow] = useState(false);

  // Workflow import state
  const [isImportingWorkflow, setIsImportingWorkflow] = useState(false);
  const [workflowFile, setWorkflowFile] = useState<File | null>(null);
  const workflowFileInputRef = useRef<HTMLInputElement>(null);

  // Prompts export state
  const [isExportingPrompts, setIsExportingPrompts] = useState(false);

  // Prompts import state
  const [isImportingPrompts, setIsImportingPrompts] = useState(false);
  const [promptsFile, setPromptsFile] = useState<File | null>(null);
  const promptsFileInputRef = useRef<HTMLInputElement>(null);

  // =========================================================================
  // JOURNEY HANDLERS
  // =========================================================================

  const handleExport = async () => {
    if (!selectedJourneyId) return;

    setIsExporting(true);
    try {
      const journeyRecord = await journeysApi.getJourneyFullRecord(selectedJourneyId);
      await exportJourneyAsArchive(journeyRecord);
      notify.success("Journey exported successfully");
    } catch {
      notify.error("Failed to export journey");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".zip")) {
        notify.error("Please select a .zip file");
        return;
      }
      setArchiveFile(file);
    }
  };

  const handleImport = async () => {
    if (!archiveFile) return;

    setIsImporting(true);
    try {
      const result = await importJourneyFromArchive(archiveFile);

      if (result.success) {
        notify.success("Journey imported successfully");
        queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
        setArchiveFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        notify.error("Import failed", { description: result.error });
      }
    } catch {
      notify.error("Failed to import journey");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearFile = () => {
    setArchiveFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // =========================================================================
  // WORKFLOW HANDLERS
  // =========================================================================

  const handleWorkflowExport = async () => {
    if (!selectedWorkflowKey) return;

    setIsExportingWorkflow(true);
    try {
      const workflow = await workflowsApi.get(selectedWorkflowKey);
      if (workflow) {
        exportWorkflowAsJson(workflow);
        notify.success("Workflow exported successfully");
      } else {
        notify.error("Workflow not found");
      }
    } catch {
      notify.error("Failed to export workflow");
    } finally {
      setIsExportingWorkflow(false);
    }
  };

  const handleWorkflowFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".json")) {
        notify.error("Please select a .json file");
        return;
      }
      setWorkflowFile(file);
    }
  };

  const handleWorkflowImport = async () => {
    if (!workflowFile) return;

    setIsImportingWorkflow(true);
    try {
      const result = await importWorkflowFromJson(workflowFile);

      if (result.success) {
        notify.success("Workflow imported successfully");
        queryClient.invalidateQueries({ queryKey: agentWorkflowKeys.list() });
        setWorkflowFile(null);
        if (workflowFileInputRef.current) {
          workflowFileInputRef.current.value = "";
        }
      } else {
        notify.error("Import failed", { description: result.error });
      }
    } catch {
      notify.error("Failed to import workflow");
    } finally {
      setIsImportingWorkflow(false);
    }
  };

  const handleClearWorkflowFile = () => {
    setWorkflowFile(null);
    if (workflowFileInputRef.current) {
      workflowFileInputRef.current.value = "";
    }
  };

  // =========================================================================
  // PROMPTS HANDLERS
  // =========================================================================

  const handlePromptsExport = async () => {
    setIsExportingPrompts(true);
    try {
      const result = await exportPromptsAsArchive();
      if (result.success) {
        notify.success("Prompts exported successfully");
      } else {
        notify.error("Export failed", { description: result.error });
      }
    } catch {
      notify.error("Failed to export prompts");
    } finally {
      setIsExportingPrompts(false);
    }
  };

  const handlePromptsFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".zip")) {
        notify.error("Please select a .zip file");
        return;
      }
      setPromptsFile(file);
    }
  };

  const handlePromptsImport = async () => {
    if (!promptsFile) return;

    setIsImportingPrompts(true);
    try {
      const result = await importPromptsFromArchive(promptsFile);

      if (result.success) {
        const message =
          result.renamedCount > 0
            ? `${result.importedCount} prompts imported (${result.renamedCount} renamed)`
            : `${result.importedCount} prompts imported`;
        notify.success(message);
        queryClient.invalidateQueries({ queryKey: promptKeys.list() });
        setPromptsFile(null);
        if (promptsFileInputRef.current) {
          promptsFileInputRef.current.value = "";
        }
      } else {
        const errorMessage = result.errors.length > 0 ? result.errors[0] : "Import failed";
        notify.error("Import failed", { description: errorMessage });
      }
    } catch {
      notify.error("Failed to import prompts");
    } finally {
      setIsImportingPrompts(false);
    }
  };

  const handleClearPromptsFile = () => {
    setPromptsFile(null);
    if (promptsFileInputRef.current) {
      promptsFileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ExportTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="journeys" className="gap-2">
            <RouteIcon className="h-4 w-4" />
            Journeys
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-2">
            <Workflow className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-2">
            <MessageSquareText className="h-4 w-4" />
            Prompts
          </TabsTrigger>
        </TabsList>

        {/* Journeys Tab */}
        <TabsContent value="journeys" className="space-y-6 mt-6">
          {/* Export Journey */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Export Journey</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Download journey as a .zip archive containing structure and content files.
            </p>

            {journeysLoading ? (
              <p className="text-sm text-muted-foreground">Loading journeys...</p>
            ) : journeys && journeys.length > 0 ? (
              <div className="flex gap-3">
                <Select value={selectedJourneyId} onValueChange={setSelectedJourneyId}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select journey to export..." />
                  </SelectTrigger>
                  <SelectContent>
                    {journeys.map((journey) => (
                      <SelectItem key={journey.id} value={journey.id}>
                        {journey.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleExport} disabled={!selectedJourneyId || isExporting} variant="outline">
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
                  Download .zip
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No journeys available to export.</p>
            )}
          </div>

          {/* Import Journey */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Import Journey</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload a journey archive (.zip) to import. The archive will be validated before import.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="archive-file" className="text-sm">
                  Journey archive (.zip)
                </Label>
                <Input
                  id="archive-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  disabled={isImporting}
                  className="cursor-pointer"
                />
              </div>

              {archiveFile && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{archiveFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(archiveFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearFile} disabled={isImporting}>
                    Clear
                  </Button>
                </div>
              )}

              <Button onClick={handleImport} disabled={!archiveFile || isImporting}>
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Import Journey
              </Button>
            </div>
          </div>

          {/* Format Info */}
          <div className="rounded-lg border border-dashed p-4">
            <div className="flex items-center gap-2 mb-2">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Archive Format</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Journey archives are .zip files containing two JSON files:{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">journey.json</code> (structure) and{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">content.json</code> (text content). This split format is
              optimized for AI editing.
            </p>
          </div>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-6 mt-6">
          {/* Export Workflow */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Export Agent</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Download workflow configuration as a JSON file containing nodes, edges, and settings.
            </p>

            {workflowsLoading ? (
              <p className="text-sm text-muted-foreground">Loading workflows...</p>
            ) : workflows.length > 0 ? (
              <div className="flex gap-3">
                <Select value={selectedWorkflowKey} onValueChange={setSelectedWorkflowKey}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select workflow to export..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((workflow) => (
                      <SelectItem key={workflow.key} value={workflow.key}>
                        {workflow.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleWorkflowExport} disabled={!selectedWorkflowKey || isExportingWorkflow} variant="outline">
                  {isExportingWorkflow ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileJson className="h-4 w-4 mr-2" />
                  )}
                  Download .json
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No workflows available to export.</p>
            )}
          </div>

          {/* Import Workflow */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Import Agent</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload a workflow JSON file to import. The file will be validated before import.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="workflow-file" className="text-sm">
                  Workflow file (.json)
                </Label>
                <Input
                  id="workflow-file"
                  ref={workflowFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleWorkflowFileSelect}
                  disabled={isImportingWorkflow}
                  className="cursor-pointer"
                />
              </div>

              {workflowFile && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <FileJson className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{workflowFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(workflowFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearWorkflowFile} disabled={isImportingWorkflow}>
                    Clear
                  </Button>
                </div>
              )}

              <Button onClick={handleWorkflowImport} disabled={!workflowFile || isImportingWorkflow}>
                {isImportingWorkflow ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Import Workflow
              </Button>
            </div>
          </div>

          {/* Format Info */}
          <div className="rounded-lg border border-dashed p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileJson className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">JSON Format</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Workflow files are single JSON files containing name, description, configuration (nodes/edges), and settings (LLM
              defaults, execution settings).
            </p>
          </div>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-6 mt-6">
          {/* Export Prompts */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Export Prompts</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Download all prompts as a .zip archive containing each prompt with all its versions.
            </p>

            <Button onClick={handlePromptsExport} disabled={isExportingPrompts} variant="outline">
              {isExportingPrompts ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
              Export All Prompts
            </Button>
          </div>

          {/* Import Prompts */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Import Prompts</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload a prompts archive (.zip) to import. Prompts with existing names will be imported with an "-imported" suffix.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="prompts-file" className="text-sm">
                  Prompts archive (.zip)
                </Label>
                <Input
                  id="prompts-file"
                  ref={promptsFileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handlePromptsFileSelect}
                  disabled={isImportingPrompts}
                  className="cursor-pointer"
                />
              </div>

              {promptsFile && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{promptsFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(promptsFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearPromptsFile} disabled={isImportingPrompts}>
                    Clear
                  </Button>
                </div>
              )}

              <Button onClick={handlePromptsImport} disabled={!promptsFile || isImportingPrompts}>
                {isImportingPrompts ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Import Prompts
              </Button>
            </div>
          </div>

          {/* Format Info */}
          <div className="rounded-lg border border-dashed p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Archive Format</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Prompts archives are .zip files containing{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">manifest.json</code> (metadata) and a{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">prompts/</code> folder with each prompt as a separate JSON
              file including all versions.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
