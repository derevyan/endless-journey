/**
 * ConditionNodeEditor Component
 *
 * Editor for Condition node type:
 * - Name
 * - Mode toggle (Visual Rules / Expression)
 * - Visual condition rules builder OR expression editor
 * - Branch info
 * - Metadata (tags, notes)
 * - Advanced (custom JSON)
 */

import { useState, useCallback, useMemo, useEffect } from "react";

import { useNodeEditorContext } from "../../hooks/use-node-editor-context";
import { useNodeEditorForm } from "../../hooks/use-node-editor-form";
import type { ConditionRulesFieldApi, RulesOperatorFieldApi, StringFieldApi } from "../../forms/form-types";
import type { ConditionRule, ConditionNodeData } from "@journey/schemas";

import { ConditionBuilder } from "../../editors/sections/condition-builder";
import { ExpressionSection } from "../../editors/sections/expression-section";
import { EditorBase } from "../../editors/editor-base";
import { EditorNameField } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import type { NodeEditorProps } from "../../editors/types";

type ConditionMode = "rules" | "expression";

/**
 * Determine the initial mode based on node data.
 * If expression exists and has content, use expression mode.
 */
function getInitialMode(nodeData: ConditionNodeData): ConditionMode {
  const expression = nodeData.expression;
  return expression && expression.trim() ? "expression" : "rules";
}

export function ConditionNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);
  const { journeyUuid, nodes, edges } = useNodeEditorContext();

  // Determine initial mode based on existing node data (not form state)
  const initialMode = useMemo(
    () => getInitialMode(node.data as ConditionNodeData),
    [node.data]
  );

  const [mode, setMode] = useState<ConditionMode>(initialMode);

  // Update mode when node changes (e.g., reopening the same node after save)
  useEffect(() => {
    setMode(getInitialMode(node.data as ConditionNodeData));
  }, [node.id, node.data]);

  // Handle mode switching
  const handleModeChange = useCallback(
    (newMode: string) => {
      if (newMode === mode) return;
      setMode(newMode as ConditionMode);
    },
    [mode]
  );

  // Cancel handler: reset form (does not close editor)
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  return (
    <EditorBase
      title={readOnly ? "Condition Node Info" : "Edit Condition Node"}
      nodeId={node.id}
      onClose={onClose}
      onDelete={onDelete}
      onAutoSaveClose={validateAndSave}
      onSave={validateAndSave}
      onCancel={handleCancel}
      isSaving={isSaving}
      isDirty={isDirty}
      readOnly={readOnly}
    >
      {/* 1. Name */}
      <EditorNameField form={form} nodeId={node.id} readOnly={readOnly} />

      {/* 2. Mode Toggle + Condition Editor */}
      <Tabs value={mode} onValueChange={handleModeChange} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="rules" className="flex-1">
            Visual Rules
          </TabsTrigger>
          <TabsTrigger value="expression" className="flex-1">
            Expression
          </TabsTrigger>
        </TabsList>

        {/* Visual Rules Mode */}
        <TabsContent value="rules" className="mt-3">
          <form.Field name="rules">
            {(rulesField: ConditionRulesFieldApi) => (
              <form.Field name="rulesOperator">
                {(operatorField: RulesOperatorFieldApi) => (
                  <ConditionBuilder
                    rules={(rulesField.state.value as ConditionRule[]) || []}
                    rulesOperator={(operatorField.state.value as "and" | "or") || "and"}
                    onChange={(rules, rulesOperator) => {
                      rulesField.handleChange(rules);
                      operatorField.handleChange(rulesOperator);
                    }}
                    nodeId={node.id}
                    nodes={nodes}
                    edges={edges}
                    readOnly={readOnly}
                    journeyId={journeyUuid}
                  />
                )}
              </form.Field>
            )}
          </form.Field>
        </TabsContent>

        {/* Expression Mode */}
        <TabsContent value="expression" className="mt-3">
          <form.Field name="expression">
            {(expressionField: StringFieldApi) => (
              <ExpressionSection
                value={expressionField.state.value || ""}
                onChange={expressionField.handleChange}
                nodeId={node.id}
                nodes={nodes}
                edges={edges}
                journeyId={journeyUuid}
                readOnly={readOnly}
              />
            )}
          </form.Field>
        </TabsContent>
      </Tabs>

      {/* 3. Branch Info */}
      <div className="p-3 bg-muted/30 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Branches:</strong> Connect edges from this node to define outcomes.{" "}
          {mode === "rules"
            ? 'The "Yes" branch is taken when rules match, "No" when they don\'t.'
            : "The expression result determines which branch is taken."}
        </p>
      </div>

      {/* 4. Common Sections (Tags, Variables, Metadata, Advanced) */}
      <EditorCommonSections form={form} nodeId={node.id} nodeType={node.data.type} readOnly={readOnly} validationErrors={validationErrors} />
    </EditorBase>
  );
}
