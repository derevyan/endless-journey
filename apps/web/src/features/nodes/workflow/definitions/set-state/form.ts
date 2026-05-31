import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import { setStateNodeFormSchema } from "../../forms/workflow-form-schemas";
import { extractorMap } from "../../forms/workflow-form-extractors";
import { builderMap } from "../../forms/workflow-form-builders";

export const setStateFormHandlers: FormHandlers<Record<string, unknown>> = {
  schema: setStateNodeFormSchema,
  extract: extractorMap.set_state!,
  build: builderMap.set_state!,
};
