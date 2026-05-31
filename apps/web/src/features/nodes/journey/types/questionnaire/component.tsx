/**
 * QuestionnaireNode Component
 *
 * Display sequential Q&A with shared timeout.
 * Replaces multiple MESSAGE nodes for surveys/assessments.
 *
 * Shows:
 * - Question count badge
 * - Timeout badge if configured
 * - Preview of first few questions
 */

import { useNodeId } from "@xyflow/react";
import { Clock, MessageCircleQuestion } from "lucide-react";
import { memo } from "react";

import { useNodePlugins } from "../../hooks/use-node-plugins";

import { NODE_LAYOUT, NODE_TYPOGRAPHY } from "../../config/node-theme";
import { formatDuration } from "../../logic/wait";
import type { QuestionnaireNodeData } from "@journey/schemas";
import { NodeTypeEnum } from "../../react-flow-types";
import { BaseNode } from "../../components/base-node";
import { NodeBadge } from "../../components/previews/node-badge";
import { NodeCountBadge } from "../../components/previews/node-count-badge";

interface QuestionnaireNodeProps {
  data: QuestionnaireNodeData;
}

export const QuestionnaireNode = memo(function QuestionnaireNode({ data }: QuestionnaireNodeProps) {
  // Get node ID from React Flow context
  const nodeId = useNodeId() ?? "";

  // Get plugins attached to this node for addon rendering
  const plugins = useNodePlugins(nodeId);

  const questionCount = data.questions?.length || 0;
  const hasTimeout = data.timeout && data.timeout.seconds > 0;
  const hasIntro = data.introduction?.content;
  const hasCompletion = data.completion?.content;

  // Build badges array
  const badges = (
    <div className={`flex items-center ${NODE_LAYOUT.badge.gap}`}>
      {/* Question count badge */}
      <NodeCountBadge
        count={questionCount}
        icon={<MessageCircleQuestion className="size-3" />}
        className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
      />

      {/* Timeout badge */}
      {hasTimeout && (
        <NodeBadge className="bg-accent text-accent-foreground" icon={<Clock className="size-3" />}>
          {formatDuration(data.timeout!.seconds)}
        </NodeBadge>
      )}
    </div>
  );

  return (
    <BaseNode
      nodeType={NodeTypeEnum.QUESTIONNAIRE}
      label={data.label}
      hasTimerHandle={hasTimeout}
      hasOutputHandle={true}
      badges={badges}
      pluginAddons={plugins}
    >
      {/* Introduction preview */}
      {hasIntro && (
        <p className={`${NODE_TYPOGRAPHY.content} text-muted-foreground line-clamp-1 leading-relaxed italic`}>
          Intro: {data.introduction!.content.substring(0, 50)}...
        </p>
      )}

      {/* Questions preview */}
      {questionCount > 0 && (
        <div className="space-y-1">
          {data.questions.slice(0, 3).map((q, i) => (
            <div key={q.id} className="flex items-start gap-2">
              <span className={`${NODE_TYPOGRAPHY.content} text-muted-foreground/60 shrink-0`}>
                {i + 1}.
              </span>
              <p className={`${NODE_TYPOGRAPHY.content} text-muted-foreground line-clamp-1`}>
                {q.content.substring(0, 40)}
                {q.content.length > 40 ? "..." : ""}
              </p>
            </div>
          ))}
          {questionCount > 3 && (
            <p className={`${NODE_TYPOGRAPHY.content} text-muted-foreground/50 italic`}>
              +{questionCount - 3} more questions
            </p>
          )}
        </div>
      )}

      {/* Completion preview */}
      {hasCompletion && (
        <p className={`${NODE_TYPOGRAPHY.content} text-green-600 dark:text-green-400 line-clamp-1 leading-relaxed`}>
          ✓ {data.completion!.content.substring(0, 40)}...
        </p>
      )}
    </BaseNode>
  );
});
