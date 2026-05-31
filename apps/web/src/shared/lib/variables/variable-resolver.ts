/**
 * Variable Resolver
 *
 * Collects available variables for condition nodes by traversing
 * the journey graph backwards from a given node.
 *
 * Variables come from:
 * - Message nodes: userResponse, storeResponseAs custom variables
 * - Webhook nodes: storeAs custom variables
 * - Built-in context variables
 */

import {
  generateNodeOutputMock,
  DEFAULT_USER_SCHEMA,
  DEFAULT_SESSION_SCHEMA,
  type MindstateDefinition,
  type VariableSchemas,
  type WorkflowVariable,
  type WorkflowNode,
} from "@journey/schemas";
import type { JourneyEdge, JourneyNode, MessageNodeData, QuestionnaireNodeData, WebhookNodeData } from "@/features/nodes/journey/react-flow-types";
import { resolveSchemaVariables, resolveAllSchemaVariables } from "./schema-resolver";
import { sanitizeNodeLabel } from "./sanitize";

export interface AvailableVariable {
  path: string; // e.g., "userResponse.value" or "user.firstName" or "nodes.agent-alex.response"
  displayPath?: string; // Human-readable path for display (e.g., "nodes.Simulation_Skill_Profiling.response")
  type: "string" | "number" | "boolean" | "object" | "any";
  description: string;
  sourceNodeId?: string;
  sourceNodeLabel?: string;
  category: "builtin" | "message" | "webhook" | "custom" | "user" | "session" | "vars" | "nodes" | "mindstate" | "workflow";
}

/**
 * Built-in variables that are always available (legacy journey response handling)
 */
export const BUILTIN_VARIABLES: AvailableVariable[] = [
  {
    path: "userResponse.value",
    type: "string",
    description: "User's response text or button value",
    category: "builtin",
  },
  {
    path: "userResponse.type",
    type: "string",
    description: 'Response type: "button" or "text"',
    category: "builtin",
  },
  {
    path: "userResponse",
    type: "object",
    description: "Full user response object",
    category: "builtin",
  },
];

/**
 * Default user namespace variables derived from @journey/schemas.
 * Single source of truth - always matches engine expectations.
 */
export const USER_NAMESPACE_VARIABLES: AvailableVariable[] = resolveSchemaVariables(
  { user: DEFAULT_USER_SCHEMA },
  "user"
);

/**
 * Default session namespace variables derived from @journey/schemas.
 * Single source of truth - always matches engine expectations.
 */
export const SESSION_NAMESPACE_VARIABLES: AvailableVariable[] = resolveSchemaVariables(
  { session: DEFAULT_SESSION_SCHEMA },
  "session"
);

// =============================================================================
// HIERARCHICAL VARIABLE EXTRACTION
// =============================================================================

/**
 * Get the type string for a value
 */
function getValueType(value: unknown): AvailableVariable["type"] {
  if (value === null || value === undefined) return "any";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "object";
  if (typeof value === "object") return "object";
  return "any";
}

/**
 * Recursively extract variable paths from an object
 * Used to generate hierarchical variables like nodes.Welcome.message, nodes.Welcome.sentAt
 *
 * @param obj - Object to extract paths from
 * @param basePath - Base path prefix (e.g., "nodes.Welcome")
 * @param maxDepth - Maximum depth to traverse (default: 2)
 * @param currentDepth - Current recursion depth
 * @returns Array of paths with types
 */
function extractNestedPaths(
  obj: unknown,
  basePath: string,
  maxDepth: number = 2,
  currentDepth: number = 0
): Array<{ path: string; type: AvailableVariable["type"] }> {
  const paths: Array<{ path: string; type: AvailableVariable["type"] }> = [];

  // Stop at max depth or if value is not an object
  if (currentDepth >= maxDepth || obj === null || obj === undefined) {
    return paths;
  }

  if (typeof obj !== "object" || Array.isArray(obj)) {
    return paths;
  }

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = `${basePath}.${key}`;
    const valueType = getValueType(value);

    paths.push({ path: fullPath, type: valueType });

    // Recursively extract nested object properties (not arrays)
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      paths.push(...extractNestedPaths(value, fullPath, maxDepth, currentDepth + 1));
    }
  }

  return paths;
}

