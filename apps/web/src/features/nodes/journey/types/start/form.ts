import type { FormHandlers } from "../../registry/form-registry";

import { startNodeSchema } from "../../forms/form-schemas";
import { extractStartFields } from "../../forms/node-form-extractors";
import { buildStartNodeData, type StartFormValues } from "../../forms/node-form-builders";

export const startFormHandlers: FormHandlers = {
  schema: startNodeSchema,
  extract: extractStartFields,
  build: (values) => buildStartNodeData(values as unknown as StartFormValues),
};
