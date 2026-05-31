/**
 * Context Deriver
 *
 * Analyzes condition nodes on a discovered path and derives
 * the context values needed to make each branch execute.
 *
 * This solves the "condition context mismatch" problem where
 * PathExplorer finds paths through condition branches, but
 * the variation runs with empty contextSetup and takes a different branch.
 *
 * @module engine/testing/context-deriver
 */

import type {
  JourneyConfig,
  JourneyEdgeData,
  JourneyNodeData,
  ConditionNodeData,
  ConditionRule,
} from "@journey/schemas";
import { buildGraph, type Graph } from "../validation/graph-utils";

// =============================================================================
// TYPES
// =============================================================================

export interface DerivedContext {
  /** Context values needed to follow this path */
  contextSetup: Record<string, unknown>;
  /** Any context requirements that couldn't be derived (for warning) */
  underivableConditions: string[];
}

// =============================================================================
// CONTEXT DERIVER
// =============================================================================

export class ContextDeriver {
  private graph: Graph;
  private journey: JourneyConfig;

  constructor(journey: JourneyConfig) {
    this.journey = journey;
    this.graph = buildGraph(journey);
  }

  /**
   * Derive context requirements for a path
   * @param path Array of node IDs representing the path
   * @returns Context setup and any warnings
   */
  deriveForPath(path: string[]): DerivedContext {
    const contextSetup: Record<string, unknown> = {};
    const underivableConditions: string[] = [];

    // Walk the path looking for condition nodes
    for (let i = 0; i < path.length - 1; i++) {
      const nodeId = path[i];
      const nextNodeId = path[i + 1];
      const node = this.graph.nodes.get(nodeId);

      if (!node) continue;

      // Check if this is a condition node (type: "custom" with data.type: "condition")
      if (this.isConditionNode(node)) {
        // Find the edge that connects this node to the next
        const edge = this.findEdge(nodeId, nextNodeId);
        if (!edge) continue;

        // The sourceHandle tells us which branch was taken
        const branchId = edge.sourceHandle;
        if (!branchId) continue;

        const derived = this.deriveConditionContext(node, branchId);
        if (derived) {
          Object.assign(contextSetup, derived);
        } else {
          underivableConditions.push(`${nodeId} → ${nextNodeId} (branch: ${branchId})`);
        }
      }
    }

    return { contextSetup, underivableConditions };
  }

  /**
   * Check if a node is a condition node
   */
  private isConditionNode(node: JourneyNodeData): boolean {
    // Condition nodes are type: "custom" with data.type: "condition"
    const dataType = (node.data as { type?: string }).type;
    return dataType === "condition";
  }

  /**
   * Find an edge between two nodes
   */
  private findEdge(sourceId: string, targetId: string): JourneyEdgeData | undefined {
    const edges = this.graph.outEdges.get(sourceId) || [];
    return edges.find((e) => e.target === targetId);
  }

  /**
   * Derive context for a single condition node transition
   * Handles both expression-based and rule-based conditions
   */
  private deriveConditionContext(
    node: JourneyNodeData,
    targetBranchId: string
  ): Record<string, unknown> | null {
    const conditionData = node.data as ConditionNodeData;
    const branches = (conditionData as { branches?: Array<{ id: string; isDefault?: boolean }> }).branches;
    const branch = branches?.find((b) => b.id === targetBranchId);

    // If it's the default branch, no context needed
    if (branch?.isDefault) {
      return {};
    }

    // Format 1: Expression-based conditions
    const expression = (conditionData as { expression?: string }).expression;
    if (expression) {
      return this.deriveFromExpression(expression, targetBranchId);
    }

    // Format 2: Rule-based conditions
    const rules = conditionData.rules;
    if (rules?.length) {
      return this.deriveFromRules(rules, targetBranchId, branches);
    }

    return null; // Couldn't derive
  }

