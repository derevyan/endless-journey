import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import { guardNodeFormSchema } from "../../forms/workflow-form-schemas";
import { extractorMap } from "../../forms/workflow-form-extractors";
import { builderMap } from "../../forms/workflow-form-builders";

export const guardFormHandlers: FormHandlers<Record<string, unknown>> = {
  schema: guardNodeFormSchema,
  extract: extractorMap.guard!,
  build: builderMap.guard!,
};
