import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import { transformNodeFormSchema } from "../../forms/workflow-form-schemas";
import { extractorMap } from "../../forms/workflow-form-extractors";
import { builderMap } from "../../forms/workflow-form-builders";

export const transformFormHandlers: FormHandlers<Record<string, unknown>> = {
  schema: transformNodeFormSchema,
  extract: extractorMap.transform!,
  build: builderMap.transform!,
};
