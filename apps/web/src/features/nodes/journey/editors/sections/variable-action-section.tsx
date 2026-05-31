/**
 * VariableActionSection Component
 *
 * Collapsible section for configuring variable operations on nodes.
 * Supports three scopes:
 * - Journey: Variables specific to this journey (stored in DB)
 * - Global: Organization-wide variables (stored in DB)
 * - User: User-specific variables (stored in session context, like tags)
 *
 * Operations supported:
 * - set: Set a variable to a value
 * - delete: Remove a variable
 * - increment: Add to a number
 * - decrement: Subtract from a number
 * - push: Add to an array
 * - pop: Remove last from array
 * - merge: Merge into an object
 */

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Database,
  GitMerge,
  Globe,
  ListEnd,
  ListStart,
  Plus,
  Route,
  Trash2,
  User,
  Variable,
} from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { TemplateProvider } from "@/shared/components/ui/template-context";
import { TemplateInput } from "@/shared/components/ui/template-input";
import { TemplateTextarea } from "@/shared/components/ui/template-textarea";
import { appConfig } from "@/shared/lib/app-config";
import { cn } from "@/shared/lib/utils";
import { generateShortId } from "@/shared/lib/utils/id";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import {
  sectionRegistry,
  type SectionDefinition,
} from "../../registry/section-registry";
import type { NodeEditorFormApi } from "../../forms/form-types";
import type { VariableOperationFormValue, VariableActionFormValue } from "../../forms/node-form-builders";

import { ScopedVariablesPreview } from "./active-variables-preview";

// =============================================================================
// TYPES
// =============================================================================

type OperationType = VariableOperationFormValue["op"];
type VariableScope = "journey" | "global" | "user";

interface VariableActionSectionProps {
  form: NodeEditorFormApi;
  nodeId: string;
  readOnly?: boolean;
  journeyId?: string | null;
  nodes?: JourneyNode[];
  edges?: JourneyEdge[];
  /** Validation errors from form-level validation (path -> message) */
  validationErrors?: Map<string, string>;
}

// =============================================================================
// OPERATION CONFIG
// =============================================================================

const OPERATION_CONFIG: Record<
  OperationType,
  {
    label: string;
    icon: React.ReactNode;
    hasValue: boolean;
    hasAmount: boolean;
    description: string;
    placeholder?: string;
  }
> = {
  set: {
    label: "Set",
    icon: <Variable className="h-3.5 w-3.5" />,
    hasValue: true,
    hasAmount: false,
    description: "Set variable to a value",
    placeholder: '"hello" or 42 or true',
  },
  delete: {
    label: "Delete",
    icon: <Trash2 className="h-3.5 w-3.5" />,
    hasValue: false,
    hasAmount: false,
    description: "Remove the variable",
  },
  increment: {
    label: "Increment",
    icon: <ArrowUp className="h-3.5 w-3.5" />,
    hasValue: false,
    hasAmount: true,
    description: "Add to a number",
  },
  decrement: {
    label: "Decrement",
    icon: <ArrowDown className="h-3.5 w-3.5" />,
    hasValue: false,
    hasAmount: true,
    description: "Subtract from a number",
  },
  push: {
    label: "Push",
    icon: <ListEnd className="h-3.5 w-3.5" />,
    hasValue: true,
    hasAmount: false,
    description: "Add item to array",
    placeholder: '"new item" or {"key": "value"}',
  },
  pop: {
    label: "Pop",
    icon: <ListStart className="h-3.5 w-3.5" />,
    hasValue: false,
    hasAmount: false,
    description: "Remove last item from array",
  },
  merge: {
    label: "Merge",
    icon: <GitMerge className="h-3.5 w-3.5" />,
    hasValue: true,
    hasAmount: false,
    description: "Merge into an object",
    placeholder: '{"newKey": "newValue"}',
  },
};

// =============================================================================
// OPERATION ROW COMPONENT
// =============================================================================

interface OperationRowProps {
  operation: VariableOperationFormValue;
  index: number;
  onChange: (index: number, operation: VariableOperationFormValue) => void;
  onRemove: (index: number) => void;
  readOnly?: boolean;
  nodeId: string;
  nodes?: JourneyNode[];
  edges?: JourneyEdge[];
  journeyId?: string | null;
  /** Error message for the key field */
  keyError?: string;
  /** Error message for the value field */
  valueError?: string;
}