// =============================================================================
// GRAPH TRAVERSAL
// =============================================================================

/**
 * Find all nodes that can reach the target node (upstream nodes)
 */
function findUpstreamNodes(
  targetNodeId: string,
  nodes: JourneyNode[],
  edges: JourneyEdge[]
): JourneyNode[] {
  const visited = new Set<string>();
  const upstream: JourneyNode[] = [];

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // Find edges that point TO this node
    const incomingEdges = edges.filter((e) => e.target === nodeId);

    for (const edge of incomingEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode) {
        upstream.push(sourceNode);
        traverse(sourceNode.id);
      }
    }
  }

  traverse(targetNodeId);
  return upstream;
}

/**
 * Extract variables from a message node
 */
function extractMessageVariables(node: JourneyNode): AvailableVariable[] {
  const data = node.data as MessageNodeData;
  const variables: AvailableVariable[] = [];

  // If node stores response as custom variable
  if (data.storeResponseAs) {
    variables.push({
      path: data.storeResponseAs,
      type: "string",
      description: `Response from "${data.label}"`,
      sourceNodeId: node.id,
      sourceNodeLabel: data.label,
      category: "message",
    });
  }

  return variables;
}

/**
 * Extract variables from a webhook node
 */
function extractWebhookVariables(node: JourneyNode): AvailableVariable[] {
  const data = node.data as WebhookNodeData;
  const variables: AvailableVariable[] = [];

  // If webhook stores response
  if (data.storeAs) {
    variables.push({
      path: data.storeAs,
      type: "any",
      description: `Response from "${data.label}" webhook`,
      sourceNodeId: node.id,
      sourceNodeLabel: data.label,
      category: "webhook",
    });
  }

  return variables;
}

/**
 * Extract variables from a questionnaire node
 */
function extractQuestionnaireVariables(node: JourneyNode): AvailableVariable[] {
  const data = node.data as QuestionnaireNodeData;
  const variables: AvailableVariable[] = [];

  // If questionnaire stores all responses as single object
  if (data.storeAllAs) {
    variables.push({
      path: data.storeAllAs,
      type: "object",
      description: `All responses from "${data.label}" questionnaire`,
      sourceNodeId: node.id,
      sourceNodeLabel: data.label,
      category: "message",
    });

    // Add individual question paths for autocomplete convenience
    for (const question of data.questions || []) {
      const questionPreview = question.content.length > 40 ? `${question.content.substring(0, 40)}...` : question.content;
      variables.push({
        path: `${data.storeAllAs}.${question.id}`,
        type: "string",
        description: `Response to: "${questionPreview}"`,
        sourceNodeId: node.id,
        sourceNodeLabel: data.label,
        category: "message",
      });
    }
  }

  return variables;
}

/**
 * Extract node output variables (for nodes namespace)
 * Generates hierarchical paths from node output schema using mock data
 *
 * Example outputs for a message node:
 *   nodes.Welcome (object)
 *   nodes.Welcome.message (string)
 *   nodes.Welcome.messageDelivered (boolean)
 *   nodes.Welcome.sentAt (string)
 */
function extractNodeOutputVariables(node: JourneyNode): AvailableVariable[] {
  const variables: AvailableVariable[] = [];

  // Create variable path from sanitized node label
  const sanitizedLabel = sanitizeNodeLabel(node.data.label);
  if (!sanitizedLabel) return variables;

  const basePath = `nodes.${sanitizedLabel}`;

  // Add root node variable
  variables.push({
    path: basePath,
    type: "object",
    description: `Output data from "${node.data.label}" node`,
    sourceNodeId: node.id,
    sourceNodeLabel: node.data.label,
    category: "nodes",
  });

  // Generate mock to extract schema and create nested paths
  const mock = generateNodeOutputMock(node.data.type, node.data);
  if (mock?.data && typeof mock.data === "object") {
    const nestedPaths = extractNestedPaths(mock.data, basePath, 2);

    for (const { path, type } of nestedPaths) {
      // Extract property name for description
      const propName = path.split(".").pop() || "";

      variables.push({
        path,
        type,
        description: `${propName} from "${node.data.label}"`,
        sourceNodeId: node.id,
        sourceNodeLabel: node.data.label,
        category: "nodes",
      });
    }
  }

  return variables;
}

