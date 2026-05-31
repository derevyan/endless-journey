/**
 * GuardSection Component
 *
 * UI for configuring edge guard conditions.
 * Supports three guard types:
 * - expression: JavaScript-like expression (e.g., "user.score > 50")
 * - variable: Simple variable comparison (key/operator/value)
 * - tag: Check if user has/doesn't have a tag
 *
 * Uses the same variable resolution pattern as condition node editor:
 * - VariableSelectorPopover for selecting variable paths
 * - TemplateInput/TemplateTextarea for {{var}} autocomplete
 */

import { useCallback, useMemo } from "react";
import { Plus, Shield, Trash2 } from "lucide-react";

import type { EdgeGuard, GuardTagOperator, GuardType, GuardVariableCondition, GuardVariableOperator } from "@journey/schemas";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { Button } from "@/shared/components/ui/button";
import { ExpressionEditor } from "@/shared/components/ui/codemirror";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { TemplateProvider } from "@/shared/components/ui/template-context";
import { TemplateInput } from "@/shared/components/ui/template-input";
import { VariableSelectorPopover } from "@/shared/components/ui/variable-selector-popover";
import { resolveAvailableVariables } from "@/shared/lib/variables/variable-resolver";

import { edgeSectionRegistry, EdgeSectionOrder, type EdgeSectionProps } from "../../edges/edge-section-registry";

/**
 * Creates a properly typed GuardVariableCondition based on operator.
 * The schema uses a discriminated union where comparison operators require value,
 * but "exists" allows optional value.
 */
function createVariableCondition(
  key: string,
  operator: GuardVariableOperator,
  value: unknown = ""
): GuardVariableCondition {
  if (operator === "exists") {
    return { key, operator, value };
  }
  // For comparison operators, ensure value is provided
  return { key, operator, value: value ?? "" };
}

interface GuardSectionProps {
  guard: EdgeGuard | null;
  onChange: (guard: EdgeGuard | null) => void;
  readOnly?: boolean;
  /** Journey nodes for variable resolution */
  nodes?: JourneyNode[];
  /** Journey edges for variable resolution */
  edges?: JourneyEdge[];
  /** Source node ID for variable resolution (use edge.source) */
  nodeId?: string;
  /** Journey ID for fetching journey/global variables */
  journeyId?: string | null;
}

/**
 * Guard type options
 */
const GUARD_TYPE_OPTIONS: { value: GuardType; label: string; description: string }[] = [
  { value: "expression", label: "Expression", description: "JavaScript-like condition" },
  { value: "variable", label: "Variable", description: "Compare session variable" },
  { value: "tag", label: "Tag", description: "Check user tag" },
];

/**
 * Variable operator options
 */
const VARIABLE_OPERATOR_OPTIONS: { value: GuardVariableOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "not equals" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "exists" },
];

/**
 * Tag operator options
 */
const TAG_OPERATOR_OPTIONS: { value: GuardTagOperator; label: string }[] = [
  { value: "has", label: "has tag" },
  { value: "notHas", label: "does not have tag" },
];

