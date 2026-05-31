import type { FormHandlers } from "../../registry/form-registry";

import { crmNodeSchema } from "../../forms/form-schemas";
import { extractCrmFields } from "../../forms/node-form-extractors";
import { buildCrmNodeData, type CrmFormValues } from "../../forms/node-form-builders";

export const crmFormHandlers: FormHandlers = {
  schema: crmNodeSchema,
  extract: extractCrmFields,
  build: (values) => buildCrmNodeData(values as unknown as CrmFormValues),
};
