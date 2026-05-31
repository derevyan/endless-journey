/**
 * Questionnaire Node Descriptor (Base)
 */

import {
  QuestionnaireNodeDataSchema,
  QuestionnaireStateSchema,
  type QuestionnaireNodeData,
  type QuestionnaireState,
} from "./schema";
import { NODE_CAPABILITIES } from "../../../capabilities";
import type { JourneyNodeDescriptor } from "../../../descriptor";
import { nodeDescriptorRegistry } from "../../../descriptor-registry";

function generateQuestionId(): string {
  return `q-${Math.random().toString(36).slice(2, 10)}`;
}

export const questionnaireNodeDescriptor: JourneyNodeDescriptor<QuestionnaireNodeData, QuestionnaireState> = {
  system: "journey",
  type: "questionnaire",
  version: 1,
  displayName: "Questionnaire",
  description: "Sequential Q&A with shared timeout - replaces multiple message nodes",
  category: "action",

  schema: QuestionnaireNodeDataSchema,
  stateSchema: QuestionnaireStateSchema,
  capabilities: NODE_CAPABILITIES.questionnaire,
  handles: {
    inputs: [{ id: "default", label: "In" }],
    outputs: [
      { id: "output", label: "Complete" },
      { id: "timer", label: "Timeout", condition: "hasTimeout" },
    ],
  },

  createDefaultData: () => ({
    type: "questionnaire",
    schemaVersion: 1,
    label: "Questionnaire",
    questions: [
      {
        id: generateQuestionId(),
        content: "Question",
        responseType: "buttons",
        buttons: [],
        required: true,
      },
    ],
    allowBack: false,
    shuffle: false,
  }),

  isType: (data): data is QuestionnaireNodeData => QuestionnaireNodeDataSchema.safeParse(data).success,
};

nodeDescriptorRegistry.register(questionnaireNodeDescriptor);
