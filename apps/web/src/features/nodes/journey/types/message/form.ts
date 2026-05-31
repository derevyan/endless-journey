import type { FormHandlers } from "../../registry/form-registry";

import { messageNodeSchema } from "../../forms/form-schemas";
import { extractMessageFields } from "../../forms/node-form-extractors";
import { buildMessageNodeData, type MessageFormValues } from "../../forms/node-form-builders";

export const messageFormHandlers: FormHandlers = {
  schema: messageNodeSchema,
  extract: extractMessageFields,
  build: (values) => buildMessageNodeData(values as unknown as MessageFormValues),
};
