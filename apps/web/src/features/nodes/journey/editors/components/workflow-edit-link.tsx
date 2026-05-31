/**
 * WorkflowEditLink Component
 *
 * A reusable link component that navigates to the workflow builder page.
 * Used in journey nodes that reference agent workflows.
 * Styled to match "Edit prompt" link in prompt-selector.
 */

import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { cn } from "@/shared/lib/utils";

interface WorkflowEditLinkProps {
  workflowKey: string | undefined;
  className?: string;
}

export function WorkflowEditLink({ workflowKey, className }: WorkflowEditLinkProps) {
  if (!workflowKey) return null;

  return (
    <Link
      to="/agents/$agentKey"
      params={{ agentKey: workflowKey }}
      className={cn("text-xs text-muted-foreground hover:text-primary flex items-center gap-1", className)}
    >
      <ExternalLink className="h-3 w-3" />
      Edit Agent Workflow
    </Link>
  );
}
