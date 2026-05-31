/**
 * Transform Node Config
 *
 * Configuration panel for Transform workflow nodes.
 * Uses TanStack Form for explicit save pattern.
 *
 * @module features/nodes/workflow/definitions/transform/transform-node-config
 */

import type { TransformOperation } from "@journey/schemas";
import type { WorkflowNodeEditorProps } from "../../registry/types";
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
import { TRANSFORM_OPERATION_TYPES } from "@/features/agent-workflows/constants/node-config-options";

type OperationType = TransformOperation["type"];

export function TransformNodeConfig({ form }: WorkflowNodeEditorProps) {
  // Subscribe to operationType for conditional rendering
  const operationType = useWorkflowFormFieldValue<OperationType>(form, "operationType") ?? "template";

  const changeOperationType = (type: OperationType) => {
    form.setFieldValue("operationType", type);
    // Reset type-specific fields
    switch (type) {
      case "template":
        form.setFieldValue("template", "");
        form.setFieldValue("sourceVariable", undefined);
        form.setFieldValue("fields", undefined);
        form.setFieldValue("sources", undefined);
        break;
      case "extractJson":
        form.setFieldValue("sourceVariable", "");
        form.setFieldValue("template", undefined);
        form.setFieldValue("fields", undefined);
        form.setFieldValue("sources", undefined);
        break;
      case "pick":
        form.setFieldValue("sourceVariable", "");
        form.setFieldValue("fields", []);
        form.setFieldValue("template", undefined);
        form.setFieldValue("sources", undefined);
        break;
      case "merge":
        form.setFieldValue("sources", []);
        form.setFieldValue("template", undefined);
        form.setFieldValue("sourceVariable", undefined);
        form.setFieldValue("fields", undefined);
        break;
    }
  };

  return (
    <div className="space-y-3">
      {/* Operation Type */}
      <div className="space-y-1.5">
        <Label>Operation Type</Label>
        <Select value={operationType} onValueChange={changeOperationType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRANSFORM_OPERATION_TYPES.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                <div>
                  <div className="font-medium">{op.label}</div>
                  <div className="text-xs text-muted-foreground">{op.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Operation */}
      {operationType === "template" && (
        <div className="space-y-1.5">
          <Label>Template</Label>
          <form.Field name="template">
            {(field) => (
              <Textarea
                value={(field.state.value as string) ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="{{input.field}}"
                rows={6}
                className="font-mono text-sm"
              />
            )}
          </form.Field>
          <p className="text-xs text-muted-foreground">
            Handlebars template. Use {"{{variable}}"} syntax.
          </p>
        </div>
      )}

      {/* Extract JSON Operation */}
      {operationType === "extractJson" && (
        <div className="space-y-1.5">
          <Label>Source Variable</Label>
          <form.Field name="sourceVariable">
            {(field) => (
              <Input
                value={(field.state.value as string) ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="lastAgent.response"
              />
            )}
          </form.Field>
          <p className="text-xs text-muted-foreground">
            Variable containing text with JSON to extract.
          </p>
        </div>
      )}

      {/* Pick Fields Operation */}
      {operationType === "pick" && (
        <>
          <div className="space-y-1.5">
            <Label>Source Variable</Label>
            <form.Field name="sourceVariable">
              {(field) => (
                <Input
                  value={(field.state.value as string) ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="result"
                />
              )}
            </form.Field>
          </div>
          <div className="space-y-1.5">
            <Label>Fields (comma-separated)</Label>
            <form.Field name="fields">
              {(field) => (
                <Input
                  value={((field.state.value as string[]) ?? []).join(", ")}
                  onChange={(e) => {
                    const fields = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                    field.handleChange(fields.length > 0 ? fields : []);
                  }}
                  onBlur={field.handleBlur}
                  placeholder="field1, field2, nested.field"
                />
              )}
            </form.Field>
          </div>
        </>
      )}

      {/* Merge Operation */}
      {operationType === "merge" && (
        <div className="space-y-1.5">
          <Label>Source Variables (comma-separated)</Label>
          <form.Field name="sources">
            {(field) => (
              <Input
                value={((field.state.value as string[]) ?? []).join(", ")}
                onChange={(e) => {
                  const sources = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                  field.handleChange(sources);
                }}
                onBlur={field.handleBlur}
                placeholder="source1, source2, source3"
              />
            )}
          </form.Field>
          <p className="text-xs text-muted-foreground">
            At least 2 variables to merge together.
          </p>
        </div>
      )}

      {/* Output Variable */}
      <div className="space-y-1.5">
        <Label>Output Variable</Label>
        <form.Field name="outputVariable">
          {(field) => (
            <Input
              value={(field.state.value as string) ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="transformed_data"
            />
          )}
        </form.Field>
        <p className="text-xs text-muted-foreground">
          Name of the variable to store the result.
        </p>
      </div>
    </div>
  );
}
