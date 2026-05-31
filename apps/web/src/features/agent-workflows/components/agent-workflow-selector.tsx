/**
 * Agent Workflow Selector
 *
 * Dropdown selector for switching between agent workflows and creating new ones.
 * Follows the same pattern as JourneySelector for consistency.
 *
 * @module features/agent-workflows/components/agent-workflow-selector
 */

import { useNavigate } from "@tanstack/react-router";
import { PlusCircle, Workflow } from "lucide-react";
import { useCallback, useState } from "react";

import { Select, SelectContent, SelectItem, SelectValue } from "@/shared/components/ui/select";
import { TruncatedSelectTrigger } from "@/shared/components/ui/truncated-select-trigger";
import { EntityStatusBadge } from "@/shared/components/ui/badges";
import { notify } from "@/shared/lib/ui/notify";
import { cn } from "@/shared/lib/utils";
import { useAgentWorkflows, useCreateAgentWorkflow } from "../hooks";
import { NewAgentWorkflowDialog } from "./new-agent-workflow-dialog";

// =============================================================================
// TYPES
// =============================================================================

interface AgentWorkflowSelectorProps {
  /** The key of the currently selected workflow */
  selectedWorkflowKey: string;
  /** Callback when a workflow is selected (receives key) */
  onWorkflowSelect: (workflowKey: string) => void;
  /** Optional class name */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CREATE_NEW_VALUE = "__create_new__";

// =============================================================================
// COMPONENT
// =============================================================================

export function AgentWorkflowSelector({ selectedWorkflowKey, onWorkflowSelect, className }: AgentWorkflowSelectorProps) {
  const navigate = useNavigate();
  const { data } = useAgentWorkflows();
  const createWorkflow = useCreateAgentWorkflow();
  const workflows = data?.workflows ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);

  // Find selected workflow
  const selectedWorkflow = workflows.find((w) => w.key === selectedWorkflowKey);

  const handleValueChange = useCallback(
    (value: string) => {
      if (value === CREATE_NEW_VALUE) {
        setDialogOpen(true);
      } else {
        onWorkflowSelect(value);
      }
    },
    [onWorkflowSelect]
  );

  const handleCreate = useCallback(
    async (values: { key: string; name: string; description?: string }) => {
      try {
        const result = await createWorkflow.mutateAsync({
          key: values.key,
          name: values.name,
          description: values.description,
        });
        setDialogOpen(false);
        notify.success("Workflow created");
        // Navigate to the new workflow
        navigate({ to: "/agents/$agentKey", params: { agentKey: result.key } });
      } catch {
        notify.error("Failed to create workflow");
      }
    },
    [createWorkflow, navigate]
  );

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <Select value={selectedWorkflowKey} onValueChange={handleValueChange}>
          <TruncatedSelectTrigger
            icon={<Workflow className="h-4 w-4" />}
            value={selectedWorkflow?.name}
            placeholder="Select Workflow"
            tooltipThreshold={30}
            ariaLabel="Select agent"
            className="w-[240px] h-9"
          >
            <SelectValue>
              <span className="font-medium text-sm truncate min-w-0 block">{selectedWorkflow?.name || "Select Workflow"}</span>
            </SelectValue>
          </TruncatedSelectTrigger>
          <SelectContent>
            {workflows.map((workflow) => (
              <SelectItem key={workflow.key} value={workflow.key}>
                <div className="flex items-center gap-2 w-full min-w-0">
                  <span className="font-medium flex-1 truncate min-w-0">{workflow.name}</span>
                  <EntityStatusBadge status={workflow.status} size="sm" className="shrink-0" entityType="workflow" />
                </div>
              </SelectItem>
            ))}
            <SelectItem key={CREATE_NEW_VALUE} value={CREATE_NEW_VALUE} className="text-primary">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">Create new workflow</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <NewAgentWorkflowDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={handleCreate} isLoading={createWorkflow.isPending} />
    </>
  );
}
