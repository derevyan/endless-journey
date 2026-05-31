import type { FormHandlers } from "../../registry/form-registry";

import { simpleNodeSchema } from "../../forms/form-schemas";
import { extractSimpleFields } from "../../forms/node-form-extractors";
import { buildSimpleNodeData, type SimpleFormValues } from "../../forms/node-form-builders";

export const endFormHandlers: FormHandlers = {
  schema: simpleNodeSchema,
  extract: extractSimpleFields,
  build: (values) => buildSimpleNodeData(values as unknown as SimpleFormValues),
};
