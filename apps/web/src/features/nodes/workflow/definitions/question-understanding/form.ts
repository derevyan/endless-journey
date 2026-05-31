import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import { questionUnderstandingNodeFormSchema } from "../../forms/workflow-form-schemas";
import { extractorMap } from "../../forms/workflow-form-extractors";
import { builderMap } from "../../forms/workflow-form-builders";

export const questionUnderstandingFormHandlers: FormHandlers<Record<string, unknown>> = {
  schema: questionUnderstandingNodeFormSchema,
  extract: extractorMap.question_understanding!,
  build: builderMap.question_understanding!,
};
