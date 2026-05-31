/**
 * useTemplateVariables Hook
 *
 * Collects all available template variables for autocomplete in text fields.
 * Combines variables from:
 * - Engine context namespaces (user, session)
 * - Journey and global variables (vars namespace)
 * - Upstream node outputs (nodes namespace)
 * - Mindstate parameters (mindstate namespace)
 * - Workflow-declared variables (workflow namespace)
 * - Legacy built-in variables
 *
 * @module hooks/use-template-variables
 */

import { useMemo } from "react";

import type { VariableSchemas, WorkflowNode } from "@journey/schemas";
import { useAgentWorkflow } from "@/features/agent-workflows/hooks";
import { useMindstateDefinitions } from "@/features/mindstate";
import { useGlobalVariables, useJourneyVariables } from "@/hooks/queries/use-variables";
import { resolveTemplateVariables, resolveWorkflowVariables, resolveWorkflowNodeOutputs } from "@/shared/lib/variables/variable-resolver";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";

interface UseTemplateVariablesOptions {
  nodeId: string;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  journeyId?: string | null;
  /** Journey's mindstate configuration keys (from journey.mindstateConfig.keys) */
  mindstateKeys?: string[];
  /** Variable schema definitions for enhanced autocomplete with nested properties */
  variableSchemas?: VariableSchemas | null;
  /** Workflow key for workflow-declared variables (used in agent node editors) */
  workflowKey?: string;
  /** Workflow nodes for agent workflow context (extracts node outputs) */
  workflowNodes?: WorkflowNode[];
}

/**
 * Hook to get all available template variables for autocomplete
 */
export function useTemplateVariables({ nodeId, nodes, edges, journeyId, mindstateKeys, variableSchemas, workflowKey, workflowNodes }: UseTemplateVariablesOptions) {
  // Fetch journey and global variables
  const { data: globalVars = [] } = useGlobalVariables();
  const { data: journeyVars = [] } = useJourneyVariables(journeyId ?? undefined);

  // Fetch all mindstate definitions
  const { data: allMindstateDefinitions } = useMindstateDefinitions();

  // Fetch workflow for workflow-declared variables (only if workflowKey provided)
  const { data: workflow } = useAgentWorkflow(workflowKey);

  // Filter to only journey's configured mindstate definitions
  const mindstateDefinitions = useMemo(() => {
    if (!allMindstateDefinitions || !mindstateKeys?.length) {
      return undefined;
    }
    return allMindstateDefinitions.filter((def) => mindstateKeys.includes(def.key));
  }, [allMindstateDefinitions, mindstateKeys]);

  // Resolve workflow-declared variables
  const workflowVariables = useMemo(
    () => resolveWorkflowVariables(workflow?.configuration.variables),
    [workflow?.configuration.variables]
  );

  // Resolve workflow node outputs (for agent workflow context)
  const workflowNodeOutputs = useMemo(
    () => resolveWorkflowNodeOutputs(workflowNodes ?? [], nodeId),
    [workflowNodes, nodeId]
  );

  // Resolve all template variables (with optional schema-based enhancement)
  const baseVariables = useMemo(
    () => resolveTemplateVariables(nodeId, nodes, edges, journeyVars, globalVars, mindstateDefinitions, variableSchemas),
    [nodeId, nodes, edges, journeyVars, globalVars, mindstateDefinitions, variableSchemas]
  );

  // Combine base variables with workflow variables and node outputs
  const variables = useMemo(
    () => [...baseVariables, ...workflowVariables, ...workflowNodeOutputs],
    [baseVariables, workflowVariables, workflowNodeOutputs]
  );

  // Group variables by category for UI display
  const groupedVariables = useMemo(() => {
    const groups: Record<string, typeof variables> = {
      user: [],
      session: [],
      vars: [],
      nodes: [],
      builtin: [],
      message: [],
      webhook: [],
      custom: [],
      mindstate: [],
      workflow: [],
    };

    for (const variable of variables) {
      groups[variable.category] = groups[variable.category] || [];
      groups[variable.category].push(variable);
    }

    return groups;
  }, [variables]);

  return {
    variables,
    groupedVariables,
  };
}

