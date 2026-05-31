/**
 * Database Query Helpers for E2E Tests
 *
 * These functions query the database during E2E tests using dynamic imports
 * to ensure they run in Node.js context, not browser context.
 */

/**
 * Query interactions table by session ID
 */
export async function queryInteractionsBySessionId(sessionId: string) {
  // Dynamic import to ensure this runs in Node.js context
  // Using file path to avoid module resolution issues in test context
  const { db } = await import("../../../packages/db/src/index.ts");
  const { interactions } = await import("../../../packages/db/src/schema/index.ts");
  const { eq, asc } = await import("drizzle-orm");

  return db
    .select()
    .from(interactions)
    .where(eq(interactions.sessionId, sessionId as any))
    .orderBy(asc(interactions.timestamp));
}

/**
 * Query conversations JSONB document by session ID
 */
export async function queryConversationBySessionId(sessionId: string) {
  // Dynamic import to ensure this runs in Node.js context
  // Using file path to avoid module resolution issues in test context
  const { db } = await import("../../../packages/db/src/index.ts");
  const { conversations } = await import("../../../packages/db/src/schema/index.ts");
  const { eq } = await import("drizzle-orm");

  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId as any))
    .limit(1);

  return result[0] || null;
}
