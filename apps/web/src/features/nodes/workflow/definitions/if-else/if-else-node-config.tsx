/**
 * If/Else Node Config
 *
 * Configuration panel for If/Else workflow nodes.
 * Uses TanStack Form for explicit save pattern.
 *
 * @module features/nodes/workflow/definitions/if-else/if-else-node-config
 */

import type { StructuredCondition } from "@journey/schemas";
import type { WorkflowNodeEditorProps } from "../../registry/types";
import { EXTENDED_OPERATORS, UNARY_OPERATORS } from "@/features/agent-workflows/constants/operators";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useWorkflowFormFieldValue } from "@/features/nodes/workflow/hooks/use-workflow-node-form";

type ConditionOperator = StructuredCondition["operator"];

export function IfElseNodeConfig({ form }: WorkflowNodeEditorProps) {
  // Subscribe to conditionType and operator for conditional rendering
  const conditionType = useWorkflowFormFieldValue<"expression" | "intent">(form, "conditionType");
  const operator = useWorkflowFormFieldValue<ConditionOperator>(form, "operator");

  const handleConditionTypeChange = (newType: "expression" | "intent") => {
    form.setFieldValue("conditionType", newType);
    if (newType === "expression") {
      form.setFieldValue("left", "result.success");
      form.setFieldValue("operator", "===");
      form.setFieldValue("right", true);
      form.setFieldValue("intents", undefined);
      form.setFieldValue("minConfidence", undefined);
    } else {
      form.setFieldValue("intents", ["confirm", "cancel"]);
      form.setFieldValue("minConfidence", 0.7);
      form.setFieldValue("left", undefined);
      form.setFieldValue("operator", undefined);
      form.setFieldValue("right", undefined);
    }
  };

  const handleRightChange = (rawValue: string) => {
    // Try to parse as number or boolean
    let value: string | number | boolean | null = rawValue;
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (value === "null") value = null;
    else if (!isNaN(Number(value)) && value !== "") value = Number(value);

    form.setFieldValue("right", value);
  };

  return (
    <div className="space-y-3">
      {/* Condition Type */}
      <div className="space-y-1.5">
        <Label>Condition Type</Label>
        <Select value={conditionType ?? "expression"} onValueChange={handleConditionTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expression">Expression</SelectItem>
            <SelectItem value="intent">Intent Detection</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {conditionType === "expression" && (
        <>
          {/* Left operand */}
          <div className="space-y-1.5">
            <Label>Left Operand</Label>
            <form.Field name="left">
              {(field) => (
                <Input
                  value={(field.state.value as string) ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="result.success"
                />
              )}
            </form.Field>
            <p className="text-xs text-muted-foreground">
              Variable path to evaluate (e.g., result.success, state.count)
            </p>
          </div>

          {/* Operator */}
          <div className="space-y-1.5">
            <Label>Operator</Label>
            <form.Field name="operator">
              {(field) => (
                <Select
                  value={(field.state.value as string) ?? "==="}
                  onValueChange={(value) => field.handleChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXTENDED_OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </form.Field>
          </div>

          {/* Right operand (not needed for unary operators) */}
          {!UNARY_OPERATORS.includes(operator ?? "===") && (
            <div className="space-y-1.5">
              <Label>Right Operand</Label>
              <form.Field name="right">
                {(field) => (
                  <Input
                    value={String(field.state.value ?? "")}
                    onChange={(e) => handleRightChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="true"
                  />
                )}
              </form.Field>
              <p className="text-xs text-muted-foreground">
                Value to compare against (string, number, boolean, or null)
              </p>
            </div>
          )}
        </>
      )}

      {conditionType === "intent" && (
        <>
          {/* Intent list */}
          <div className="space-y-1.5">
            <Label>Intents (comma-separated)</Label>
            <form.Field name="intents">
              {(field) => (
                <Textarea
                  value={((field.state.value as string[]) ?? []).join(", ")}
                  onChange={(e) => {
                    const intents = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                    field.handleChange(intents.length > 0 ? intents : ["confirm"]);
                  }}
                  onBlur={field.handleBlur}
                  placeholder="confirm, cancel, help"
                  rows={2}
                />
              )}
            </form.Field>
            <p className="text-xs text-muted-foreground">
              List of intents to detect. First match determines the branch.
            </p>
          </div>

          {/* Min Confidence */}
          <div className="space-y-1.5">
            <Label>Min Confidence (0-1)</Label>
            <form.Field name="minConfidence">
              {(field) => (
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={(field.state.value as number) ?? 0.7}
                  onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0.7)}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
          </div>
        </>
      )}

      {/* Note about branches */}
      <div className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
        <p className="font-medium mb-1">Branches:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Yes</strong> - Condition evaluates to true</li>
          <li><strong>No</strong> - Condition evaluates to false</li>
        </ul>
      </div>
    </div>
  );
}