function OperationRow({ operation, index, onChange, onRemove, readOnly, nodeId, nodes, edges, journeyId, keyError, valueError }: OperationRowProps) {
  const config = OPERATION_CONFIG[operation.op];
  const hasAutocomplete = nodes && edges;

  const handleOpChange = (op: OperationType) => {
    const newOp: VariableOperationFormValue = { id: operation.id, op, key: operation.key };
    if (OPERATION_CONFIG[op].hasValue) {
      newOp.value = operation.value ?? "";
    }
    if (OPERATION_CONFIG[op].hasAmount) {
      newOp.amount = operation.amount ?? 1;
    }
    onChange(index, newOp);
  };

  const handleKeyChange = (key: string) => {
    onChange(index, { ...operation, key });
  };

  const handleValueChange = (value: string) => {
    // Try to parse as JSON, otherwise use string
    let parsedValue: unknown = value;
    if (operation.op === "merge") {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }
    } else if (operation.op === "set" || operation.op === "push") {
      // Try to parse numbers and booleans
      if (value === "true") parsedValue = true;
      else if (value === "false") parsedValue = false;
      else if (!isNaN(Number(value)) && value.trim() !== "") parsedValue = Number(value);
      else {
        try {
          parsedValue = JSON.parse(value);
        } catch {
          parsedValue = value;
        }
      }
    }
    onChange(index, { ...operation, value: parsedValue });
  };

  const handleAmountChange = (amount: string) => {
    onChange(index, { ...operation, amount: Number(amount) || 1 });
  };

  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  };

  return (
    <div className="rounded-lg border bg-card/50 p-3 space-y-3">
      {/* Header: Operation Type + Key + Delete */}
      <div className="flex items-start gap-2">
        <Select value={operation.op} onValueChange={handleOpChange} disabled={readOnly}>
          <SelectTrigger className="h-8 w-[130px] text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(OPERATION_CONFIG).map(([op, cfg]) => (
              <SelectItem key={op} value={op}>
                <span className="flex items-center gap-2">
                  {cfg.icon}
                  <span>{cfg.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1 space-y-1">
          <Input
            value={operation.key}
            onChange={(e) => handleKeyChange(e.target.value)}
            placeholder="variable_name"
            className="h-8 text-xs font-mono"
            disabled={readOnly}
            hasError={!!keyError}
          />
          {keyError && <p className="text-xs text-destructive">{keyError}</p>}
        </div>

        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Value Field - for set, push, merge */}
      {config.hasValue && (
        <div className="space-y-1">
          {operation.op === "merge" ? (
            hasAutocomplete ? (
              <TemplateProvider nodeId={nodeId} nodes={nodes} edges={edges} journeyId={journeyId ?? null}>
                <TemplateTextarea
                  value={formatValue(operation.value)}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder={config.placeholder}
                  className="min-h-[60px] text-xs font-mono resize-none"
                  disabled={readOnly}
                  hasError={!!valueError}
                />
              </TemplateProvider>
            ) : (
              <textarea
                value={formatValue(operation.value)}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder={config.placeholder}
                className={cn(
                  "min-h-[60px] text-xs font-mono resize-none w-full rounded-md border border-input bg-background px-3 py-2",
                  valueError && "border-destructive focus-visible:ring-destructive"
                )}
                disabled={readOnly}
              />
            )
          ) : hasAutocomplete ? (
            <TemplateProvider nodeId={nodeId} nodes={nodes} edges={edges} journeyId={journeyId ?? null}>
              <TemplateInput
                value={formatValue(operation.value)}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder={config.placeholder}
                variant="compact"
                disabled={readOnly}
                hasError={!!valueError}
              />
            </TemplateProvider>
          ) : (
            <Input
              value={formatValue(operation.value)}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder={config.placeholder}
              className="h-8 text-xs font-mono"
              disabled={readOnly}
              hasError={!!valueError}
            />
          )}
          {valueError && <p className="text-xs text-destructive">{valueError}</p>}
        </div>
      )}

      {/* Amount Field - for increment, decrement */}
      {config.hasAmount && (
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">By:</Label>
          <Input
            type="number"
            value={operation.amount ?? 1}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="1"
            className="h-8 w-20 text-xs"
            disabled={readOnly}
          />
        </div>
      )}

      {/* Description */}
      <p className="text-[10px] text-muted-foreground">{config.description}</p>
    </div>
  );
}

