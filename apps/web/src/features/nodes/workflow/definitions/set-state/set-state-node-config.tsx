/**
 * Set State Node Config
 *
 * Configuration panel for Set State workflow nodes.
 * Uses TanStack Form for explicit save pattern.
 *
 * @module features/nodes/workflow/definitions/set-state/set-state-node-config
 */

import type { WorkflowNodeEditorProps } from "../../registry/types";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useWorkflowFormFieldValue } from "@/features/nodes/workflow/hooks/use-workflow-node-form";

type ValueType = "string" | "number" | "boolean" | "null";

export function SetStateNodeConfig({ form }: WorkflowNodeEditorProps) {
  // Subscribe to value and isTemplate for conditional rendering
  const value = useWorkflowFormFieldValue<string | number | boolean | null>(form, "value");
  const isTemplate = useWorkflowFormFieldValue<boolean>(form, "isTemplate") ?? false;

  // Detect value type
  const getValueType = (): ValueType => {
    if (value === null) return "null";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number") return "number";
    return "string";
  };

  const valueType = getValueType();

  const handleValueTypeChange = (type: ValueType) => {
    form.setFieldValue("isTemplate", false);
    switch (type) {
      case "boolean":
        form.setFieldValue("value", true);
        break;
      case "number":
        form.setFieldValue("value", 0);
        break;
      case "null":
        form.setFieldValue("value", null);
        break;
      default:
        form.setFieldValue("value", "");
    }
  };

  const handleTemplateToggle = (checked: boolean) => {
    form.setFieldValue("isTemplate", checked);
    form.setFieldValue("value", checked ? "{{input}}" : "");
  };

  return (
    <div className="space-y-3">
      {/* Variable Key */}
      <div className="space-y-1.5">
        <Label>Variable Name</Label>
        <form.Field name="key">
          {(field) => (
            <Input
              value={(field.state.value as string) ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="my_variable"
            />
          )}
        </form.Field>
        <p className="text-xs text-muted-foreground">
          Name of the workflow variable to set. Must start with a letter.
        </p>
      </div>

      {/* Is Template Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label>Use Template</Label>
          <p className="text-xs text-muted-foreground">
            Treat value as Handlebars template
          </p>
        </div>
        <Switch
          checked={isTemplate}
          onCheckedChange={handleTemplateToggle}
        />
      </div>

      {isTemplate ? (
        /* Template Mode */
        <div className="space-y-1.5">
          <Label>Template</Label>
          <form.Field name="value">
            {(field) => (
              <Textarea
                value={String(field.state.value ?? "")}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="{{input.field}}"
                className="font-mono text-sm"
                rows={3}
              />
            )}
          </form.Field>
          <p className="text-xs text-muted-foreground">
            Use {"{{variable}}"} syntax to reference other values.
          </p>
        </div>
      ) : (
        <>
          {/* Value Type */}
          <div className="space-y-1.5">
            <Label>Value Type</Label>
            <Select value={valueType} onValueChange={handleValueTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="null">Null</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Value Input */}
          {valueType === "boolean" ? (
            <div className="space-y-1.5">
              <Label>Value</Label>
              <form.Field name="value">
                {(field) => (
                  <Select
                    value={String(field.state.value)}
                    onValueChange={(val) => field.handleChange(val === "true")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">true</SelectItem>
                      <SelectItem value="false">false</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </form.Field>
            </div>
          ) : valueType === "number" ? (
            <div className="space-y-1.5">
              <Label>Value</Label>
              <form.Field name="value">
                {(field) => (
                  <Input
                    type="number"
                    value={Number(field.state.value) || 0}
                    onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
            </div>
          ) : valueType === "null" ? (
            <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
              Value will be set to <code className="font-mono">null</code>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Value</Label>
              <form.Field name="value">
                {(field) => (
                  <Input
                    value={String(field.state.value ?? "")}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Enter value"
                  />
                )}
              </form.Field>
            </div>
          )}
        </>
      )}
    </div>
  );
}
