/**
 * Agent Workflow Builder Route
 *
 * Visual canvas editor for building agent workflows.
 *
 * @module routes/_dashboard.agents.$agentKey
 */

import { createFileRoute } from "@tanstack/react-router";

import { AgentWorkflowBuilderPage } from "@/features/agent-workflows/pages/agent-workflow-builder-page";

export const Route = createFileRoute("/_dashboard/agents/$agentKey")({
  component: AgentWorkflowBuilderPage,
});
