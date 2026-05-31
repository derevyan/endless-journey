/**
 * Question Understanding Node Definition
 * @module features/nodes/workflow/definitions/question-understanding/index
 */

import { MessageCircleQuestion } from "lucide-react";
import { workflowQuestionUnderstandingNodeDescriptor } from "@journey/schemas";
import type { QuestionUnderstandingNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { QuestionUnderstandingNode } from "./question-understanding-node";
import { QuestionUnderstandingNodeConfig as QuestionUnderstandingNodeEditor } from "./question-understanding-node-config";
import { questionUnderstandingFormHandlers } from "./form";

const questionUnderstandingFrontendDescriptor: FrontendWorkflowNodeDescriptor<QuestionUnderstandingNodeConfig> = {
  ...workflowQuestionUnderstandingNodeDescriptor,
  icon: MessageCircleQuestion,
  color: getWorkflowNodeColor("question_understanding"),
  component: QuestionUnderstandingNode,
  editor: QuestionUnderstandingNodeEditor,
  formHandlers: questionUnderstandingFormHandlers,
};

workflowNodeRegistry.register(questionUnderstandingFrontendDescriptor);