/**
 * Build mindstate variables from definitions
 * Creates variables in format: mindstate.{definition-key}.{parameter-id}
 * Uses parameter ID (not name) to ensure valid variable paths without spaces
 */
function buildMindstateVariables(mindstateDefinitions: MindstateDefinition[]): AvailableVariable[] {
  const variables: AvailableVariable[] = [];

  for (const def of mindstateDefinitions) {
    for (const param of def.defaultParameters) {
      // Determine type based on scaleType
      let varType: AvailableVariable["type"] = "any";
      if (param.scaleType === "NUMERIC") {
        varType = "number";
      } else if (param.scaleType === "BOOLEAN") {
        varType = "boolean";
      } else if (param.scaleType === "CATEGORICAL") {
        varType = "string";
      }

      variables.push({
        path: `mindstate.${def.key}.${param.id}`,
        type: varType,
        description: param.description || `${def.name} - ${param.name}`,
        category: "mindstate",
      });
    }
  }

  return variables;
}

/**
 * Process upstream nodes and extract variables from them
 * Shared logic used by both resolveAvailableVariables and resolveTemplateVariables
 */
function processUpstreamNodes(upstreamNodes: JourneyNode[]): AvailableVariable[] {
  const variables: AvailableVariable[] = [];

  for (const node of upstreamNodes) {
    // Extract type-specific variables
    switch (node.data.type) {
      case "message":
        variables.push(...extractMessageVariables(node));
        break;
      case "webhook":
        variables.push(...extractWebhookVariables(node));
        break;
      case "questionnaire":
        variables.push(...extractQuestionnaireVariables(node));
        break;
    }
    // All upstream nodes can contribute to nodes namespace
    variables.push(...extractNodeOutputVariables(node));
  }

  return variables;
}

/** Variable definition type for journey/global vars */
export type VariableDefinition = { key: string; value: unknown; description?: string | null };

/**
 * Build vars namespace variables (vars.journey.* and vars.global.*)
 * Shared logic for both resolveAvailableVariables and resolveTemplateVariables
 */
function buildVarsNamespaceVariables(
  journeyVars?: VariableDefinition[],
  globalVars?: VariableDefinition[]
): AvailableVariable[] {
  const variables: AvailableVariable[] = [];

  // Add vars.journey.* namespace
  if (journeyVars) {
    for (const v of journeyVars) {
      variables.push({
        path: `vars.journey.${v.key}`,
        type: typeof v.value === "string" ? "string" : typeof v.value === "number" ? "number" : typeof v.value === "boolean" ? "boolean" : "any",
        description: v.description || `Journey variable: ${v.key}`,
        category: "vars",
      });
    }
  }

  // Add vars.global.* namespace
  if (globalVars) {
    for (const v of globalVars) {
      variables.push({
        path: `vars.global.${v.key}`,
        type: typeof v.value === "string" ? "string" : typeof v.value === "number" ? "number" : typeof v.value === "boolean" ? "boolean" : "any",
        description: v.description || `Global variable: ${v.key}`,
        category: "vars",
      });
    }
  }

  return variables;
}

/**
 * Deduplicate variables by path
 */
function deduplicateVariables(variables: AvailableVariable[]): AvailableVariable[] {
  return variables.reduce((acc, variable) => {
    if (!acc.find((v) => v.path === variable.path)) {
      acc.push(variable);
    }
    return acc;
  }, [] as AvailableVariable[]);
}

/**
 * Resolve all available variables for a condition node
 *
 * @param nodeId - The condition node ID
 * @param nodes - All nodes in the journey
 * @param edges - All edges in the journey
 * @param mindstateDefinitions - Optional mindstate definitions to include (filtered to journey's configured keys)
 * @param journeyVars - Optional journey-scoped variables
 * @param globalVars - Optional global-scoped variables
 * @param variableSchemas - Optional variable schema definitions for enhanced autocomplete
 * @returns Array of available variables
 */
