import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import { ifElseNodeFormSchema } from "../../forms/workflow-form-schemas";
import { extractorMap } from "../../forms/workflow-form-extractors";
import { builderMap } from "../../forms/workflow-form-builders";

export const ifElseFormHandlers: FormHandlers<Record<string, unknown>> = {
  schema: ifElseNodeFormSchema,
  extract: extractorMap.if_else!,
  build: builderMap.if_else!,
};
