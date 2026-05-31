import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import { endNodeFormSchema } from "../../forms/workflow-form-schemas";
import { extractorMap } from "../../forms/workflow-form-extractors";
import { builderMap } from "../../forms/workflow-form-builders";

export const endFormHandlers: FormHandlers<Record<string, unknown>> = {
  schema: endNodeFormSchema,
  extract: extractorMap.end!,
  build: builderMap.end!,
};
