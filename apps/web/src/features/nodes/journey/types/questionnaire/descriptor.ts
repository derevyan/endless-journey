/**
 * Questionnaire Node Definition
 *
 * Sequential Q&A with shared timeout.
 * Replaces multiple MESSAGE nodes for surveys/assessments.
 * Self-registers with the node registry.
 */

import { ClipboardList } from "lucide-react";
import {
  questionnaireNodeDescriptor,
  type QuestionnaireNodeData,
  type QuestionnaireState,
} from "@journey/schemas";

import { QuestionnaireNode } from "./component";
import { QuestionnaireNodeEditor } from "./editor";
import { questionnaireFormHandlers } from "./form";
import { getNodeTheme } from "../../config/node-theme";
import { frontendNodeRegistry as nodeRegistry, type FrontendNodeDescriptor } from "../../registry/frontend-descriptor";

const questionnaireFrontendDescriptor: FrontendNodeDescriptor<
  QuestionnaireNodeData,
  QuestionnaireState
> = {
  ...questionnaireNodeDescriptor,
  icon: ClipboardList,
  colors: getNodeTheme("questionnaire"),
  formHandlers: questionnaireFormHandlers,
  component: QuestionnaireNode,
  editor: QuestionnaireNodeEditor,
};

nodeRegistry.register(questionnaireFrontendDescriptor);
