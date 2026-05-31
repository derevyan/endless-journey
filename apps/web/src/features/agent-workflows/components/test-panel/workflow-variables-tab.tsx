/**
 * Workflow Variables Tab
 *
 * Displays workflow-declared variables with input fields for testing.
 * Variables are passed as mockContext.variables during workflow execution.
 *
 * @module features/agent-workflows/components/test-panel/workflow-variables-tab
 */

import { memo, useCallback } from "react";
import { useStore } from "@tanstack/react-store";
import { Variable, Trash2, AlertCircle } from "lucide-react";

import type { WorkflowVariable } from "@journey/schemas";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Badge } from "@/shared/components/ui/badges";
import { cn } from "@/shared/lib/utils";
import { useAgentWorkflow } from "../../hooks";
import { agentWorkflowStore } from "../../stores/agent-workflow-store";
import { agentTestStore, agentTestActions } from "../../stores/agent-test-store";

// =============================================================================
// TYPES
// =============================================================================

interface VariableInputProps {
  variable: WorkflowVariable;
  value: unknown;
  onChange: (value: unknown) => void;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * Input field for a single variable, adapted to the variable type
 */
const VariableInput = memo(function VariableInput({ variable, value, onChange }: VariableInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;

      switch (variable.type) {
        case "number":
          // Allow empty string for clearing
          onChange(rawValue === "" ? undefined : Number(rawValue));
          break;
        case "boolean":
          // Handled by Switch component
          break;
        default:
          onChange(rawValue || undefined);
      }
    },
    [variable.type, onChange]
  );

  const handleBooleanChange = useCallback(
    (checked: boolean) => {
      onChange(checked);
    },
    [onChange]
  );

  // Boolean type uses Switch
  if (variable.type === "boolean") {
    return (
      <Switch
        checked={Boolean(value)}
        onCheckedChange={handleBooleanChange}
        aria-label={variable.name}
      />
    );
  }

  // Object/array types use JSON input
  if (variable.type === "object" || variable.type === "array") {
    return (
      <Input
        type="text"
        value={typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            // Keep as string if invalid JSON
            onChange(e.target.value || undefined);
          }
        }}
        placeholder={variable.type === "array" ? '["item1", "item2"]' : '{"key": "value"}'}
        className="font-mono text-xs"
      />
    );
  }

  // Number and string types use regular input
  return (
    <Input
      type={variable.type === "number" ? "number" : "text"}
      value={value === undefined ? "" : String(value)}
      onChange={handleChange}
      placeholder={variable.defaultValue !== undefined ? String(variable.defaultValue) : `Enter ${variable.type}`}
    />
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * WorkflowVariablesTab - Panel showing workflow-declared variables with inputs
 */
export const WorkflowVariablesTab = memo(function WorkflowVariablesTab() {
  const workflowKey = useStore(agentWorkflowStore, (s) => s.workflowKey);
  const testVariables = useStore(agentTestStore, (s) => s.testVariables);
  const { data: workflow, isLoading } = useAgentWorkflow(workflowKey ?? undefined);

  const workflowVariables = workflow?.configuration.variables;

  const handleVariableChange = useCallback((name: string, value: unknown) => {
    if (value === undefined) {
      // Remove the variable if undefined
      const { [name]: _, ...rest } = agentTestStore.state.testVariables;
      agentTestActions.setTestVariables(rest);
    } else {
      agentTestActions.setTestVariable(name, value);
    }
  }, []);

  const handleClearAll = useCallback(() => {
    agentTestActions.clearTestVariables();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading variables...
      </div>
    );
  }

  // No workflow
  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4">
        <AlertCircle className="size-6 mb-2 opacity-50" />
        <p>No workflow loaded</p>
      </div>
    );
  }

  // No variables declared
  if (!workflowVariables?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4">
        <Variable className="size-6 mb-2 opacity-50" />
        <p>No variables declared</p>
        <p className="text-xs mt-1">Add variables in workflow configuration</p>
      </div>
    );
  }

  const hasValues = Object.keys(testVariables).length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Variable className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Test Variables</span>
          <Badge variant="secondary" className="text-xs">
            {workflowVariables.length}
          </Badge>
        </div>
        {hasValues && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Variable List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {workflowVariables.map((variable) => (
          <div key={variable.name} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor={`var-${variable.name}`} className="text-sm font-medium">
                {variable.name}
              </Label>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  variable.type === "string" && "text-green-600 border-green-200",
                  variable.type === "number" && "text-blue-600 border-blue-200",
                  variable.type === "boolean" && "text-purple-600 border-purple-200",
                  variable.type === "object" && "text-orange-600 border-orange-200",
                  variable.type === "array" && "text-cyan-600 border-cyan-200"
                )}
              >
                {variable.type}
              </Badge>
            </div>
            {variable.description && (
              <p className="text-xs text-muted-foreground">{variable.description}</p>
            )}
            <VariableInput
              variable={variable}
              value={testVariables[variable.name]}
              onChange={(value) => handleVariableChange(variable.name, value)}
            />
          </div>
        ))}
      </div>

      {/* Footer hint */}
      {hasValues && (
        <div className="px-3 py-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Variables will be passed as <code className="font-mono">mockContext.variables</code> during execution
          </p>
        </div>
      )}
    </div>
  );
});
