import type { FormHandlers } from "../../registry/form-registry";

import { questionnaireNodeSchema } from "../../forms/form-schemas";
import { extractQuestionnaireFields } from "../../forms/node-form-extractors";
import { buildQuestionnaireNodeData, type QuestionnaireFormValues } from "../../forms/node-form-builders";

export const questionnaireFormHandlers: FormHandlers = {
  schema: questionnaireNodeSchema,
  extract: extractQuestionnaireFields,
  build: (values) => buildQuestionnaireNodeData(values as unknown as QuestionnaireFormValues),
};