  /**
   * Derive context from expression-based conditions
   * Parses expressions like: "selectedPlan.includes('Pro') ? 'pro' : 'basic'"
   *
   * Also handles complex ternary expressions like:
   * "selectedPlan && (selectedPlan.includes('Enterprise') || selectedPlan.includes('enterprise')) ? 'enterprise' : ..."
   */
  private deriveFromExpression(
    expression: string,
    targetBranchId: string
  ): Record<string, unknown> | null {
    // Strategy 1: Find all includes() calls and their associated branch IDs
    // by looking at ternary expressions that return the target branch

    // Find all "? 'branchId'" patterns and work backwards to find the condition
    const ternaryBranchPattern = /\?\s*['"](\w+)['"]/g;
    let match;
    let currentPos = 0;

    while ((match = ternaryBranchPattern.exec(expression)) !== null) {
      const branchId = match[1];
      if (branchId !== targetBranchId) {
        // Skip this branch but update position for next iteration
        currentPos = match.index + match[0].length;
        continue;
      }

      // Found a ternary that returns our target branch
      // Look at the expression BEFORE this ? to find includes() calls
      const beforeTernary = expression.slice(currentPos, match.index);

      // Find all variable.includes('Value') patterns in this section
      const includesPattern = /(\w+)\.includes\(['"]([^'"]+)['"]\)/g;
      let includesMatch;

      while ((includesMatch = includesPattern.exec(beforeTernary)) !== null) {
        const [, variable, testValue] = includesMatch;
        // Use the first match - for our target branch
        return { [variable]: testValue };
      }

      // Also try variable === 'value' pattern
      const equalsPattern = /(\w+)\s*===?\s*['"]([^'"]+)['"]/g;
      let equalsMatch;

      while ((equalsMatch = equalsPattern.exec(beforeTernary)) !== null) {
        const [, variable, testValue] = equalsMatch;
        return { [variable]: testValue };
      }

      currentPos = match.index + match[0].length;
    }

    // Strategy 2: Simple patterns (for simpler expressions)

    // Pattern: variable.includes('Value') ? 'branchId'
    const simpleIncludesPattern = /(\w+)\.includes\(['"]([^'"]+)['"]\)\s*\?\s*['"](\w+)['"]/g;
    while ((match = simpleIncludesPattern.exec(expression)) !== null) {
      const [, variable, testValue, branchId] = match;
      if (branchId === targetBranchId) {
        return { [variable]: testValue };
      }
    }

    // Pattern: variable === 'value' ? 'branchId'
    const simpleEqualsPattern = /(\w+)\s*===?\s*['"]([^'"]+)['"]\s*\?\s*['"](\w+)['"]/g;
    while ((match = simpleEqualsPattern.exec(expression)) !== null) {
      const [, variable, testValue, branchId] = match;
      if (branchId === targetBranchId) {
        return { [variable]: testValue };
      }
    }

    // Pattern: context.field === 'value' (with context. prefix)
    const contextPattern = /context\.(\w+)\s*===?\s*['"]([^'"]+)['"]\s*\?\s*['"](\w+)['"]/g;
    while ((match = contextPattern.exec(expression)) !== null) {
      const [, field, testValue, branchId] = match;
      if (branchId === targetBranchId) {
        return { [field]: testValue };
      }
    }

    return null; // Expression too complex to parse
  }

  /**
   * Derive context from rule-based conditions
   */
  private deriveFromRules(
    rules: ConditionRule[],
    targetBranchId: string,
    branches?: Array<{ id: string; isDefault?: boolean }>
  ): Record<string, unknown> | null {
    // For rule-based conditions, we need to satisfy all rules
    // to take a non-default branch
    const context: Record<string, unknown> = {};

    // Check if target is the default branch
    const targetBranch = branches?.find((b) => b.id === targetBranchId);
    if (targetBranch?.isDefault) {
      // Default branch requires NO rules to match
      // We can't easily derive a context that makes rules fail
      return {};
    }

    // Non-default branch: all rules must match
    for (const rule of rules) {
      const derived = this.ruleToContext(rule);
      if (!derived) return null; // Can't derive this rule
      Object.assign(context, derived);
    }

    return context;
  }

  /**
   * Convert a condition rule to context values
   */
  private ruleToContext(rule: ConditionRule): Record<string, unknown> | null {
    const field = rule.field;
    const value = rule.value;

    switch (rule.operator) {
      case "equals":
        return { [field]: value };

      case "contains":
        // For arrays like session.tags, wrap in array
        // For strings, the value should contain the test string
        if (field.includes("tags") || field.endsWith("[]")) {
          return { [field]: [value] };
        }
        return { [field]: value };

      case "greaterThan":
        return { [field]: Number(value) + 1 };

      case "lessThan":
        return { [field]: Number(value) - 1 };

      case "exists":
        return { [field]: "placeholder_value" };

      case "notExists":
        // Don't set the field
        return {};

      case "notEquals":
        // Can't easily derive - would need to pick arbitrary different value
        return null;

      default:
        return null; // Unknown operator
    }
  }
}
