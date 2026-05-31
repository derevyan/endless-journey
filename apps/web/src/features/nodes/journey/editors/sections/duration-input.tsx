/**
 * DurationInput Component
 *
 * Reusable duration input with 4 fields: Days, Hours, Minutes, Seconds.
 * Used by message-node-editor (timer) and wait-node-editor (duration).
 */

import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { NodeEditorFormApi, NumberFieldApi } from "../../forms/form-types";

interface DurationFieldProps {
  nodeId: string;
  fieldName: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur: () => void;
  min?: number;
  max?: number;
  readOnly?: boolean;
}

function DurationField({ nodeId, fieldName, label, value, onChange, onBlur, min = 0, max, readOnly = false }: DurationFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`${fieldName}-${nodeId}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`${fieldName}-${nodeId}`}
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
        onBlur={onBlur}
        placeholder="0"
        className="h-8 text-sm"
        disabled={readOnly}
      />
    </div>
  );
}

interface DurationInputProps {
  nodeId: string;
  /** Field name prefix for IDs (e.g., "timer" or "duration") */
  fieldPrefix: string;
  /** TanStack Form instance */
  form: NodeEditorFormApi;
  readOnly?: boolean;
}

/**
 * Duration input component with 4 fields: Days, Hours, Minutes, Seconds
 *
 * Expects form fields named: `${fieldPrefix}Days`, `${fieldPrefix}Hours`,
 * `${fieldPrefix}Minutes`, `${fieldPrefix}Seconds`
 */
export function DurationInput({ nodeId, fieldPrefix, form, readOnly = false }: DurationInputProps) {
  const daysField = `${fieldPrefix}Days`;
  const hoursField = `${fieldPrefix}Hours`;
  const minutesField = `${fieldPrefix}Minutes`;
  const secondsField = `${fieldPrefix}Seconds`;

  return (
    <div className="grid grid-cols-4 gap-2">
      <form.Field name={daysField}>
        {(field: NumberFieldApi) => (
          <DurationField
            nodeId={nodeId}
            fieldName={daysField}
            label="Days"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            min={0}
            readOnly={readOnly}
          />
        )}
      </form.Field>
      <form.Field name={hoursField}>
        {(field: NumberFieldApi) => (
          <DurationField
            nodeId={nodeId}
            fieldName={hoursField}
            label="Hours"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            min={0}
            max={23}
            readOnly={readOnly}
          />
        )}
      </form.Field>
      <form.Field name={minutesField}>
        {(field: NumberFieldApi) => (
          <DurationField
            nodeId={nodeId}
            fieldName={minutesField}
            label="Min"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            min={0}
            max={59}
            readOnly={readOnly}
          />
        )}
      </form.Field>
      <form.Field name={secondsField}>
        {(field: NumberFieldApi) => (
          <DurationField
            nodeId={nodeId}
            fieldName={secondsField}
            label="Sec"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            min={0}
            max={59}
            readOnly={readOnly}
          />
        )}
      </form.Field>
    </div>
  );
}
