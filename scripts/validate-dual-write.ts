/**
 * Validate Dual-Write Consistency
 *
 * Compares message counts between interactions table (event sourcing) and
 * conversations table (JSONB document model) to detect dual-write failures.
 *
 * Usage:
 *   npx tsx scripts/validate-dual-write.ts [--sample-size=100] [--fix-missing]
 *
 * @module scripts/validate-dual-write
 */

import { db } from "@journey/db";
import { interactions, conversations } from "@journey/db/schema";
import { eq, sql } from "drizzle-orm";
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("validate-dual-write");

// Parse CLI arguments
const args = process.argv.slice(2);
const sampleSize = parseInt(
  args.find((arg) => arg.startsWith("--sample-size="))?.split("=")[1] || "100"
);
const shouldFix = args.includes("--fix-missing");

interface ValidationResult {
  sessionId: string;
  interactionCount: number;
  conversationCount: number;
  matches: boolean;
  missing: boolean;
}

/**
 * Get sample of sessions with interactions
 */
async function getSampleSessions(
  limit: number
): Promise<Array<{ sessionId: string }>> {
  const rows = await db
    .select({ sessionId: interactions.sessionId })
    .from(interactions)
    .groupBy(interactions.sessionId)
    .limit(limit);

  return rows;
}

/**
 * Count interactions for a session
 */
async function countInteractions(sessionId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(interactions)
    .where(eq(interactions.sessionId, sessionId));

  return result[0]?.count || 0;
}

/**
 * Get conversation message count
 */
async function getConversationMessageCount(
  sessionId: string
): Promise<number | null> {
  const result = await db
    .select({ messages: conversations.messages })
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .limit(1);

  if (!result[0]) {
    return null;
  }

  const messages = result[0].messages as Array<unknown>;
  return messages.length;
}

/**
 * Backfill missing conversation document
 */
async function backfillConversation(sessionId: string): Promise<void> {
  // Load all interactions for session
  const rows = await db
    .select()
    .from(interactions)
    .where(eq(interactions.sessionId, sessionId))
    .orderBy(interactions.timestamp);

  if (rows.length === 0) {
    return;
  }

  // Create conversation document from interactions
  const messages = rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    type: row.type,
    nodeId: row.nodeId,
    payload: row.payload,
    metadata: row.metadata,
  }));

  // Upsert conversation document
  await db
    .insert(conversations)
    .values({
      sessionId,
      messages,
      createdAt: rows[0].timestamp,
      updatedAt: rows[rows.length - 1].timestamp,
    })
    .onConflictDoUpdate({
      target: conversations.sessionId,
      set: {
        messages: sql`${conversations.messages}`,
        updatedAt: rows[rows.length - 1].timestamp,
      },
    });

  log.info({ sessionId, messageCount: messages.length }, "backfilled:conversation");
}

/**
 * Validate consistency for a session
 */
async function validateSession(sessionId: string): Promise<ValidationResult> {
  const interactionCount = await countInteractions(sessionId);
  const conversationCount = await getConversationMessageCount(sessionId);

  return {
    sessionId,
    interactionCount,
    conversationCount: conversationCount ?? 0,
    matches: conversationCount === interactionCount,
    missing: conversationCount === null,
  };
}

/**
 * Main validation function
 */
async function validateDualWrite(): Promise<void> {
  log.info({ sampleSize, shouldFix }, "validation:start");

  try {
    // Get sample sessions
    const sessions = await getSampleSessions(sampleSize);
    log.info({ sessionCount: sessions.length }, "validation:sessions:loaded");

    let matchCount = 0;
    let mismatchCount = 0;
    let missingCount = 0;
    const mismatches: ValidationResult[] = [];
    const missing: ValidationResult[] = [];

    // Validate each session
    for (const { sessionId } of sessions) {
      const result = await validateSession(sessionId);

      if (result.missing) {
        missingCount++;
        missing.push(result);
        log.warn(
          { sessionId, interactionCount: result.interactionCount },
          "validation:missing"
        );

        // Backfill if requested
        if (shouldFix) {
          try {
            await backfillConversation(sessionId);
            log.info({ sessionId }, "validation:backfilled");
          } catch (error) {
            log.error(
              { err: serializeError(error), sessionId },
              "validation:backfill:failed"
            );
          }
        }
      } else if (!result.matches) {
        mismatchCount++;
        mismatches.push(result);
        log.error(
          {
            sessionId,
            interactionCount: result.interactionCount,
            conversationCount: result.conversationCount,
          },
          "validation:mismatch"
        );
      } else {
        matchCount++;
        log.debug(
          {
            sessionId,
            messageCount: result.interactionCount,
          },
          "validation:ok"
        );
      }
    }

    // Summary
    const errorRate = ((mismatchCount + missingCount) / sessions.length) * 100;
    log.info(
      {
        sampledSessions: sessions.length,
        matchCount,
        mismatchCount,
        missingCount,
        errorRatePercent: errorRate.toFixed(2),
        shouldFix,
      },
      "validation:summary"
    );

    // Print detailed results for mismatches
    if (mismatches.length > 0) {
      console.error("\n❌ MISMATCHES:");
      mismatches.forEach((m) => {
        console.error(
          `  ${m.sessionId}: interactions=${m.interactionCount}, conversations=${m.conversationCount}`
        );
      });
    }

    // Print missing documents
    if (missing.length > 0) {
      console.error("\n⚠️  MISSING CONVERSATIONS:");
      missing.forEach((m) => {
        console.error(
          `  ${m.sessionId}: interactions=${m.interactionCount}, conversation=MISSING`
        );
      });

      if (shouldFix) {
        console.log("\n✅ Backfilled missing conversations");
      }
    }

    // Exit with error code if issues found
    if (mismatchCount > 0) {
      process.exit(1);
    }

    if (missingCount > 0 && !shouldFix) {
      process.exit(1);
    }

    console.log("\n✅ Dual-write validation passed!");
  } catch (error) {
    log.error({ err: serializeError(error) }, "validation:error");
    process.exit(1);
  }
}

// Run validation
validateDualWrite();