export function resolveAvailableVariables(
  nodeId: string,
  nodes: JourneyNode[],
  edges: JourneyEdge[],
  mindstateDefinitions?: MindstateDefinition[],
  journeyVars?: VariableDefinition[],
  globalVars?: VariableDefinition[],
  variableSchemas?: VariableSchemas | null
): AvailableVariable[] {
  // Start with builtin variables (always available)
  const variables: AvailableVariable[] = [...BUILTIN_VARIABLES];

  // Add user/session variables - prefer schema-defined if available
  if (variableSchemas?.user || variableSchemas?.session) {
    // Use schema-based variables (includes deep nested paths)
    const schemaVars = resolveAllSchemaVariables(variableSchemas);
    variables.push(...schemaVars);

    // Add fallback static vars for namespaces without schemas
    if (!variableSchemas.user) {
      variables.push(...USER_NAMESPACE_VARIABLES);
    }
    if (!variableSchemas.session) {
      variables.push(...SESSION_NAMESPACE_VARIABLES);
    }
  } else {
    // No schemas - use static defaults
    variables.push(...USER_NAMESPACE_VARIABLES, ...SESSION_NAMESPACE_VARIABLES);
  }

  // Add vars namespace (journey/global variables)
  variables.push(...buildVarsNamespaceVariables(journeyVars, globalVars));

  // Find upstream nodes and process them
  const upstreamNodes = findUpstreamNodes(nodeId, nodes, edges);
  variables.push(...processUpstreamNodes(upstreamNodes));

  // Add mindstate variables if definitions provided
  if (mindstateDefinitions?.length) {
    variables.push(...buildMindstateVariables(mindstateDefinitions));
  }

  return deduplicateVariables(variables);
}

/**
 * Resolve all template variables (for autocomplete in text fields)
 * Includes all engine context namespaces: user, session, vars, nodes, mindstate
 *
 * @param nodeId - The current node ID
 * @param nodes - All nodes in the journey
 * @param edges - All edges in the journey
 * @param journeyVars - Journey-scoped variables (from API)
 * @param globalVars - Global-scoped variables (from API)
 * @param mindstateDefinitions - Optional mindstate definitions to include (filtered to journey's configured keys)
 * @param variableSchemas - Optional variable schema definitions for enhanced autocomplete
 * @returns Array of all available template variables
 */
export function resolveTemplateVariables(
  nodeId: string,
  nodes: JourneyNode[],
  edges: JourneyEdge[],
  journeyVars?: VariableDefinition[],
  globalVars?: VariableDefinition[],
  mindstateDefinitions?: MindstateDefinition[],
  variableSchemas?: VariableSchemas | null
): AvailableVariable[] {
  // Start with builtin variables (always available)
  const variables: AvailableVariable[] = [...BUILTIN_VARIABLES];

  // Add user/session variables - prefer schema-defined if available
  if (variableSchemas?.user || variableSchemas?.session) {
    // Use schema-based variables (includes deep nested paths)
    const schemaVars = resolveAllSchemaVariables(variableSchemas);
    variables.push(...schemaVars);

    // Add fallback static vars for namespaces without schemas
    if (!variableSchemas.user) {
      variables.push(...USER_NAMESPACE_VARIABLES);
    }
    if (!variableSchemas.session) {
      variables.push(...SESSION_NAMESPACE_VARIABLES);
    }
  } else {
    // No schemas - use static defaults
    variables.push(...USER_NAMESPACE_VARIABLES, ...SESSION_NAMESPACE_VARIABLES);
  }

  // Add vars namespace (journey/global variables)
  variables.push(...buildVarsNamespaceVariables(journeyVars, globalVars));

  // Add mindstate variables if definitions provided
  if (mindstateDefinitions?.length) {
    variables.push(...buildMindstateVariables(mindstateDefinitions));
  }

  // Find upstream nodes for nodes namespace
  const upstreamNodes = findUpstreamNodes(nodeId, nodes, edges);
  variables.push(...processUpstreamNodes(upstreamNodes));

  return deduplicateVariables(variables);
}

// =============================================================================
// WORKFLOW VARIABLES
// =============================================================================

/**
 * Map workflow variable type to AvailableVariable type
 */
function mapWorkflowVariableType(type: WorkflowVariable["type"]): AvailableVariable["type"] {
  switch (type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
    case "array":
      return "object";
    default:
      return "any";
  }
}

