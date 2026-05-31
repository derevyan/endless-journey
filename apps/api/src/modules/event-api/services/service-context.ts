import type { DbClient } from "@journey/db";

export interface EventServiceContext {
  db: DbClient;
}
