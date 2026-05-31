/**
 * MindState Builder Layout
 *
 * Three-panel layout for the mindstate builder.
 * - Left: Sidebar with agents and parameters
 * - Center: Chat preview
 * - Right: State dashboard
 */

import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";

import { createLogger, serializeError } from "@journey/logger";

import { AppLayout, AppLayoutInset, AppLayoutSidebar } from "@/shared/components/layout/app-layout-primitives";
import { PanelSurface } from "@/shared/components/ui/panel-surface";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { journeysApi } from "@/shared/lib/api/journeys";
import { notify } from "@/shared/lib/ui/notify";

import type { MindstateStatus } from "@journey/schemas";

import { mindstateHeaderActions } from "@/features/dashboard/store/mindstate-header-store";
import { useCreateDefinition, useUpdateDefinition } from "@/features/mindstate/hooks/mutations/use-mindstate-mutations";
import { builderActions, builderSelectors, builderStore } from "@/features/mindstate/stores/builder-store";
import { mindstateVersionActions, mindstateSaveManagerActions } from "@/features/mindstate/stores";

import { MindstateVersionHistoryPanel } from "../version-history-panel";
import { AgentModal } from "../modals/agent-modal";
import { ParameterModal } from "../modals/parameter-modal";
import { SettingsModal } from "../modals/settings-modal";
import { BuilderDashboard } from "./builder-dashboard";
import { BuilderPreview } from "./builder-preview";
import { BuilderSidebar } from "./builder-sidebar";

const log = createLogger("mindstate:builder");

interface BuilderLayoutProps {
  /** Comma-separated journey IDs to connect after first save */
  journeyIdsToConnect?: string;
}

