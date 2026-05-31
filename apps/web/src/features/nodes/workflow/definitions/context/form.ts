import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import { contextNodeFormSchema } from "../../forms/workflow-form-schemas";
import { extractorMap } from "../../forms/workflow-form-extractors";
import { builderMap } from "../../forms/workflow-form-builders";

export const contextFormHandlers: FormHandlers<Record<string, unknown>> = {
  schema: contextNodeFormSchema,
  extract: extractorMap.context!,
  build: builderMap.context!,
};
