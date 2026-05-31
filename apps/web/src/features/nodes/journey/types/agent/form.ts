import type { FormHandlers } from "../../registry/form-registry";

import { agentFormSchema } from "../../forms/form-schemas";
import { extractAgentFields } from "../../forms/node-form-extractors";
import { buildAgentNodeData, type AgentFormValues } from "../../forms/node-form-builders";

export const agentFormHandlers: FormHandlers = {
  schema: agentFormSchema,
  extract: extractAgentFields,
  build: (values) => buildAgentNodeData(values as unknown as AgentFormValues),
};