export function BuilderLayout({ journeyIdsToConnect }: BuilderLayoutProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  // Sidebar width is now responsive via CSS custom properties in AppLayout
  const sidePanelClassName = "h-full min-h-0 flex flex-col overflow-hidden rounded-none";

  // Mutations
  const createDefinition = useCreateDefinition();
  const updateDefinition = useUpdateDefinition();

  // Store state
  const definition = useStore(builderStore, builderSelectors.definition);
  const definitionKey = definition?.key ?? null;
  const definitionCreatedAt = definition?.createdAt ?? null;

  // Modal state
  const isAgentModalOpen = useStore(builderStore, (s) => s.ui.isAgentModalOpen);
  const isParameterModalOpen = useStore(builderStore, (s) => s.ui.isParameterModalOpen);
  const isSettingsOpen = useStore(builderStore, (s) => s.ui.isSettingsOpen);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        builderActions.undo();
      } else if (modifier && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        builderActions.redo();
      } else if (modifier && e.key === "y") {
        // Alternative redo shortcut (Ctrl+Y)
        e.preventDefault();
        builderActions.redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSave = useCallback(async (options: { notes?: string }) => {
    const currentDefinition = builderStore.state.definition;
    if (!currentDefinition) return;

    builderActions.setSaving(true);
    try {
      const isNew = !currentDefinition.createdAt;

      if (isNew) {
        // Create new definition using mutation hook
        await createDefinition.mutateAsync({
          key: currentDefinition.key,
          name: currentDefinition.name,
          description: currentDefinition.description,
          mainAgentConfig: currentDefinition.mainAgentConfig,
          defaultAgents: currentDefinition.defaultAgents,
          defaultParameters: currentDefinition.defaultParameters,
          analysisMode: currentDefinition.analysisMode,
          categories: currentDefinition.categories,
        });

        // Connect to journeys if specified
        if (journeyIdsToConnect) {
          const journeyIds = journeyIdsToConnect.split(",").filter(Boolean);
          for (const journeyId of journeyIds) {
            try {
              // Get current journey config to preserve existing mindstate keys
              const journeyList = await journeysApi.getJourneys();
              const journey = journeyList.find((j) => j.id === journeyId);
              const existingKeys = journey?.mindstateConfig?.keys ?? [];
              const existingMode = journey?.mindstateConfig?.analysisMode ?? "automatic";

              // Add new key if not already present
              if (!existingKeys.includes(currentDefinition.key)) {
                await journeysApi.updateJourney(journeyId, {
                  mindstateConfig: {
                    keys: [...existingKeys, currentDefinition.key],
                    analysisMode: existingMode,
                  },
                });
              }
            } catch (error) {
              // Log but don't fail the whole operation
              log.error({ journeyId, err: serializeError(error) }, "builder:connectJourney:failed");
            }
          }
          // Show special message only if connected to journeys
          if (journeyIds.length > 0) {
            notify.success(`Connected to ${journeyIds.length} journey(s)`);
          }
        }

        // Navigate to the actual definition URL (not /new)
        navigate({
          to: "/mindstate/$definitionKey",
          params: { definitionKey: currentDefinition.key },
          replace: true,
        });
      } else {
        // Use atomic save manager for existing definitions with optional notes
        await mindstateSaveManagerActions.saveVersion(options.notes);
      }
    } catch (error) {
      log.error({ definitionKey: currentDefinition.key, err: serializeError(error) }, "builder:save:failed");
    } finally {
      builderActions.setSaving(false);
    }
  }, [journeyIdsToConnect, navigate, createDefinition]);

  const handleDefinitionSelect = useCallback(
    (definitionKey: string) => {
      navigate({ to: "/mindstate/$definitionKey", params: { definitionKey } });
    },
    [navigate]
  );

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Handle status change from header controls
  const handleStatusChange = useCallback(
    async (status: MindstateStatus) => {
      if (!definition?.key) return;
      try {
        await updateDefinition.mutateAsync({ key: definition.key, input: { status } });
        // Sync builder store to prevent stale status on subsequent saves
        builderActions.setDefinition({ ...definition, status });
        notify.success(`Status changed to ${status}`);
      } catch {
        notify.error("Failed to change status");
      }
    },
    [definition, updateDefinition]
  );

  useEffect(() => {
    if (!definitionKey) {
      mindstateHeaderActions.clearControls();
      return;
    }

    const headerDefinitionKey = definitionCreatedAt ? definitionKey : "new";

    mindstateHeaderActions.setControls({
      definitionKey: headerDefinitionKey,
      onDefinitionSelect: handleDefinitionSelect,
      definitionStatus: definition?.status ?? "draft",
      onStatusChange: handleStatusChange,
      onSave: () => handleSave({}),
      onDiscard: builderActions.resetDefinition,
      onUndo: builderActions.undo,
      onRedo: builderActions.redo,
      onClearPreview: builderActions.resetPreview,
      onSettings: builderActions.openSettings,
      onHistory: () => setShowHistory(true),
      sidebarOpen,
      onToggleSidebar: handleToggleSidebar,
    });

    return () => {
      mindstateHeaderActions.clearControls();
    };
  }, [definitionCreatedAt, definitionKey, definition?.status, handleDefinitionSelect, handleSave, handleStatusChange, sidebarOpen, handleToggleSidebar]);

  // Initialize version store when definition loads
  useEffect(() => {
    if (!definition?.id) {
      mindstateVersionActions.reset();
      return;
    }

    mindstateVersionActions.setDefinitionId(definition.id);
    mindstateVersionActions.setDefinitionKey(definition.key);
    mindstateVersionActions.loadVersions(definition.id);

    return () => {
      mindstateVersionActions.reset();
    };
  }, [definition?.id, definition?.key]);

  if (!definition) {
    return null;
  }

  return (
    <AppLayout
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      className="
        [--sidebar-width:14rem]
        lg:[--sidebar-width:16rem]
        xl:[--sidebar-width:18rem]
        2xl:[--sidebar-width:20rem]
      "
    >
      <AppLayoutInset>
        {/* Main Content */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left Sidebar - Responsive width */}
          <PanelSurface
            className={`
              shrink-0 ${sidePanelClassName}
              w-[14rem]
              lg:w-[16rem]
              xl:w-[18rem]
              2xl:w-[20rem]
            `}
          >
            <ScrollArea className="flex-1 min-h-0 h-full">
              <BuilderSidebar />
            </ScrollArea>
          </PanelSurface>

          {/* Center Preview - Flexible */}
          <div className="flex-1 min-w-0 h-full bg-background relative">
            <BuilderPreview />
            <AgentModal open={isAgentModalOpen} onOpenChange={(open) => !open && builderActions.closeAgentModal()} />
            <ParameterModal open={isParameterModalOpen} onOpenChange={(open) => !open && builderActions.closeParameterModal()} />
          </div>
        </div>
      </AppLayoutInset>

      {/* Right Dashboard */}
      <AppLayoutSidebar side="right" collapsible="offcanvas">
        <PanelSurface className={sidePanelClassName}>
          <BuilderDashboard />
        </PanelSurface>
      </AppLayoutSidebar>

      {/* Modals */}
      <SettingsModal open={isSettingsOpen} onOpenChange={(open) => !open && builderActions.closeSettings()} />

      {/* Version History Panel */}
      {showHistory && <MindstateVersionHistoryPanel onClose={() => setShowHistory(false)} />}
    </AppLayout>
  );
}
