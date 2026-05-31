import type { FormHandlers } from "../../registry/form-registry";

import { conditionNodeSchema } from "../../forms/form-schemas";
import { extractConditionFields } from "../../forms/node-form-extractors";
import { buildConditionNodeData, type ConditionFormValues } from "../../forms/node-form-builders";

export const conditionFormHandlers: FormHandlers = {
  schema: conditionNodeSchema,
  extract: extractConditionFields,
  build: (values) => buildConditionNodeData(values as unknown as ConditionFormValues),
};
