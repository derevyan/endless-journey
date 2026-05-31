/**
 * Console Panel Container
 *
 * Resizable panel wrapper for the tabbed console (Events, State, Outputs).
 * Syncs visibility state with uiStore.showConsole.
 *
 * @module features/simulator/components/console/console-panel-container
 */

import type { InteractionEvent } from "@journey/schemas";
import { useStore } from "@tanstack/react-store";
import { Database, List, Settings2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

import { ErrorBoundary } from "@/shared/components/common/error-boundary";
import { ResizableHandle, ResizablePanel } from "@/shared/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { uiActions, uiStore } from "@/stores/ui-store";

import { simulatorActions, simulatorStore } from "../../store";
import { EventLogPanel } from "./event-log-panel";
import { NodeOutputsPanel } from "./node-outputs-panel";
import { StateInspectorPanel } from "./state-inspector-panel";

type ConsoleTab = "events" | "state" | "outputs";

interface ConsolePanelContainerProps {
  events: InteractionEvent[];
}

/**
 * Self-managing Console Panel Container.
 * Reads showConsole from uiStore, syncs panel state with store.
 */
export function ConsolePanelContainer({ events }: ConsolePanelContainerProps) {
  const showConsole = useStore(uiStore, (s) => s.showConsole);
  const session = useStore(simulatorStore, (s) => s.session);
  const mode = useStore(simulatorStore, (s) => s.mode);
  const consolePanelRef = useRef<ImperativePanelHandle>(null);
  const [activeTab, setActiveTab] = useState<ConsoleTab>("events");

  // State and Outputs tabs only available in playback mode (impersonate)
  const showAdvancedTabs = mode === "playback";

  // Reset active tab when advanced tabs become hidden
  // Note: activeTab intentionally excluded from deps - we only want this to run when mode changes
  useEffect(() => {
    if (!showAdvancedTabs && (activeTab === "state" || activeTab === "outputs")) {
      setActiveTab("events");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdvancedTabs]);

  // Sync panel with store state
  useEffect(() => {
    const panel = consolePanelRef.current;
    if (!panel) return;

    if (showConsole && panel.isCollapsed()) {
      panel.expand();
    } else if (!showConsole && !panel.isCollapsed()) {
      panel.collapse();
    }
  }, [showConsole]);

  const handleCollapse = useCallback(() => {
    uiActions.setShowConsole(false);
  }, []);

  const handleExpand = useCallback(() => {
    uiActions.setShowConsole(true);
  }, []);

  return (
    <>
      <ResizableHandle />
      <ResizablePanel
        ref={consolePanelRef}
        defaultSize={15}
        minSize={15}
        maxSize={50}
        collapsible
        collapsedSize={0}
        onCollapse={handleCollapse}
        onExpand={handleExpand}
      >
        <ErrorBoundary variant="panel" panelName="Console">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ConsoleTab)}
            className="flex flex-col h-full"
          >
            {/* Only show tab bar when there are multiple tabs (playback mode) */}
            {showAdvancedTabs && (
              <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/30 shrink-0">
                <TabsList className="h-7 p-0.5">
                  <TabsTrigger value="events" className="h-6 px-2 text-xs gap-1">
                    <List className="h-3 w-3" />
                    Events
                  </TabsTrigger>
                  <TabsTrigger value="state" className="h-6 px-2 text-xs gap-1">
                    <Settings2 className="h-3 w-3" />
                    State
                  </TabsTrigger>
                  <TabsTrigger value="outputs" className="h-6 px-2 text-xs gap-1">
                    <Database className="h-3 w-3" />
                    Outputs
                  </TabsTrigger>
                </TabsList>
              </div>
            )}

            <TabsContent value="events" className="flex-1 min-h-0 mt-0">
              <EventLogPanel
                events={events}
                onClear={() => simulatorActions.clearEventLog()}
                className="h-full"
              />
            </TabsContent>

            {showAdvancedTabs && (
              <>
                <TabsContent value="state" className="flex-1 min-h-0 mt-0">
                  <StateInspectorPanel events={events} />
                </TabsContent>

                <TabsContent value="outputs" className="flex-1 min-h-0 mt-0">
                  <NodeOutputsPanel session={session} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </ErrorBoundary>
      </ResizablePanel>
    </>
  );
}