export function GuardSection({ guard, onChange, readOnly, nodes, edges, nodeId, journeyId }: GuardSectionProps) {
  // Resolve available variables from upstream nodes (same pattern as condition-builder)
  const availableVariables = useMemo(() => {
    if (!nodeId || !nodes || !edges) return [];
    return resolveAvailableVariables(nodeId, nodes, edges, undefined, [], []);
  }, [nodeId, nodes, edges]);

  // Group variables by category for VariableSelectorPopover
  const groupedVariables = useMemo(() => {
    const builtin = availableVariables.filter((v) => v.category === "builtin");
    const user = availableVariables.filter((v) => v.category === "user");
    const session = availableVariables.filter((v) => v.category === "session");
    const vars = availableVariables.filter((v) => v.category === "vars");
    const nodesVars = availableVariables.filter((v) => v.category === "nodes");
    const message = availableVariables.filter((v) => v.category === "message");
    const webhook = availableVariables.filter((v) => v.category === "webhook");
    const mindstate = availableVariables.filter((v) => v.category === "mindstate");
    return { builtin, user, session, vars, nodes: nodesVars, message, webhook, mindstate };
  }, [availableVariables]);

  // Check if variable context is available
  const hasVariableContext = Boolean(nodeId && nodes?.length && edges);

  // Add a new guard
  const handleAddGuard = useCallback(() => {
    onChange({
      type: "expression",
      expression: "",
    });
  }, [onChange]);

  // Remove the guard
  const handleRemoveGuard = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // Update guard type - safely extract values from discriminated union
  const handleTypeChange = useCallback(
    (type: GuardType) => {
      // Extract current values based on discriminated union type
      const currentExpression = guard?.type === "expression" ? guard.expression : "";
      const currentVariable = guard?.type === "variable" ? guard.variable : { key: "", operator: "equals" as const, value: "" };
      const currentTag = guard?.type === "tag" ? guard.tag : { tag: "", operator: "has" as const };

      if (type === "expression") {
        onChange({ type, expression: currentExpression });
      } else if (type === "variable") {
        onChange({ type, variable: currentVariable });
      } else if (type === "tag") {
        onChange({ type, tag: currentTag });
      }
    },
    [guard, onChange]
  );

  // No guard - show add button
  if (!guard) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={handleAddGuard} disabled={readOnly}>
        <Plus className="h-4 w-4 mr-1.5" />
        Add Guard Condition
      </Button>
    );
  }

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      {/* Guard Type Selector */}
      <div className="flex items-center justify-between gap-2">
        <Select value={guard.type} onValueChange={(v) => handleTypeChange(v as GuardType)} disabled={readOnly}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GUARD_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={handleRemoveGuard}
          disabled={readOnly}
          data-testid="guard-remove-button"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Expression Guard */}
      {guard.type === "expression" && (
        <div className="space-y-2">
          <Label className="text-xs">Expression</Label>
          {hasVariableContext ? (
            <TemplateProvider nodeId={nodeId ?? ""} nodes={nodes ?? []} edges={edges ?? []} journeyId={journeyId ?? null}>
              <ExpressionEditor
                value={guard.expression || ""}
                onChange={(value) => onChange({ ...guard, expression: value })}
                placeholder="e.g., user.score > 50 && {{userResponse.value}} === 'yes'"
                minHeight={60}
                disabled={readOnly}
              />
            </TemplateProvider>
          ) : (
            <Input
              value={guard.expression || ""}
              onChange={(e) => onChange({ ...guard, expression: e.target.value })}
              placeholder="e.g., user.score > 50"
              className="text-xs font-mono"
              disabled={readOnly}
            />
          )}
          <p className="text-[10px] text-muted-foreground">
            JavaScript-like expression. Type {"{{" } for variable autocomplete.
          </p>
        </div>
      )}

      {/* Variable Guard */}
      {guard.type === "variable" && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Variable</Label>
              {hasVariableContext ? (
                <VariableSelectorPopover
                  value={guard.variable?.key || ""}
                  onChange={(key) => {
                    const op = guard.variable?.operator ?? "equals";
                    const val = guard.variable?.value ?? "";
                    onChange({ ...guard, variable: createVariableCondition(key, op, val) });
                  }}
                  groupedVariables={groupedVariables}
                  nodes={nodes}
                  disabled={readOnly}
                  placeholder="Select..."
                />
              ) : (
                <Input
                  value={guard.variable?.key || ""}
                  onChange={(e) => {
                    const op = guard.variable?.operator ?? "equals";
                    const val = guard.variable?.value ?? "";
                    onChange({ ...guard, variable: createVariableCondition(e.target.value, op, val) });
                  }}
                  placeholder="e.g., score"
                  className="h-8 text-xs"
                  disabled={readOnly}
                />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operator</Label>
              <Select
                value={guard.variable?.operator || "equals"}
                onValueChange={(v) => {
                  const key = guard.variable?.key ?? "";
                  const val = guard.variable?.value ?? "";
                  onChange({ ...guard, variable: createVariableCondition(key, v as GuardVariableOperator, val) });
                }}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_OPERATOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Value</Label>
              {hasVariableContext ? (
                <TemplateProvider nodeId={nodeId ?? ""} nodes={nodes ?? []} edges={edges ?? []} journeyId={journeyId ?? null}>
                  <TemplateInput
                    value={String(guard.variable?.value ?? "")}
                    onChange={(e) => {
                      const key = guard.variable?.key ?? "";
                      const op = guard.variable?.operator ?? "equals";
                      const val = e.target.value;
                      // Keep as string if contains template variable
                      if (val.includes("{{")) {
                        onChange({ ...guard, variable: createVariableCondition(key, op, val) });
                        return;
                      }
                      // Try to parse as number
                      const numVal = Number(val);
                      const parsedValue = !isNaN(numVal) && val.trim() !== "" ? numVal : val;
                      onChange({ ...guard, variable: createVariableCondition(key, op, parsedValue) });
                    }}
                    placeholder="Value or {{var}}"
                    className="h-8 text-xs"
                    disabled={readOnly || guard.variable?.operator === "exists"}
                  />
                </TemplateProvider>
              ) : (
                <Input
                  value={String(guard.variable?.value ?? "")}
                  onChange={(e) => {
                    const key = guard.variable?.key ?? "";
                    const op = guard.variable?.operator ?? "equals";
                    const val = e.target.value;
                    const numVal = Number(val);
                    const parsedValue = !isNaN(numVal) && val.trim() !== "" ? numVal : val;
                    onChange({ ...guard, variable: createVariableCondition(key, op, parsedValue) });
                  }}
                  placeholder="e.g., 50"
                  className="h-8 text-xs"
                  disabled={readOnly || guard.variable?.operator === "exists"}
                />
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Compare variable against a value. Use {"{{var}}"} for dynamic comparisons.
          </p>
        </div>
      )}

      {/* Tag Guard */}
      {guard.type === "tag" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Operator</Label>
              <Select
                value={guard.tag?.operator || "has"}
                onValueChange={(v) => {
                  const current = guard.tag ?? { tag: "", operator: "has" as const };
                  onChange({ ...guard, tag: { ...current, operator: v as GuardTagOperator } });
                }}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAG_OPERATOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tag</Label>
              <Input
                value={guard.tag?.tag || ""}
                onChange={(e) => {
                  const current = guard.tag ?? { tag: "", operator: "has" as const };
                  onChange({ ...guard, tag: { ...current, tag: e.target.value } });
                }}
                placeholder="e.g., vip"
                className="h-8 text-xs"
                disabled={readOnly}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Check if user has or doesn't have a specific tag.</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EDGE SECTION ADAPTER
// =============================================================================

/**
 * Adapter component that bridges EdgeSectionProps to GuardSectionProps.
 * Used by the edge section registry.
 */
function GuardSectionAdapter({ edge, value, onChange, readOnly, nodes, edges, journeyId }: EdgeSectionProps) {
  return (
    <GuardSection
      guard={value as EdgeGuard | null}
      onChange={onChange as (guard: EdgeGuard | null) => void}
      readOnly={readOnly}
      nodes={nodes}
      edges={edges}
      nodeId={edge.source}
      journeyId={journeyId}
    />
  );
}

// =============================================================================
// SELF-REGISTRATION
// =============================================================================

/**
 * Register guard section with the edge section registry.
 * This runs on module import.
 */
edgeSectionRegistry.register({
  id: "guard",
  label: "Guard Condition",
  description: "Optional condition that must pass for this edge to be traversable.",
  icon: Shield,
  order: EdgeSectionOrder.GUARD,
  fieldName: "guard",
  shouldRender: () => true, // Always show guard section for edges
  component: GuardSectionAdapter,
});
