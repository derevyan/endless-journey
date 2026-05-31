/**
 * Transaction Helper Utilities
 *
 * Provides clean transaction wrappers for database operations.
 */

import { db } from "../client";

/**
 * Transaction client type - inferred from the db.transaction callback parameter.
 * This type matches what Drizzle provides for transactional operations.
 */
export type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Execute database operations within a transaction.
 *
 * @example
 * ```typescript
 * const result = await withTransaction(async (tx) => {
 *   await tx.insert(journeys).values({...});
 *   await tx.insert(journeyVersions).values({...});
 *   return { success: true };
 * });
 * ```
 */
export async function withTransaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
  return db.transaction(callback);
}
