import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import { userApprovalNodeFormSchema } from "../../forms/workflow-form-schemas";
import { extractorMap } from "../../forms/workflow-form-extractors";
import { builderMap } from "../../forms/workflow-form-builders";

export const userApprovalFormHandlers: FormHandlers<Record<string, unknown>> = {
  schema: userApprovalNodeFormSchema,
  extract: extractorMap.user_approval!,
  build: builderMap.user_approval!,
};
