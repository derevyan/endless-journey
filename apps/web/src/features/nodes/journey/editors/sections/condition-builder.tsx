/**
 * Condition Builder Component
 *
 * Visual UI for building condition rules with:
 * - Collapsible rule cards with summary headers
 * - Drag-and-drop reordering
 * - AND/OR logic between rules
 */

import { createLogger } from "@journey/logger";
import type { ConditionOperator, ConditionRule } from "@journey/schemas";

const log = createLogger("condition-builder");
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useMindstateDefinitions } from "@/features/mindstate";
import { useJourneyConfig } from "@/hooks/queries";
import { useGlobalVariables, useJourneyVariables } from "@/hooks/queries/use-variables";
import { CONDITION_OPERATORS, resolveAvailableVariables } from "@/shared/lib/variables/variable-resolver";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { Button } from "@/shared/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { TemplateProvider } from "@/shared/components/ui/template-context";
import { TemplateInput } from "@/shared/components/ui/template-input";
import { VariableSelectorPopover } from "@/shared/components/ui/variable-selector-popover";
import { cn } from "@/shared/lib/utils";
import { ConditionBuilderProvider, useConditionBuilderContext } from "./condition-builder-context";

interface ConditionBuilderProps {
  rules: ConditionRule[];
  rulesOperator: "and" | "or";
  onChange: (rules: ConditionRule[], rulesOperator: "and" | "or") => void;
  nodeId: string;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  readOnly?: boolean;
  journeyId?: string | null;
}

/** Operators that don't require a value input */
const NO_VALUE_OPERATORS: ConditionOperator[] = ["exists", "notExists"];

/** Get human-readable operator label */
function getOperatorLabel(operator: ConditionOperator): string {
  const op = CONDITION_OPERATORS.find((o) => o.value === operator);
  return op?.label ?? operator;
}

/** Format value for display in summary */
function formatValue(value: string | number | boolean | undefined): string {
  if (value === undefined || value === "") return "...";
  return String(value);
}

/** Create an empty rule with unique id */
function createEmptyRule(): ConditionRule & { _id: string } {
  return {
    _id: crypto.randomUUID(),
    field: "userResponse.value",
    operator: "equals",
    value: "",
  };
}

/** Ensure rules have _id for drag-and-drop */
function ensureRuleIds(rules: ConditionRule[]): (ConditionRule & { _id: string })[] {
  return rules.map((rule) => ({
    ...rule,
    _id: (rule as ConditionRule & { _id?: string })._id ?? crypto.randomUUID(),
  }));
}

interface SortableRuleProps {
  rule: ConditionRule & { _id: string };
  index: number;
  totalRules: number;
}

