/**
 * Workflow Question Understanding Node Descriptor (Base)
 */

import {
  QuestionUnderstandingNodeConfigSchema,
  type QuestionUnderstandingNodeConfig,
} from "../../../../agents/workflow/nodes/tools";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowQuestionUnderstandingNodeDescriptor: WorkflowNodeDescriptor<QuestionUnderstandingNodeConfig> = {
  system: "workflow",
  type: "question_understanding",
  version: 1,
  displayName: "Question",
  description: "Synthesize unanswered questions from conversation",
  category: "tools",
  size: "compact",

  schema: QuestionUnderstandingNodeConfigSchema,
  handles: buildWorkflowHandles("question_understanding"),

  createDefaultData: () => ({
    outputVariable: "synthesized_question",
    includeReasoning: false,
  }),

  isType: (data): data is QuestionUnderstandingNodeConfig =>
    QuestionUnderstandingNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowQuestionUnderstandingNodeDescriptor);
