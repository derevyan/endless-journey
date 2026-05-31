import { WorkflowNodeTypeSchema, isValidLLMProvider } from "@journey/schemas";
import type { WorkflowNodeType, LLMProvider } from "@journey/schemas";

export function ensureWorkflowNodeType(
  value: unknown,
  fallback: WorkflowNodeType = "agent"
): WorkflowNodeType {
  const parsed = WorkflowNodeTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function ensureLlmProvider(
  value: unknown,
  fallback: LLMProvider
): LLMProvider {
  return isValidLLMProvider(value) ? value : fallback;
}
