/**
 * ExpressionSection Component
 *
 * Expression editor for condition nodes with:
 * - Template textarea with variable autocomplete ({{var}})
 * - Live syntax validation
 * - Function reference panel
 *
 * Follows the pattern from guard-section.tsx for expression editing.
 */

import { useState, useMemo } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Code2 } from "lucide-react";

import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { ExpressionEditor } from "@/shared/components/ui/codemirror";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { Label } from "@/shared/components/ui/label";
import { TemplateProvider } from "@/shared/components/ui/template-context";

interface ExpressionSectionProps {
  value: string;
  onChange: (value: string) => void;
  nodeId: string;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  journeyId: string | null;
  readOnly?: boolean;
}

/**
 * Available expression functions for reference panel
 */
const FUNCTION_REFERENCE = [
  { category: "String", functions: ["upper(str)", "lower(str)", "trim(str)", "capitalize(str)", "length(str)"] },
  { category: "Array", functions: ["first(arr)", "last(arr)", "join(arr, sep)", "includes(arr, val)"] },
  { category: "Number", functions: ["round(num)", "floor(num)", "ceil(num)", "abs(num)"] },
  { category: "Conditional", functions: ["default(val, fallback)", "isEmpty(val)"] },
  { category: "Date", functions: ["now()", "formatDate(date, format)"] },
];

/**
 * Simple client-side expression validation
 * Checks for common syntax errors without requiring the full JEXL engine
 */
function validateExpressionSyntax(expression: string): { valid: boolean; error?: string } {
  if (!expression.trim()) {
    return { valid: true }; // Empty is valid (will use default branch)
  }

  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of expression) {
    if (char === "(") parenCount++;
    if (char === ")") parenCount--;
    if (parenCount < 0) {
      return { valid: false, error: "Unmatched closing parenthesis" };
    }
  }
  if (parenCount !== 0) {
    return { valid: false, error: "Unmatched opening parenthesis" };
  }

  // Check for balanced quotes
  const singleQuotes = (expression.match(/'/g) || []).length;
  const doubleQuotes = (expression.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    return { valid: false, error: "Unmatched single quote" };
  }
  if (doubleQuotes % 2 !== 0) {
    return { valid: false, error: "Unmatched double quote" };
  }

  // Check for common operator errors
  if (/[&|]{3,}/.test(expression)) {
    return { valid: false, error: "Invalid operator sequence" };
  }

  return { valid: true };
}

export function ExpressionSection({
  value,
  onChange,
  nodeId,
  nodes,
  edges,
  journeyId,
  readOnly,
}: ExpressionSectionProps) {
  const [isFunctionRefOpen, setIsFunctionRefOpen] = useState(false);

  // Validate expression on each change
  const validation = useMemo(() => validateExpressionSyntax(value), [value]);

  return (
    <div className="space-y-3">
      {/* Expression Textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            Expression
          </Label>
          {value.trim() && (
            <div className="flex items-center gap-1 text-xs">
              {validation.valid ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-600">Valid</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-destructive">{validation.error}</span>
                </>
              )}
            </div>
          )}
        </div>

        <TemplateProvider nodeId={nodeId} nodes={nodes} edges={edges} journeyId={journeyId}>
          <ExpressionEditor
            value={value}
            onChange={onChange}
            placeholder="e.g., user.score > 50 && session.tags.includes('vip')"
            minHeight={100}
            hasError={!validation.valid && value.trim().length > 0}
            disabled={readOnly}
          />
        </TemplateProvider>

        <p className="text-[10px] text-muted-foreground">
          JavaScript-like expression. Type {"{{" } for variable autocomplete. Returns true/false for branch routing, or
          a string matching a branch label.
        </p>
      </div>

      {/* Function Reference Panel */}
      <Collapsible open={isFunctionRefOpen} onOpenChange={setIsFunctionRefOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {isFunctionRefOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Available Functions
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="p-3 bg-muted/30 rounded-lg space-y-2">
            {FUNCTION_REFERENCE.map((group) => (
              <div key={group.category}>
                <p className="text-[10px] font-medium text-muted-foreground mb-1">{group.category}</p>
                <div className="flex flex-wrap gap-1">
                  {group.functions.map((fn) => (
                    <code
                      key={fn}
                      className="text-[10px] bg-background px-1.5 py-0.5 rounded border font-mono"
                      title={`Click to insert ${fn}`}
                    >
                      {fn}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Expression Examples */}
      <div className="p-3 bg-muted/20 rounded-lg">
        <p className="text-[10px] font-medium text-muted-foreground mb-2">Examples</p>
        <div className="space-y-1.5 text-[10px] font-mono text-muted-foreground">
          <p>
            <span className="text-foreground">user.score {">"} 50</span> — Numeric comparison
          </p>
          <p>
            <span className="text-foreground">session.tags.includes('vip')</span> — Array contains
          </p>
          <p>
            <span className="text-foreground">user.verified && user.age {">="} 18</span> — Multiple conditions
          </p>
          <p>
            <span className="text-foreground">user.plan === 'pro' ? 'premium' : 'basic'</span> — Ternary (returns branch
            label)
          </p>
        </div>
      </div>
    </div>
  );
}
