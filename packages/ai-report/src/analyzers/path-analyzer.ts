/**
 * Path Analyzer
 *
 * Analyzes journey paths and generates human-readable descriptions.
 *
 * @module @journey/ai-report/analyzers/path-analyzer
 */

import type { TransitionDetail } from "../schemas";

/**
 * Build a human-readable path description from transitions.
 *
 * @example
 * "Start → Welcome → Agent(Q&A) → IfElse[interested=yes] → Pricing → End"
 */
export function buildPathDescription(transitions: TransitionDetail[]): string {
  if (transitions.length === 0) {
    return "No transitions recorded";
  }

  const pathParts: string[] = [];

  // Add the first "from" node
  const firstTransition = transitions[0];
  if (firstTransition.fromNodeId) {
    pathParts.push(
      formatNodeName(
        firstTransition.fromNodeLabel || firstTransition.fromNodeType,
        firstTransition.fromNodeType
      )
    );
  } else {
    pathParts.push("Start");
  }

  // Add each "to" node
  for (const transition of transitions) {
    const nodeName = formatNodeName(
      transition.toNodeLabel || transition.toNodeType,
      transition.toNodeType
    );

    // Add trigger context for special transitions
    let annotatedName = nodeName;
    if (transition.trigger === "button_click" && transition.buttonLabel) {
      annotatedName = `${nodeName}[${transition.buttonLabel}]`;
    } else if (
      transition.trigger === "condition_true" ||
      transition.trigger === "condition_false"
    ) {
      annotatedName = `${nodeName}[${transition.trigger.replace("condition_", "")}]`;
    } else if (transition.trigger === "timer_expired") {
      annotatedName = `${nodeName}(timeout)`;
    } else if (transition.trigger === "guard_blocked") {
      annotatedName = `${nodeName}(blocked)`;
    }

    pathParts.push(annotatedName);
  }

  return pathParts.join(" → ");
}

/**
 * Format node name for display.
 */
function formatNodeName(label: string | undefined, type: string): string {
  if (label) {
    // Capitalize first letter and truncate if too long
    const formatted = label.length > 20 ? label.slice(0, 17) + "..." : label;
    return formatted;
  }

  // Use type as fallback with nice formatting
  const typeMapping: Record<string, string> = {
    start: "Start",
    end: "End",
    message: "Message",
    agent: "Agent",
    if_else: "IfElse",
    webhook: "Webhook",
    crm: "CRM",
    questionnaire: "Questionnaire",
    delay: "Delay",
    set_tag: "SetTag",
    variable: "Variable",
  };

  return typeMapping[type] || type;
}