// =============================================================================
// SCOPE SECTION COMPONENT
// =============================================================================

interface ScopeSectionProps {
  scope: VariableScope;
  operations: VariableOperationFormValue[];
  onOperationsChange: (operations: VariableOperationFormValue[]) => void;
  readOnly?: boolean;
  defaultOpen?: boolean;
  journeyId?: string | null;
  nodeId: string;
  nodes?: JourneyNode[];
  edges?: JourneyEdge[];
  /** Validation errors from form-level validation (path -> message) */
  validationErrors?: Map<string, string>;
}

function ScopeSection({ scope, operations, onOperationsChange, readOnly, defaultOpen = false, journeyId, nodeId, nodes, edges, validationErrors }: ScopeSectionProps) {
  const [open, setOpen] = useState(defaultOpen || operations.length > 0);

  // Helper to get key error for a specific operation by index
  const getKeyError = (index: number): string | undefined => {
    if (!validationErrors) return undefined;
    const path = `variableAction.${scope}Operations.${index}.key`;
    return validationErrors.get(path);
  };

  // Helper to get value error for a specific operation by index
  const getValueError = (index: number): string | undefined => {
    if (!validationErrors) return undefined;
    const path = `variableAction.${scope}Operations.${index}.value`;
    return validationErrors.get(path);
  };

  const handleAddOperation = () => {
    onOperationsChange([
      ...operations,
      { id: generateShortId("var-op"), op: "set", key: "", value: "" },
    ]);
  };

  const handleOperationChange = (index: number, operation: VariableOperationFormValue) => {
    const newOps = [...operations];
    newOps[index] = operation;
    onOperationsChange(newOps);
  };

  const handleRemoveOperation = (index: number) => {
    onOperationsChange(operations.filter((_, i) => i !== index));
  };

  // Scope-specific configuration
  const scopeConfig: Record<VariableScope, { icon: typeof Route; title: string; description: string; emptyLabel: string }> = {
    journey: {
      icon: Route,
      title: "Journey Variables",
      description: "Variables scoped to this journey only",
      emptyLabel: "journey",
    },
    global: {
      icon: Globe,
      title: "Global Variables",
      description: "Variables shared across all journeys in your organization",
      emptyLabel: "global",
    },
    user: {
      icon: User,
      title: "User Variables",
      description: "User-specific variables (points, badges, counters) that follow the user",
      emptyLabel: "user",
    },
  };

  const config = scopeConfig[scope];
  const Icon = config.icon;

  return (
    <CollapsibleSection
      open={open}
      onOpenChange={setOpen}
      icon={Icon}
      label={config.title}
      size="sm"
      badge={operations.length > 0 ? operations.length : undefined}
      paddingClass={appConfig.editor.padding.nested}
      contentClassName="space-y-2"
    >
        <p className="text-[10px] text-muted-foreground">{config.description}</p>

        {/* Available Variables Preview for this scope */}
        <ScopedVariablesPreview scope={scope} journeyId={journeyId} />

        {operations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-4 text-center">
            <Database className="mb-1.5 h-6 w-6 text-muted-foreground/40" />
            <p className="text-[10px] text-muted-foreground">No {config.emptyLabel} operations</p>
            {!readOnly && (
              <Button type="button" variant="ghost" size="sm" className="mt-1.5 h-6 text-[10px]" onClick={handleAddOperation}>
                <Plus className="h-3 w-3 mr-1" />
                Add operation
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {operations.map((operation, index) => (
              <OperationRow
                key={operation.id}
                operation={operation}
                index={index}
                onChange={handleOperationChange}
                onRemove={handleRemoveOperation}
                readOnly={readOnly}
                nodeId={nodeId}
                nodes={nodes}
                edges={edges}
                journeyId={journeyId}
                keyError={getKeyError(index)}
                valueError={getValueError(index)}
              />
            ))}
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleAddOperation}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add {config.emptyLabel} operation
              </Button>
            )}
          </div>
        )}
    </CollapsibleSection>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VariableActionSection({ form, nodeId, readOnly = false, journeyId, nodes, edges, validationErrors }: VariableActionSectionProps) {
  const [open, setOpen] = useState(() => {
    // Open by default if there are already operations configured
    const variableAction = form.getFieldValue("variableAction") as VariableActionFormValue | undefined;
    return !!(
      variableAction?.journeyOperations?.length ||
      variableAction?.globalOperations?.length ||
      variableAction?.userOperations?.length
    );
  });

  // Get or initialize variableAction
  const getVariableAction = (): VariableActionFormValue => {
    const current = form.getFieldValue("variableAction") as VariableActionFormValue | undefined;
    return current || { journeyOperations: [], globalOperations: [], userOperations: [] };
  };

  const handleJourneyOperationsChange = (operations: VariableOperationFormValue[]) => {
    const variableAction = getVariableAction();
    form.setFieldValue("variableAction", {
      ...variableAction,
      journeyOperations: operations,
    });
  };

  const handleGlobalOperationsChange = (operations: VariableOperationFormValue[]) => {
    const variableAction = getVariableAction();
    form.setFieldValue("variableAction", {
      ...variableAction,
      globalOperations: operations,
    });
  };

  const handleUserOperationsChange = (operations: VariableOperationFormValue[]) => {
    const variableAction = getVariableAction();
    form.setFieldValue("variableAction", {
      ...variableAction,
      userOperations: operations,
    });
  };

  return (
    <CollapsibleSection open={open} onOpenChange={setOpen} icon={Database} label="Variables" paddingClass={appConfig.editor.padding.main} contentClassName="space-y-4">
        <p className="text-xs text-muted-foreground">
          Configure variable operations when users reach this node.
        </p>

        {/* User Variables Section - Most common, shown first */}
        <form.Field name="variableAction">
          {(field: { state: { value: VariableActionFormValue | undefined } }) => {
            const userOps = field.state.value?.userOperations || [];
            return (
              <ScopeSection
                scope="user"
                operations={userOps}
                onOperationsChange={handleUserOperationsChange}
                readOnly={readOnly}
                defaultOpen={true}
                journeyId={journeyId}
                nodeId={nodeId}
                nodes={nodes}
                edges={edges}
                validationErrors={validationErrors}
              />
            );
          }}
        </form.Field>

        {/* Journey Variables Section */}
        <form.Field name="variableAction">
          {(field: { state: { value: VariableActionFormValue | undefined } }) => {
            const journeyOps = field.state.value?.journeyOperations || [];
            return (
              <ScopeSection
                scope="journey"
                operations={journeyOps}
                onOperationsChange={handleJourneyOperationsChange}
                readOnly={readOnly}
                journeyId={journeyId}
                nodeId={nodeId}
                nodes={nodes}
                edges={edges}
                validationErrors={validationErrors}
              />
            );
          }}
        </form.Field>

        {/* Global Variables Section */}
        <form.Field name="variableAction">
          {(field: { state: { value: VariableActionFormValue | undefined } }) => {
            const globalOps = field.state.value?.globalOperations || [];
            return (
              <ScopeSection
                scope="global"
                operations={globalOps}
                onOperationsChange={handleGlobalOperationsChange}
                readOnly={readOnly}
                journeyId={journeyId}
                nodeId={nodeId}
                nodes={nodes}
                edges={edges}
                validationErrors={validationErrors}
              />
            );
          }}
        </form.Field>
    </CollapsibleSection>
  );
}

// =============================================================================
// SECTION DEFINITION
// =============================================================================

export const variableActionSectionDefinition = {
  id: "variable-actions",
  label: "Variable Actions",
  component: VariableActionSection,
  scope: "common",
  shouldRender: (_node, caps) => caps.hasVariableAssignment === true,
  order: 20,
} as const satisfies SectionDefinition;

// Self-register on import
sectionRegistry.register(variableActionSectionDefinition);
