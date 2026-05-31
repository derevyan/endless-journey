/**
 * Agent Workflow Layout
 *
 * Main layout component for the agent workflow builder.
 * Provides the same layout structure as the journey builder:
 * - Main canvas area (left)
 * - Right sidebar with chat and console panels
 *
 * The sidebar auto-opens when entering simulator mode and closes when exiting.
 *
 * @module features/agent-workflows/components/layout/agent-workflow-layout
 */

import { useStore } from "@tanstack/react-store";

import { ErrorBoundary } from "@/shared/components/common/error-boundary";
import { AppLayout, AppLayoutInset, AppLayoutSidebar } from "@/shared/components/layout/app-layout-primitives";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/components/ui/resizable";

import { agentTestStore } from "../../stores/agent-test-store";
import { WorkflowConsolePanel } from "../console/workflow-console-panel";
import { WorkflowSimulatorControls } from "../simulator/workflow-simulator-controls";
import { WorkflowChatPanel } from "../test-panel/workflow-chat-panel";

interface AgentWorkflowLayoutProps {
  /** Main canvas content */
  children: React.ReactNode;
  /** Whether the sidebar is open */
  sidebarOpen: boolean;
  /** Callback to toggle sidebar */
  onToggleSidebar: () => void;
}

/**
 * AgentWorkflowLayout - Layout wrapper for agent workflow builder
 *
 * Provides the same structure as the journey builder:
 * - AppLayout wraps the entire page with sidebar context
 * - AppLayoutInset contains the main canvas
 * - AppLayoutSidebar contains chat and console panels
 */
export function AgentWorkflowLayout({ children, sidebarOpen, onToggleSidebar }: AgentWorkflowLayoutProps) {
  const showConsole = useStore(agentTestStore, (s) => s.showConsole);

  return (
    <AppLayout open={sidebarOpen} onOpenChange={onToggleSidebar}>
      {/* Main Content Area */}
      <AppLayoutInset>{children}</AppLayoutInset>

      {/* Right Sidebar - Chat & Console */}
      <AppLayoutSidebar side="right" collapsible="offcanvas" className="w-96">
        <div className="flex h-full flex-col" data-testid="agent-test-panel">
          {/* Simulator Controls Header */}
          <WorkflowSimulatorControls />

          {/* Chat & Console Panels */}
          <ResizablePanelGroup direction="vertical" className="flex-1">
            {/* Chat Panel */}
            <ResizablePanel defaultSize={85} minSize={30}>
              <ErrorBoundary variant="panel" panelName="Chat">
                <WorkflowChatPanel />
              </ErrorBoundary>
            </ResizablePanel>

            {/* Handle */}
            <ResizableHandle />

            {/* Console Panel - Collapsible */}
            <ResizablePanel
              defaultSize={15}
              minSize={10}
              maxSize={50}
              collapsible
              collapsedSize={0}
              onCollapse={() => {
                // Sync collapsed state with store
                if (showConsole) {
                  // Don't update store here - let the panel handle its own state
                }
              }}
            >
              <ErrorBoundary variant="panel" panelName="Console">
                <WorkflowConsolePanel />
              </ErrorBoundary>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </AppLayoutSidebar>
    </AppLayout>
  );
}
