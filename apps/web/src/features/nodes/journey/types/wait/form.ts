import type { FormHandlers } from "../../registry/form-registry";

import { waitNodeSchema } from "../../forms/form-schemas";
import { extractWaitFields } from "../../forms/node-form-extractors";
import { buildWaitNodeData, type WaitFormValues } from "../../forms/node-form-builders";

export const waitFormHandlers: FormHandlers = {
  schema: waitNodeSchema,
  extract: extractWaitFields,
  build: (values) => buildWaitNodeData(values as unknown as WaitFormValues),
};
