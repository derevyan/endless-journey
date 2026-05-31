/**
 * questionnaire Node Backend Descriptor
 */

import {
  questionnaireNodeDescriptor,
  type QuestionnaireNodeData,
  type QuestionnaireState,
} from "@journey/schemas";

import { backendNodeRegistry, type BackendNodeDescriptor } from "../../../descriptors/backend-descriptor";
import { questionnaireHandler } from "./handler";

export const questionnaireBackendDescriptor: BackendNodeDescriptor<
  QuestionnaireNodeData,
  QuestionnaireState
> = {
  ...questionnaireNodeDescriptor,
  execution: questionnaireHandler,
};

backendNodeRegistry.register(questionnaireBackendDescriptor);
