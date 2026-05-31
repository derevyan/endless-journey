import type { DbClient } from "@journey/db";

export interface UploadServiceContext {
  db: DbClient;
  organizationId: string;
}
