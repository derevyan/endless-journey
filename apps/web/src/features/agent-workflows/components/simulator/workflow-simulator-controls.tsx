/**
 * Workflow Simulator Controls
 *
 * Header bar for the workflow test sidebar.
 * Shows mode-appropriate UI and controls.
 *
 * @module features/agent-workflows/components/simulator/workflow-simulator-controls
 */

import { useStore } from "@tanstack/react-store";
import { RotateCcw, Terminal } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { agentWorkflowStore, agentWorkflowActions } from "../../stores/agent-workflow-store";
import { agentTestActions, agentTestStore } from "../../stores/agent-test-store";

/**
 * WorkflowSimulatorControls - Header bar for workflow test sidebar
 *
 * Shows:
 * - In edit mode: "Switch to Simulator mode" message
 * - In simulator mode: Title, reset button, console toggle
 */
export function WorkflowSimulatorControls() {
  const mode = useStore(agentWorkflowStore, (s) => s.mode);
  const isSimulatorMode = mode === "simulator";

  const { showConsole, testState } = useStore(agentTestStore, (s) => ({
    showConsole: s.showConsole,
    testState: s.testState,
  }));

  const handleReset = () => {
    agentTestActions.reset();
    agentTestActions.clearConsoleEvents();
    agentWorkflowActions.clearSimulatorVisitedNodes();
  };

  const handleToggleConsole = () => {
    agentTestActions.toggleConsole();
  };

  // Edit mode - show hint
  if (!isSimulatorMode) {
    return (
      <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
        <div className="flex-1 text-sm text-muted-foreground">Switch to Simulator mode to test your workflow</div>
      </div>
    );
  }

  // Simulator mode controls
  return (
    <TooltipProvider>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
        {/* Title */}
        <div className="flex-1 text-sm font-medium flex items-center gap-1.5">
          Workflow Test
          {testState === "sending" && <span className="ml-2 text-muted-foreground text-xs">(Running...)</span>}
        </div>

        {/* Console Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleToggleConsole} className={cn("h-7 w-7", showConsole && "bg-accent")}>
              <Terminal className="h-3.5 w-3.5" />
              <span className="sr-only">Toggle Console</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{showConsole ? "Hide Console" : "Show Console"}</TooltipContent>
        </Tooltip>

        {/* Reset Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleReset} className="h-7 w-7">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="sr-only">Reset</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset conversation</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
