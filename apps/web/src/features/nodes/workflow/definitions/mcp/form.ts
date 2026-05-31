import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import { mcpNodeFormSchema } from "../../forms/workflow-form-schemas";
import { extractorMap } from "../../forms/workflow-form-extractors";
import { builderMap } from "../../forms/workflow-form-builders";

export const mcpFormHandlers: FormHandlers<Record<string, unknown>> = {
  schema: mcpNodeFormSchema,
  extract: extractorMap.mcp!,
  build: builderMap.mcp!,
};
