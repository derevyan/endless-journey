/**
 * Condition Node Handler
 *
 * Handles condition nodes - branching logic based on expressions or rules.
 * Evaluates conditions against session context and routes to matching branch.
 *
 * Supports mindstate references in expressions:
 * - Expression: `mindstate.mood.stress > 7`
 * - Rule field: `mindstate.customer-mood.satisfaction`
 */

import type { ConditionNodeData, StateParameterValue } from "@journey/schemas";
import type { ExecutionContext, HandlerResult } from "../../../types";
import { EdgeSelector } from "../../../services/edge-selector";
import { assertNodeData, getOrBuildEvaluationContext, storeNodeOutput } from "../../../utils";
import { BaseNodeHandler } from "../../base-handler";

/**
 * Parse mindstate references from an expression or rule fields
 * Returns array of { mindstateKey, parameterName } pairs
 *
 * Pattern: mindstate.{key}.{parameter}
 * Example: mindstate.mood.stress -> { mindstateKey: "mood", parameterName: "stress" }
 */
function parseMindstateReferences(
  expression?: string,
  rules?: ConditionNodeData["rules"]
): Array<{ mindstateKey: string; parameterName: string }> {
  const refs: Array<{ mindstateKey: string; parameterName: string }> = [];
  const seen = new Set<string>();

  // Regex to match mindstate.{key}.{param}
  const pattern = /mindstate\.([a-z0-9-]+)\.([a-z0-9_]+)/gi;

  // Parse expression
  if (expression) {
    let match;
    while ((match = pattern.exec(expression)) !== null) {
      const key = `${match[1]}.${match[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ mindstateKey: match[1], parameterName: match[2] });
      }
    }
  }

  // Parse rule fields
  if (rules) {
    for (const rule of rules) {
      pattern.lastIndex = 0; // Reset regex
      let match;
      while ((match = pattern.exec(rule.field)) !== null) {
        const key = `${match[1]}.${match[2]}`;
        if (!seen.has(key)) {
          seen.add(key);
          refs.push({ mindstateKey: match[1], parameterName: match[2] });
        }
      }
    }
  }

  return refs;
}

/**
 * Build mindstate context object from fetched values
 * Converts Map<"key.param", value> to { key: { param: value } }
 */
function buildMindstateContext(
  values: Map<string, StateParameterValue>
): Record<string, Record<string, StateParameterValue>> {
  const context: Record<string, Record<string, StateParameterValue>> = {};

  for (const [fullKey, value] of values) {
    // Handle malformed keys gracefully
    const dotIndex = fullKey.indexOf(".");
    if (dotIndex === -1) {
      // No dot - skip this entry (shouldn't happen with proper refs)
      continue;
    }
    const key = fullKey.substring(0, dotIndex);
    const param = fullKey.substring(dotIndex + 1);

    if (!key || !param) {
      continue;
    }

    if (!context[key]) {
      context[key] = {};
    }
    context[key][param] = value;
  }

  return context;
}

/**
 * Build empty mindstate context structure from expected refs
 * This ensures expressions like `mindstate.mood.stress > 7` evaluate to
 * `null > 7` (false) instead of throwing on `undefined.stress`
 */
function buildEmptyMindstateContext(
  refs: Array<{ mindstateKey: string; parameterName: string }>
): Record<string, Record<string, null>> {
  const context: Record<string, Record<string, null>> = {};

  for (const ref of refs) {
    if (!context[ref.mindstateKey]) {
      context[ref.mindstateKey] = {};
    }
    context[ref.mindstateKey][ref.parameterName] = null;
  }

  return context;
}

/**
 * Handler for condition nodes
 *
 * Responsibilities:
 * - Build evaluation context from session
 * - Fetch mindstate values if referenced in expression/rules
 * - Delegate evaluation to condition evaluator service
 * - Find matching edge based on branch result
 * - Always returns a transition (conditions are synchronous)
 */
export class ConditionNodeHandler extends BaseNodeHandler<ConditionNodeData> {
  readonly nodeType = "condition" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { session, node, outgoingEdges, services, log, stateManager } = context;
    const conditionData = assertNodeData<ConditionNodeData>(node, "condition");

    if (outgoingEdges.length === 0) {
      log.warn({ nodeId: node.id }, "condition:noOutgoingEdges");
      return { action: "wait" };
    }

    // Build full evaluation context with namespaced bindings (cached per node execution)
    const evalContext = await getOrBuildEvaluationContext(context);

    // Check for mindstate references and fetch values if mindstate service is available
    // Note: We extend evalContext with mindstate namespace using Object.assign for type safety
    const mindstateRefs = parseMindstateReferences(conditionData.expression, conditionData.rules);
    if (mindstateRefs.length > 0) {
      if (services.mindstate) {
        try {
          const values = await services.mindstate.getMultipleParameterValues(session.userId, mindstateRefs);
          const mindstateContext = buildMindstateContext(values);
          Object.assign(evalContext, { mindstate: mindstateContext });

          log.debug(
            {
              nodeId: node.id,
              mindstateRefs: mindstateRefs.map((r) => `${r.mindstateKey}.${r.parameterName}`),
              valuesFound: values.size,
            },
            "condition:mindstateContext"
          );
        } catch (error) {
          log.error(
            { nodeId: node.id, err: error instanceof Error ? error.message : String(error) },
            "condition:mindstateFetchError"
          );
          // Build proper structure so `mindstate.mood.stress` evaluates to `null` not throws on `undefined.stress`
          Object.assign(evalContext, { mindstate: buildEmptyMindstateContext(mindstateRefs) });
        }
      } else {
        // Mindstate references found but no service available - set proper structure
        log.warn({ nodeId: node.id, mindstateRefs: mindstateRefs.length }, "condition:mindstateServiceNotAvailable");
        Object.assign(evalContext, { mindstate: buildEmptyMindstateContext(mindstateRefs) });
      }
    }

    // Evaluate condition with error handling
    let matchingBranchId: string;
    try {
      matchingBranchId = services.conditionEvaluator.evaluate(conditionData, evalContext);
    } catch (error) {
      log.error(
        { nodeId: node.id, err: error instanceof Error ? error.message : String(error) },
        "condition:evaluationError"
      );
      // Use default branch or first branch as fallback - require at least one branch exists
      const defaultBranch = conditionData.branches?.find((b) => b.isDefault);
      const fallbackBranchId = defaultBranch?.id ?? conditionData.branches?.[0]?.id;
      if (!fallbackBranchId) {
        log.error({ nodeId: node.id }, "condition:noBranchesConfigured");
        return { action: "wait" };
      }
      matchingBranchId = fallbackBranchId;
    }

    // Store condition result as node output (for cross-node references)
    storeNodeOutput(session, node, {
      branchId: matchingBranchId,
      evaluatedAt: new Date().toISOString(),
    }, stateManager);

    log.debug(
      {
        nodeId: node.id,
        matchingBranchId,
        expression: conditionData.expression,
        rulesCount: conditionData.rules?.length,
      },
      "condition:evaluated"
    );

    // Find edge that matches the branch (by sourceHandle or label)
    let targetEdge = outgoingEdges.find((e) => e.sourceHandle === matchingBranchId || e.label === matchingBranchId);

    // Fallback to default branch if no match found
    if (!targetEdge) {
      const defaultBranch = conditionData.branches.find((b) => b.isDefault);
      if (defaultBranch) {
        targetEdge = outgoingEdges.find(
          (e) => e.sourceHandle === defaultBranch.id || e.label === defaultBranch.label || e.label?.toLowerCase().includes("default")
        );
      }
    }

    // Ultimate fallback: first edge (defensive - outgoingEdges already checked above)
    if (!targetEdge && outgoingEdges.length > 0) {
      targetEdge = outgoingEdges[0];
      log.warn({ nodeId: node.id, matchingBranchId }, "condition:usingFirstEdgeFallback");
    }

    // Safety check - should never happen if outgoingEdges.length check passed
    if (!targetEdge) {
      log.error({ nodeId: node.id, matchingBranchId }, "condition:noTargetEdge");
      return { action: "wait" };
    }

    // Validate target edge against its guard (Smart Edges feature)
    // If blocked, validateEdge returns the fallback edge or original edge
    // Use full context (async) for guards referencing vars.*, nodes.*, etc.
    const selector = await EdgeSelector.from(context).withFullContext();
    targetEdge = selector.validateEdge(targetEdge, outgoingEdges);

    return {
      action: "transition",
      targetNodeId: targetEdge.target,
      trigger: `condition_${matchingBranchId}`,
    };
  }
}

export const conditionHandler = new ConditionNodeHandler();
