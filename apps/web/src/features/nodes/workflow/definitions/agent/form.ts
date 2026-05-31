import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import { agentNodeFormSchema } from "../../forms/workflow-form-schemas";
import { extractorMap } from "../../forms/workflow-form-extractors";
import { builderMap } from "../../forms/workflow-form-builders";

export const agentFormHandlers: FormHandlers<Record<string, unknown>> = {
  schema: agentNodeFormSchema,
  extract: extractorMap.agent!,
  build: builderMap.agent!,
};