function SortableRule({ rule, index, totalRules }: SortableRuleProps) {
  // Get shared data and callbacks from context (eliminates prop drilling)
  const { nodes, edges, nodeId, journeyId, groupedVariables, readOnly, onRuleChange, onRemove } =
    useConditionBuilderContext();
  const [isOpen, setIsOpen] = useState(true);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule._id,
    disabled: readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Build summary text for collapsed state
  const summaryText = useMemo(() => {
    const field = rule.field.includes("{{") ? rule.field : `{{${rule.field}}}`;
    const operator = getOperatorLabel(rule.operator);
    const value = NO_VALUE_OPERATORS.includes(rule.operator) ? "" : formatValue(rule.value);
    return { field, operator, value };
  }, [rule.field, rule.operator, rule.value]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("rounded-lg border bg-card transition-opacity", isDragging && "opacity-50")}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header with summary */}
        <div className="flex items-center gap-2 p-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-accent/50 -m-1 p-1 rounded transition-colors"
            >
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
              <span className="text-sm truncate">
                <span className="font-mono text-xs">{summaryText.field}</span>
                <span className="mx-1.5 font-medium">{summaryText.operator}</span>
                {summaryText.value && <span className="text-muted-foreground">{summaryText.value}</span>}
              </span>
            </button>
          </CollapsibleTrigger>

          {/* Drag handle */}
          {!readOnly && (
            <button
              type="button"
              className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t pt-3">
            {/* Variable selector */}
            <div className="flex items-center gap-3">
              <Label className="w-20 shrink-0 text-sm text-muted-foreground">Variable</Label>
              <div className="flex-1 min-w-0">
                <VariableSelectorPopover
                  value={rule.field}
                  onChange={(field) => onRuleChange(index, { field })}
                  groupedVariables={groupedVariables}
                  nodes={nodes}
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* Operator selector */}
            <div className="flex items-center gap-3">
              <Label className="w-20 shrink-0 text-sm text-muted-foreground">Operator</Label>
              <Select
                value={rule.operator}
                onValueChange={(operator) => onRuleChange(index, { operator: operator as ConditionOperator })}
                disabled={readOnly}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value input - only show if operator needs a value */}
            {!NO_VALUE_OPERATORS.includes(rule.operator) && (
              <div className="flex items-center gap-3">
                <Label className="w-20 shrink-0 text-sm text-muted-foreground">Value</Label>
                <div className="flex-1">
                  <TemplateProvider nodeId={nodeId} nodes={nodes} edges={edges} journeyId={journeyId ?? null}>
                    <TemplateInput
                      value={String(rule.value ?? "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Keep as string if it contains template variables
                        if (val.includes("{{")) {
                          onRuleChange(index, { value: val });
                          return;
                        }
                        // Try to parse as number if it looks like one
                        const numVal = parseFloat(val);
                        const finalValue = !isNaN(numVal) && val.trim() !== "" ? numVal : val;
                        onRuleChange(index, { value: finalValue });
                      }}
                      placeholder="Enter value or {{var}}..."
                      className="w-full"
                      disabled={readOnly}
                    />
                  </TemplateProvider>
                </div>
              </div>
            )}

            {/* Delete button */}
            {!readOnly && totalRules > 1 && (
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(index)}
                  className="text-muted-foreground hover:text-destructive h-7 px-2"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remove
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function ConditionBuilder({
  rules,
  rulesOperator,
  onChange,
  nodeId,
  nodes,
  edges,
  readOnly = false,
  journeyId,
}: ConditionBuilderProps) {
  // Fetch journey config to get mindstateConfig.keys
  const { data: journeyData } = useJourneyConfig(journeyId ?? null);
  const journeyMindstateKeys = useMemo(() => journeyData?.config?.mindstateConfig?.keys ?? [], [journeyData?.config?.mindstateConfig?.keys]);

  // Fetch all mindstate definitions
  const { data: allMindstateDefinitions } = useMindstateDefinitions();

  // Fetch journey and global variables
  const { data: globalVars = [] } = useGlobalVariables();
  const { data: journeyVars = [] } = useJourneyVariables(journeyId ?? undefined);

  // Filter to only journey's configured mindstate definitions
  const mindstateDefinitions = useMemo(() => {
    if (!allMindstateDefinitions || journeyMindstateKeys.length === 0) {
      return [];
    }
    return allMindstateDefinitions.filter((def) => journeyMindstateKeys.includes(def.key));
  }, [allMindstateDefinitions, journeyMindstateKeys]);

  // Resolve available variables from upstream nodes + all context namespaces
  const availableVariables = useMemo(() => {
    const vars = resolveAvailableVariables(
      nodeId,
      nodes,
      edges,
      mindstateDefinitions.length > 0 ? mindstateDefinitions : undefined,
      journeyVars,
      globalVars
    );
    log.debug(
      { nodeId, variableCount: vars.length, mindstateCount: mindstateDefinitions.length },
      "conditionBuilder:variablesResolved"
    );
    return vars;
  }, [nodeId, nodes, edges, mindstateDefinitions, journeyVars, globalVars]);

  // Group variables by category for the dropdown
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

  // Ensure rules have IDs for drag-and-drop
  const rulesWithIds = useMemo(() => ensureRuleIds(rules), [rules]);
  const ruleIds = useMemo(() => rulesWithIds.map((r) => r._id), [rulesWithIds]);

  // Ensure we always have at least one rule to display
  const displayRules = rulesWithIds.length > 0 ? rulesWithIds : [createEmptyRule()];

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = rulesWithIds.findIndex((r) => r._id === active.id);
        const newIndex = rulesWithIds.findIndex((r) => r._id === over.id);
        const newRules = arrayMove(rulesWithIds, oldIndex, newIndex);
        onChange(newRules, rulesOperator);
      }
    },
    [rulesWithIds, rulesOperator, onChange]
  );

  const handleAddRule = useCallback(
    (operator: "and" | "or") => {
      const newRule = createEmptyRule();
      onChange([...rulesWithIds, newRule], operator);
    },
    [rulesWithIds, onChange]
  );

  const handleRemoveRule = useCallback(
    (index: number) => {
      const newRules = rulesWithIds.filter((_, i) => i !== index);
      if (newRules.length === 0) {
        onChange([createEmptyRule()], rulesOperator);
      } else {
        onChange(newRules, rulesOperator);
      }
    },
    [rulesWithIds, rulesOperator, onChange]
  );

  const handleRuleChange = useCallback(
    (index: number, updates: Partial<ConditionRule>) => {
      // Handle case where rulesWithIds is empty (phantom display rule)
      // This can happen for existing nodes without rules or edge cases
      if (rulesWithIds.length === 0 && index === 0) {
        const newRule = { ...createEmptyRule(), ...updates };
        onChange([newRule], rulesOperator);
        return;
      }

      const newRules = rulesWithIds.map((rule, i) => {
        if (i === index) {
          const updatedRule = { ...rule, ...updates };
          // Clear value if operator doesn't need it
          if (updates.operator && NO_VALUE_OPERATORS.includes(updates.operator)) {
            updatedRule.value = undefined;
          }
          return updatedRule;
        }
        return rule;
      });
      onChange(newRules, rulesOperator);
    },
    [rulesWithIds, rulesOperator, onChange]
  );

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium">Condition Rules</Label>

      <ConditionBuilderProvider
        nodes={nodes}
        edges={edges}
        nodeId={nodeId}
        journeyId={journeyId}
        groupedVariables={groupedVariables}
        readOnly={readOnly}
        onRuleChange={handleRuleChange}
        onRemove={handleRemoveRule}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ruleIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {displayRules.map((rule, index) => (
                <div key={rule._id}>
                  <SortableRule rule={rule} index={index} totalRules={displayRules.length} />

                  {/* Operator badge between rules */}
                  {index < displayRules.length - 1 && (
                    <div className="flex justify-center my-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase px-2 py-0.5 bg-muted rounded">
                        {rulesOperator}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </ConditionBuilderProvider>

      {/* Add rule buttons */}
      {!readOnly && (
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAddRule("and")}
            className="flex-1"
          >
            + AND
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAddRule("or")}
            className="flex-1"
          >
            + OR
          </Button>
        </div>
      )}
    </div>
  );
}
