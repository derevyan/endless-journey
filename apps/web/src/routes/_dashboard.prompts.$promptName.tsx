/**
 * Prompt Editor Route
 *
 * Full-screen editor with narrow left sidebar.
 * Sidebar: versions (70%) + config (30%).
 * Main area: full-size editor with scroll.
 *
 * @module routes/_dashboard.prompts.$promptName
 */

import { createLogger, serializeError } from "@journey/logger";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, RotateCcw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import { PromptConfigPanel, PromptContentEditor, PromptLabelPopover, PromptTypeBadge, PromptVersionSidebar } from "@/features/prompts/components";
import { useCreatePromptVersion, usePrompt, usePromptVariables, usePromptVersion, usePromptVersions, useUpdatePrompt, useUpdatePromptLabels } from "@/features/prompts/hooks";
import { SaveVersionDialog } from "@/shared/components/save-version-dialog";
import { LabelBadge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { notify } from "@/shared/lib/ui/notify";
import type { PromptContent, PromptVersionResponse } from "@journey/schemas";

// =============================================================================
// ROUTE DEFINITION
// =============================================================================

const searchSchema = z.object({
  version: z.string().optional(),
});

export const Route = createFileRoute("/_dashboard/prompts/$promptName")({
  component: PromptEditorPage,
  validateSearch: searchSchema,
});

const log = createLogger("prompt-editor");

// =============================================================================
// COMPONENT
// =============================================================================

function PromptEditorPage() {
  const { promptName } = Route.useParams();
  const { version: selectedVersionId } = Route.useSearch();
  const navigate = useNavigate();

  // Data fetching
  const { data: prompt, isLoading: isLoadingPrompt } = usePrompt(promptName);
  const { data: versions = [], isLoading: isLoadingVersions } = usePromptVersions(promptName);
  const { data: selectedVersion, isLoading: isLoadingSelectedVersion } = usePromptVersion(promptName, selectedVersionId);
  const { data: variablesData } = usePromptVariables(promptName, {
    versionId: selectedVersionId,
  });

  // Mutations
  const createVersion = useCreatePromptVersion();
  const updateLabels = useUpdatePromptLabels();
  const updatePrompt = useUpdatePrompt();

  // Local state for editing
  const [editedContent, setEditedContent] = useState<PromptContent | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const selectedVersionFromList = selectedVersionId
    ? versions.find((version) => version.versionId === selectedVersionId)
    : undefined;
  // Current version to display (selected or latest)
  const currentVersion = selectedVersionFromList ?? selectedVersion ?? (versions.length > 0 ? versions[0] : null);
  const isLoadingVersion = Boolean(selectedVersionId) && !selectedVersionFromList && isLoadingSelectedVersion;

  // Sync edited content when version changes
  useEffect(() => {
    if (currentVersion) {
      setEditedContent(currentVersion.content);
      setIsDirty(false);
    }
  }, [currentVersion]);

  // Handle content changes
  const handleContentChange = useCallback((content: PromptContent) => {
    setEditedContent(content);
    setIsDirty(true);
  }, []);

  // Handle version selection
  const handleSelectVersion = useCallback(
    (versionId: string) => {
      navigate({
        to: "/prompts/$promptName",
        params: { promptName },
        search: { version: versionId },
      });
    },
    [navigate, promptName]
  );

  // Save new version
  const handleSaveVersion = useCallback(
    async (options: { notes?: string; setProduction?: boolean; customLabels?: string[] }) => {
      if (!editedContent || !prompt) return;

      try {
        const result = await createVersion.mutateAsync({
          promptName,
          input: {
            content: editedContent,
            notes: options.notes || undefined,
          },
        });

        // Build labels array from production flag and custom labels
        const labels: string[] = [];
        if (options.setProduction) labels.push("production");
        if (options.customLabels?.length) labels.push(...options.customLabels);

        // Set labels if any were specified
        if (labels.length > 0 && result.versionId) {
          await updateLabels.mutateAsync({
            promptName,
            versionId: result.versionId,
            input: { labels },
          });
        }

        setIsDirty(false);
        notify.success("New version saved");

        // Navigate to show the new version (it will be latest)
        navigate({
          to: "/prompts/$promptName",
          params: { promptName },
          search: {},
        });
      } catch (error) {
        log.error({ promptName, err: serializeError(error) }, "promptEditor:saveVersion:error");
        notify.error("Failed to save version");
      }
    },
    [editedContent, prompt, promptName, createVersion, updateLabels, navigate]
  );

  // Discard changes
  const handleDiscardChanges = useCallback(() => {
    if (currentVersion) {
      setEditedContent(currentVersion.content);
      setIsDirty(false);
    }
  }, [currentVersion]);

  // Update labels
  const handleUpdateLabels = useCallback(
    async (version: PromptVersionResponse, labels: string[]) => {
      await updateLabels.mutateAsync({
        promptName,
        versionId: version.versionId,
        input: { labels },
      });
    },
    [promptName, updateLabels]
  );

  // Update prompt tags
  const handleUpdateTags = useCallback(
    async (tags: string[]) => {
      await updatePrompt.mutateAsync({
        name: promptName,
        input: { tags },
      });
    },
    [promptName, updatePrompt]
  );

  // Loading state
  if (isLoadingPrompt) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not found
  if (!prompt) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Prompt not found</p>
        <Button asChild variant="outline">
          <Link to="/prompts">Back to Prompts</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b bg-background/50 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="size-8 rounded-sm">
            <Link to="/prompts">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight">{prompt.name}</h1>
              <PromptTypeBadge type={prompt.type} />
            </div>
            {prompt.description && <p className="text-xs text-muted-foreground/70">{prompt.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDirty && (
            <Button variant="ghost" size="sm" onClick={handleDiscardChanges} className="h-8 text-xs font-medium">
              <RotateCcw className="mr-1.5 size-3.5" />
              Discard
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
            disabled={!isDirty || createVersion.isPending}
            className="h-8 bg-primary/95 text-xs font-bold shadow-sm transition-all hover:bg-primary"
          >
            {createVersion.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}
            Save Version
          </Button>
        </div>
      </header>

      {/* Main Content - Narrow sidebar + Full editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - split vertically */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r bg-muted/5">
          {/* Versions Section - takes remaining space */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <PromptVersionSidebar
              versions={versions}
              selectedVersionId={currentVersion?.versionId}
              onSelectVersion={handleSelectVersion}
              isLoading={isLoadingVersions}
            />
          </div>

          {/* Config Section - auto height, scrolls if needed */}
          <div className="max-h-[40%] shrink-0 overflow-y-auto border-t bg-background/30 backdrop-blur-sm">
            <PromptConfigPanel
              prompt={prompt}
              versions={versions}
              variables={variablesData?.variables ?? []}
              paths={variablesData?.paths ?? []}
              onUpdateTags={handleUpdateTags}
            />
          </div>
        </div>

        {/* Main Editor Area - Full size with scroll */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Version Info Bar - same style as sidebar headers */}
          {currentVersion && (
            <div className="flex shrink-0 items-center justify-between border-b bg-background/30 px-4 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold tracking-tight text-muted-foreground">VERSION</span>
                <span className="text-sm font-mono font-bold text-primary">{currentVersion.versionId}</span>
                <div className="flex gap-1.5">
                  {currentVersion.labels.map((label) => (
                    <LabelBadge key={label} label={label} size="sm" />
                  ))}
                </div>
              </div>
              <PromptLabelPopover
                versionId={currentVersion.versionId}
                currentLabels={currentVersion.labels}
                onUpdateLabels={(labels) => handleUpdateLabels(currentVersion, labels)}
              />
            </div>
          )}

          {/* Editor Content - Full size, no scroll on container */}
          <div className="flex min-h-0 flex-1 flex-col">
            {isLoadingVersion ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : editedContent ? (
              <PromptContentEditor type={prompt.type} content={editedContent} onChange={handleContentChange} className="flex-1" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <p>No content to display</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Save Version Dialog */}
      <SaveVersionDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveVersion}
        showProductionToggle
      />
    </div>
  );
}