/**
 * Resolve workflow-declared variables into AvailableVariable format.
 *
 * Workflow variables are defined in workflow.configuration.variables and
 * represent the expected inputs/state for workflow execution.
 *
 * @param workflowVariables - Array of workflow variable definitions
 * @returns Array of AvailableVariable for autocomplete
 */
export function resolveWorkflowVariables(workflowVariables: WorkflowVariable[] | undefined): AvailableVariable[] {
  if (!workflowVariables?.length) {
    return [];
  }

  return workflowVariables.map((v) => ({
    path: `workflow.${v.name}`,
    type: mapWorkflowVariableType(v.type),
    description: v.description || `Workflow variable (${v.type})`,
    category: "workflow" as const,
  }));
}

// =============================================================================
// WORKFLOW NODE OUTPUTS
// =============================================================================

/**
 * Extract variable outputs from workflow nodes.
 *
 * Workflow nodes (especially agent nodes) produce outputs that can be
 * referenced in downstream nodes. This function extracts available
 * output paths in the format: nodes.{NodeName}.response
 *
 * @param workflowNodes - All workflow nodes
 * @param currentNodeId - Current node ID (to filter self)
 * @returns Array of AvailableVariable for autocomplete
 */
export function resolveWorkflowNodeOutputs(
  workflowNodes: WorkflowNode[],
  currentNodeId?: string
): AvailableVariable[] {
  const variables: AvailableVariable[] = [];

  for (const node of workflowNodes) {
    // Skip start nodes and current node
    if (node.type === "start" || node.id === currentNodeId) continue;

    // Get node name for display
    const nodeName = typeof node.data.name === "string" ? node.data.name : node.id;

    // Sanitize node name for display path (looks like a variable)
    const sanitizedName = sanitizeNodeLabel(nodeName);

    // Use node.id for path (stable), sanitized name for display (readable)
    const basePath = `nodes.${node.id}`;
    const displayBasePath = `nodes.${sanitizedName || node.id}`;

    // Add base node reference
    variables.push({
      path: basePath,
      displayPath: displayBasePath,
      type: "object",
      description: `Output from "${nodeName}" node`,
      sourceNodeId: node.id,
      sourceNodeLabel: nodeName,
      category: "nodes",
    });

    // For agent nodes, add .response path (most common use case)
    if (node.type === "agent") {
      variables.push({
        path: `${basePath}.response`,
        displayPath: `${displayBasePath}.response`,
        type: "string",
        description: `Response text from "${nodeName}"`,
        sourceNodeId: node.id,
        sourceNodeLabel: nodeName,
        category: "nodes",
      });
    }

    // For transform nodes with outputVariable
    const outputVariable = node.data.outputVariable;
    if (node.type === "transform" && typeof outputVariable === "string") {
      variables.push({
        path: `${basePath}.${outputVariable}`,
        displayPath: `${displayBasePath}.${outputVariable}`,
        type: "any",
        description: `Transformed output from "${nodeName}"`,
        sourceNodeId: node.id,
        sourceNodeLabel: nodeName,
        category: "nodes",
      });
    }
  }

  return variables;
}

/**
 * Get all available operators with human-readable labels
 */
export const CONDITION_OPERATORS = [
  { value: "equals", label: "equals", description: "Value equals" },
  { value: "notEquals", label: "not equals", description: "Value does not equal" },
  { value: "contains", label: "contains", description: "Text contains" },
  { value: "notContains", label: "not contains", description: "Text does not contain" },
  { value: "startsWith", label: "starts with", description: "Text starts with" },
  { value: "endsWith", label: "ends with", description: "Text ends with" },
  { value: "greaterThan", label: ">", description: "Greater than (numbers)" },
  { value: "lessThan", label: "<", description: "Less than (numbers)" },
  { value: "greaterThanOrEqual", label: ">=", description: "Greater than or equal" },
  { value: "lessThanOrEqual", label: "<=", description: "Less than or equal" },
  { value: "exists", label: "exists", description: "Value exists (not null/undefined)" },
  { value: "notExists", label: "not exists", description: "Value does not exist" },
  { value: "matches", label: "matches regex", description: "Matches regular expression" },
] as const;

export type ConditionOperatorValue = (typeof CONDITION_OPERATORS)[number]["value"];

