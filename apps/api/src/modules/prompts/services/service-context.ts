import type { DbClient } from "@journey/db";

export interface PromptServiceContext {
  db: DbClient;
  organizationId: string;
}
