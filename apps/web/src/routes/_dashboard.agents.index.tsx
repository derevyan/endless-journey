/**
 * Agents List Route
 *
 * Lists all agents for the organization.
 *
 * @module routes/_dashboard.agents.index
 */

import { useQueryClient } from "@tanstack/react-query";
import type { WorkflowStatus } from "@journey/schemas";
import { llmConfig } from "@journey/schemas";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bot, Circle, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { NewAgentWorkflowDialog } from "@/features/agent-workflows/components/new-agent-workflow-dialog";
import { useAgentWorkflows, useCreateAgentWorkflow, useDeleteAgentWorkflow, useUpdateAgentWorkflow } from "@/features/agent-workflows/hooks";
import { DashboardItemCard } from "@/features/dashboard/components/dashboard-item-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { EntityStatusBadge } from "@/shared/components/ui/badges";
import { agentWorkflowKeys } from "@/shared/lib/query-keys";
import { notify } from "@/shared/lib/ui/notify";

export const Route = createFileRoute("/_dashboard/agents/")({
  component: AgentsListPage,
});

function AgentsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAgentWorkflows();
  const createAgentWorkflow = useCreateAgentWorkflow();
  const deleteAgentWorkflow = useDeleteAgentWorkflow();
  const updateAgentWorkflow = useUpdateAgentWorkflow();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<{ key: string; name: string } | null>(null);

  const agents = data?.workflows ?? [];

  const handleStatusChange = async (key: string, status: WorkflowStatus) => {
    try {
      await updateAgentWorkflow.mutateAsync({ key, input: { status } });
      notify.success(`Status changed to ${status}`);
    } catch {
      notify.error("Failed to change status");
    }
  };

  const handleCreate = async (values: { key: string; name: string; description?: string }) => {
    try {
      const result = await createAgentWorkflow.mutateAsync({
        key: values.key,
        name: values.name,
        description: values.description,
        configuration: {
          nodes: [
            { id: "start", type: "start", position: { x: 100, y: 200 }, data: {} },
            {
              id: "agent-1",
              type: "agent",
              position: { x: 350, y: 200 },
              data: {
                name: "Assistant",
                systemPrompt: "You are a helpful assistant. Answer user questions clearly and concisely.",
                llm: { provider: llmConfig.agent.model.provider, model: llmConfig.agent.model.id, reasoningEffort: llmConfig.agent.reasoningEffort },
                tools: {
                  readUserVariable: false,
                  writeUserVariable: false,
                  saveMemory: false,
                  recallMemories: false,
                },
                externalTools: { embedded: [] },
                history: { strategy: "simple", maxMessages: 12 },
              },
            },
            { id: "end", type: "end", position: { x: 600, y: 200 }, data: {} },
          ],
          edges: [
            { id: "e-start-agent", source: "start", target: "agent-1" },
            { id: "e-agent-end", source: "agent-1", target: "end" },
          ],
        },
        status: "draft",
      });

      setDialogOpen(false);
      notify.success("Agent created successfully");

      // Await refetch BEFORE navigation to prevent race condition
      // Ensures agent list cache contains the new agent before route loads
      await queryClient.refetchQueries({ queryKey: agentWorkflowKeys.all });

      navigate({
        to: "/agents/$agentKey",
        params: { agentKey: result.key },
      });
    } catch {
      notify.error("Failed to create agent");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return;

    try {
      await deleteAgentWorkflow.mutateAsync(agentToDelete.key);
      notify.success("Agent deleted successfully");
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    } catch {
      notify.error("Failed to delete agent");
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Compact Header: One line, always on top */}
      <div className="flex shrink-0 items-center justify-between border-b bg-background/95 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight">AI Agents</h1>
          <span className="text-xs text-muted-foreground">({agents.length})</span>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="h-8 gap-1.5 px-3">
          <Plus className="size-3.5" />
          <span>New Agent</span>
        </Button>
      </div>

      <NewAgentWorkflowDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={handleCreate} isLoading={createAgentWorkflow.isPending} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{agentToDelete?.name}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[100px] animate-pulse rounded-md border bg-muted/20 px-3 py-2 flex flex-col gap-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded mt-auto" />
              </div>
            ))}
          </div>
        ) : agents.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agents.map((agent) => (
              <DashboardItemCard
                key={agent.id}
                title={agent.name}
                subtitle={agent.key}
                description={agent.description || `Workflow key: ${agent.key}`}
                href="/agents/$agentKey"
                params={{ agentKey: agent.key }}
                status={agent.status && <EntityStatusBadge status={agent.status as WorkflowStatus} size="sm" className="px-0" entityType="workflow" />}
                footer={
                  <>
                    <span>{agent.nodeCount} nodes</span>
                    <span className="size-1 rounded-full bg-border" />
                    <span>{agent.agentCount} agents</span>
                  </>
                }
                actions={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-6 relative z-10 -mr-1 -mt-0.5" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem asChild>
                        <Link to="/agents/$agentKey" params={{ agentKey: agent.key }}>
                          <Pencil className="mr-2 size-3.5" />
                          <span className="text-xs">Open Builder</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Circle className="mr-2 size-3.5" />
                          <span className="text-xs">Set Status</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(agent.key, "draft");
                            }}
                            disabled={agent.status === "draft"}
                            className="text-xs"
                          >
                            <span className="mr-2 size-1.5 rounded-full bg-orange-500" />
                            Draft
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(agent.key, "active");
                            }}
                            disabled={agent.status === "active"}
                            className="text-xs"
                          >
                            <span className="mr-2 size-1.5 rounded-full bg-emerald-500" />
                            Active
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(agent.key, "archived");
                            }}
                            disabled={agent.status === "archived"}
                            className="text-xs"
                          >
                            <span className="mr-2 size-1.5 rounded-full bg-slate-500" />
                            Archived
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAgentToDelete({ key: agent.key, name: agent.name });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        Delete Agent
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            ))}
          </div>
        ) : (
          <div className="border-dashed border rounded-lg bg-muted/10 flex flex-col items-center justify-center py-16 px-4">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
              <Bot className="size-6" />
            </div>
            <h3 className="text-sm font-semibold mb-1">No Agents Found</h3>
            <p className="text-xs text-muted-foreground text-center mb-6 max-w-xs">Chain multiple AI models with conditional logic and context injection.</p>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="size-3.5" />
              Create First Agent
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
