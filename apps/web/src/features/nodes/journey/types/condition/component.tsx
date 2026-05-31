/**
 * ConditionNode Component
 *
 * Branch based on user data or expressions.
 */

import { GitBranch } from "lucide-react";
import { memo } from "react";

import type { ConditionNodeData } from "@/features/nodes/journey/react-flow-types";
import { NodeTypeEnum } from "@/features/nodes/journey/react-flow-types";
import { BaseNode } from "../../components/base-node";

interface ConditionNodeProps {
  data: ConditionNodeData;
}

export const ConditionNode = memo(function ConditionNode({ data }: ConditionNodeProps) {
  const hasExpression = data.expression && data.expression.trim().length > 0;
  const hasRules = data.rules && data.rules.length > 0;

  return (
    <BaseNode
      nodeType={NodeTypeEnum.CONDITION}
      label={data.label}
      outputHandles={data.branches.map((b) => ({ id: b.id, label: b.label }))}
    >
      {/* Expression preview */}
      {hasExpression && <div className="text-[11px] font-mono bg-muted/50 rounded px-2 py-1 text-muted-foreground truncate">{data.expression}</div>}

      {/* Rules preview */}
      {hasRules && !hasExpression && (
        <div className="text-[11px] text-muted-foreground">
          {data.rules!.length} rule{data.rules!.length !== 1 ? "s" : ""} ({data.rulesOperator || "and"})
        </div>
      )}

      {/* Branches */}
      <div className="flex flex-wrap gap-1 mt-1">
        {data.branches.map((branch) => (
          <span
            key={branch.id}
            className={`text-[10px] px-2 py-0.5 rounded-md border ${
              branch.isDefault ? "bg-muted/50 border-muted-foreground/20 text-muted-foreground" : "bg-accent border-accent-foreground/20 text-accent-foreground"
            }`}
          >
            <GitBranch className="w-3 h-3 inline mr-1" />
            {branch.label}
            {branch.isDefault && " (default)"}
          </span>
        ))}
      </div>
    </BaseNode>
  );
});
