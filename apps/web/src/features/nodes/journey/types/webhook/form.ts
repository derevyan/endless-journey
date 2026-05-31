import type { FormHandlers } from "../../registry/form-registry";

import { webhookNodeSchema } from "../../forms/form-schemas";
import { extractWebhookFields } from "../../forms/node-form-extractors";
import { buildWebhookNodeData, type WebhookFormValues } from "../../forms/node-form-builders";

export const webhookFormHandlers: FormHandlers = {
  schema: webhookNodeSchema,
  extract: extractWebhookFields,
  build: (values) => buildWebhookNodeData(values as unknown as WebhookFormValues),
};
