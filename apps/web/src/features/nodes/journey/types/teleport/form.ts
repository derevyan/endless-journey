import type { FormHandlers } from "../../registry/form-registry";

import { teleportNodeSchema } from "../../forms/form-schemas";
import { extractTeleportFields } from "../../forms/node-form-extractors";
import { buildTeleportNodeData, type TeleportFormValues } from "../../forms/node-form-builders";

export const teleportFormHandlers: FormHandlers = {
  schema: teleportNodeSchema,
  extract: extractTeleportFields,
  build: (values) => buildTeleportNodeData(values as unknown as TeleportFormValues),
};
